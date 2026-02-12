/**
 * Pusheen Wallet — Auth Routes
 * 
 * Routes:
 *   POST /api/auth/register       - Create new user
 *   POST /api/auth/login          - Login & get JWT
 *   POST /api/auth/change-password - Change password (re-wraps DEK)
 *   POST /api/auth/link-telegram   - Generate Telegram linking code
 *   POST /api/auth/forgot-password - Send reset code via Telegram
 *   POST /api/auth/reset-password  - Reset password via code
 */

import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { authMiddleware } from './middleware.js';
import {
    hashPassword,
    verifyPassword,
    deriveKey,
    generateDEK,
    wrapKey,
    unwrapKey,
    generateShortCode,
} from './crypto.js';

const auth = new Hono();

// ──────────────────────────────────────────────
// Helper: get/put user record from R2
// ──────────────────────────────────────────────

async function getUser(bucket, email) {
    const key = `users/${email.toLowerCase()}.json`;
    const obj = await bucket.get(key);
    if (!obj) return null;
    return obj.json();
}

async function putUser(bucket, email, userData) {
    const key = `users/${email.toLowerCase()}.json`;
    await bucket.put(key, JSON.stringify(userData));
}

// ──────────────────────────────────────────────
// Helper: derive wrapping keys
// ──────────────────────────────────────────────

async function derivePasswordWrappingKey(password, email) {
    return deriveKey(password, email.toLowerCase(), 'pusheen-wallet-password-wrap');
}

async function deriveRecoveryWrappingKey(jwtSecret, email) {
    return deriveKey(jwtSecret, email.toLowerCase(), 'pusheen-wallet-recovery-wrap');
}

// ──────────────────────────────────────────────
// Helper: validate email & password
// ──────────────────────────────────────────────

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    return null;
}

// ──────────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────────

auth.post('/register', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { email, password, telegramUsername } = await c.req.json();

    // Validate
    if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
    }
    if (!validateEmail(email)) {
        return c.json({ error: 'Invalid email format' }, 400);
    }
    const pwError = validatePassword(password);
    if (pwError) {
        return c.json({ error: pwError }, 400);
    }

    // Check if user exists
    const existing = await getUser(bucket, email);
    if (existing) {
        return c.json({ error: 'An account with this email already exists' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate DEK and wrap with password + recovery keys
    const dekBase64 = generateDEK();
    const passwordKey = await derivePasswordWrappingKey(password, email);
    const recoveryKey = await deriveRecoveryWrappingKey(c.env.JWT_SECRET, email);

    const passwordWrappedDEK = await wrapKey(dekBase64, passwordKey);
    const recoveryWrappedDEK = await wrapKey(dekBase64, recoveryKey);

    // Create user record
    const userId = crypto.randomUUID();
    const user = {
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        passwordWrappedDEK,
        recoveryWrappedDEK,
        telegramUsername: telegramUsername ? telegramUsername.replace(/^@/, '').trim() : null,
        createdAt: new Date().toISOString(),
    };

    await putUser(bucket, email, user);

    // Create Telegram username index for forgot-password lookup
    if (user.telegramUsername) {
        await bucket.put(
            `telegram-index/${user.telegramUsername.toLowerCase()}.json`,
            JSON.stringify({ email: email.toLowerCase() })
        );
    }

    // Generate JWT
    const token = await sign(
        {
            sub: userId,
            email: email.toLowerCase(),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        },
        c.env.JWT_SECRET
    );

    return c.json({
        success: true,
        token,
        user: { id: userId, email: email.toLowerCase() },
    });
});

// ──────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────

auth.post('/login', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { email, password } = await c.req.json();

    if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
    }

    const user = await getUser(bucket, email);
    if (!user) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate JWT
    const token = await sign(
        {
            sub: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        },
        c.env.JWT_SECRET
    );

    return c.json({
        success: true,
        token,
        user: { id: user.id, email: user.email },
    });
});

// ──────────────────────────────────────────────
// POST /api/auth/change-password
// ──────────────────────────────────────────────

auth.post('/change-password', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { email, oldPassword, newPassword } = await c.req.json();

    if (!email || !oldPassword || !newPassword) {
        return c.json({ error: 'Email, old password, and new password are required' }, 400);
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
        return c.json({ error: pwError }, 400);
    }

    const user = await getUser(bucket, email);
    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Verify old password
    const valid = await verifyPassword(oldPassword, user.passwordHash);
    if (!valid) {
        return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Unwrap DEK with old password
    const oldPasswordKey = await derivePasswordWrappingKey(oldPassword, email);
    const dekBase64 = await unwrapKey(user.passwordWrappedDEK, oldPasswordKey);

    // Re-wrap DEK with new password
    const newPasswordKey = await derivePasswordWrappingKey(newPassword, email);
    const newPasswordWrappedDEK = await wrapKey(dekBase64, newPasswordKey);

    // Update recovery wrapped DEK too (in case JWT_SECRET changed, keep it fresh)
    const recoveryKey = await deriveRecoveryWrappingKey(c.env.JWT_SECRET, email);
    const newRecoveryWrappedDEK = await wrapKey(dekBase64, recoveryKey);

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update user
    user.passwordHash = newPasswordHash;
    user.passwordWrappedDEK = newPasswordWrappedDEK;
    user.recoveryWrappedDEK = newRecoveryWrappedDEK;
    user.updatedAt = new Date().toISOString();

    await putUser(bucket, email, user);

    // Issue new token
    const token = await sign(
        {
            sub: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        },
        c.env.JWT_SECRET
    );

    return c.json({ success: true, token });
});

