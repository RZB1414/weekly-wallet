/**
 * Weekly Wallet — Auth Routes
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
    generateRecoverySecret,
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

async function deriveRecoveryWrappingKey(recoverySecret, email) {
    return deriveKey(recoverySecret, email.toLowerCase(), 'pusheen-wallet-recovery-wrap');
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
    const recoverySecret = generateRecoverySecret();
    const recoveryKey = await deriveRecoveryWrappingKey(recoverySecret, email);

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
        recoverySecret, // Returned ONLY ONCE to the user
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

    // Note: In a true zero-knowledge setup, the server DOES NOT have the recoverySecret here.
    // Therefore, we CANNOT re-wrap the recoveryWrappedDEK. It must remain exactly as it is.

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update user
    user.passwordHash = newPasswordHash;
    user.passwordWrappedDEK = newPasswordWrappedDEK;
    // user.recoveryWrappedDEK remains unchanged
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
// POST /api/auth/send-recovery-key (Protected)
// Sends the newly generated recovery key to the linked Telegram
// ──────────────────────────────────────────────

auth.post('/send-recovery-key', authMiddleware(), async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const email = c.get('email');
    const { recoverySecret } = await c.req.json();

    if (!email || !recoverySecret) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    const user = await getUser(bucket, email);
    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }
    if (!user.telegramChatId) {
        return c.json({ error: 'No Telegram account linked yet' }, 400);
    }

    if (c.env.TELEGRAM_BOT_TOKEN) {
        try {
            const tgResponse = await fetch(
                `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user.telegramChatId,
                        text: `🚨 Weekly Wallet Recovery Key 🚨\n\nYour true zero-knowledge recovery key is:\n\n<code>${recoverySecret}</code>\n\nSave this somewhere safe! If you lose your password and this key, your data is gone forever.`,
                        parse_mode: 'HTML',
                    }),
                }
            );

            if (tgResponse.ok) {
                return c.json({ success: true, message: 'Recovery key sent to Telegram.' });
            } else {
                console.error('Telegram API error:', await tgResponse.text());
                return c.json({ error: 'Failed to send to Telegram.' }, 500);
            }
        } catch (err) {
            console.error('Failed to send Telegram message:', err);
            return c.json({ error: 'Network error communicating with Telegram.' }, 500);
        }
    }

    return c.json({ error: 'Telegram bot not configured on server.' }, 500);
});

// ──────────────────────────────────────────────
// POST /api/auth/reset-password
// ──────────────────────────────────────────────

auth.post('/reset-password', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { email, recoveryKey: providedRecoverySecret, newPassword } = await c.req.json();

    if (!email || !providedRecoverySecret || !newPassword) {
        return c.json({ error: 'Email, recovery key, and new password are required' }, 400);
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
        return c.json({ error: pwError }, 400);
    }

    const user = await getUser(bucket, email);
    if (!user) {
        return c.json({ error: 'Invalid email or recovery key' }, 400); // Avoid leaking user existence completely, though we could just say user not found. Let's keep it generic.
    }

    try {
        // Attempt to unwrap DEK with the provided recovery key
        const recoveryKeyObj = await deriveRecoveryWrappingKey(providedRecoverySecret, email);
        const dekBase64 = await unwrapKey(user.recoveryWrappedDEK, recoveryKeyObj);

        // If we reach here, the recovery key was CORRECT.
        // Re-wrap DEK with the new password
        const newPasswordKey = await derivePasswordWrappingKey(newPassword, email);
        const newPasswordWrappedDEK = await wrapKey(dekBase64, newPasswordKey);

        // Note: we DO NOT re-wrap the recoveryWrappedDEK. It stays the same.

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user
        user.passwordHash = newPasswordHash;
        user.passwordWrappedDEK = newPasswordWrappedDEK;
        user.updatedAt = new Date().toISOString();

        await putUser(bucket, email, user);

        return c.json({ success: true, message: 'Password has been reset. You can now log in.' });

    } catch (e) {
        // Unwrap failed: wrong recovery key
        console.error('Recovery key unwrap failed:', e);
        return c.json({ error: 'Invalid recovery key' }, 400);
    }
});

export default auth;