// ──────────────────────────────────────────────
// POST /api/auth/link-telegram (Protected)
// Generates a 6-digit code for linking Telegram
// ──────────────────────────────────────────────

auth.post('/link-telegram', authMiddleware(), async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const email = c.get('email');

    if (!email) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const code = generateShortCode();
    const linkData = {
        email: email.toLowerCase(),
        expiry: Date.now() + (10 * 60 * 1000), // 10 minutes
    };

    await bucket.put(`telegram-links/${code}.json`, JSON.stringify(linkData));

    return c.json({ success: true, code });
});

// ──────────────────────────────────────────────
// POST /api/auth/forgot-password
// ──────────────────────────────────────────────

auth.post('/forgot-password', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { telegramUsername } = await c.req.json();

    const genericResponse = { success: true, message: 'If an account exists, a reset code has been sent via Telegram.' };

    if (!telegramUsername) {
        return c.json({ error: 'Telegram username is required' }, 400);
    }

    // Look up email from telegram username index
    const cleanUsername = telegramUsername.replace(/^@/, '').trim().toLowerCase();
    const indexObj = await bucket.get(`telegram-index/${cleanUsername}.json`);
    if (!indexObj) {
        return c.json(genericResponse);
    }

    const { email } = await indexObj.json();
    const user = await getUser(bucket, email);
    if (!user) {
        return c.json(genericResponse);
    }

    // Generate 6-digit reset code with 1-hour expiry
    const resetCode = generateShortCode();
    user.resetToken = resetCode;
    user.resetTokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour
    await putUser(bucket, email, user);

    // Send via Telegram
    if (user.telegramChatId && c.env.TELEGRAM_BOT_TOKEN) {
        try {
            const tgResponse = await fetch(
                `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user.telegramChatId,
                        text: `🐱 Pusheen Wallet\n\nYour password reset code:\n\n🔑 ${resetCode}\n\nThis code expires in 1 hour.\nIf you didn't request this, ignore this message.`,
                    }),
                }
            );

            if (tgResponse.ok) {
                console.log('Reset code sent via Telegram to chat:', user.telegramChatId);
            } else {
                const errBody = await tgResponse.text();
                console.error('Telegram API error:', errBody);
            }
        } catch (err) {
            console.error('Failed to send Telegram message:', err);
        }
    } else {
        console.warn('User has no Telegram linked or TELEGRAM_BOT_TOKEN not configured.');
    }

    return c.json(genericResponse);
});

// ──────────────────────────────────────────────
// POST /api/auth/reset-password
// ──────────────────────────────────────────────

auth.post('/reset-password', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { email, token, newPassword } = await c.req.json();

    if (!email || !token || !newPassword) {
        return c.json({ error: 'Email, token, and new password are required' }, 400);
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
        return c.json({ error: pwError }, 400);
    }

    const user = await getUser(bucket, email);
    if (!user || !user.resetToken || user.resetToken !== token) {
        return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    if (Date.now() > user.resetTokenExpiry) {
        return c.json({ error: 'Reset token has expired. Please request a new one.' }, 400);
    }

    // Unwrap DEK with recovery key
    const recoveryKey = await deriveRecoveryWrappingKey(c.env.JWT_SECRET, email);
    const dekBase64 = await unwrapKey(user.recoveryWrappedDEK, recoveryKey);

    // Re-wrap DEK with new password
    const newPasswordKey = await derivePasswordWrappingKey(newPassword, email);
    const newPasswordWrappedDEK = await wrapKey(dekBase64, newPasswordKey);

    // Re-wrap recovery (refresh)
    const newRecoveryWrappedDEK = await wrapKey(dekBase64, recoveryKey);

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update user, clear reset token
    user.passwordHash = newPasswordHash;
    user.passwordWrappedDEK = newPasswordWrappedDEK;
    user.recoveryWrappedDEK = newRecoveryWrappedDEK;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.updatedAt = new Date().toISOString();

    await putUser(bucket, email, user);

    return c.json({ success: true, message: 'Password has been reset. You can now log in.' });
});

export default auth;
