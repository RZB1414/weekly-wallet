/**
 * Pusheen Wallet — Auth Routes
 * 
 * Routes:
 *   POST /api/auth/register       - Create new user
 *   POST /api/auth/login          - Login & get JWT
 *   POST /api/auth/change-password - Change password (re-wraps DEK)
 *   POST /api/auth/forgot-password - Send reset email
 *   POST /api/auth/reset-password  - Reset password via token
 */

import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import {
    hashPassword,
    verifyPassword,
    deriveKey,
    generateDEK,
    wrapKey,
    unwrapKey,
    generateResetToken,
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
    const { email, password } = await c.req.json();

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
        createdAt: new Date().toISOString(),
    };

    await putUser(bucket, email, user);

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
// POST /api/auth/forgot-password
// ──────────────────────────────────────────────

auth.post('/forgot-password', async (c) => {
    const bucket = c.env.WEEKLY_WALLET_BUCKET;
    const { email, frontendUrl } = await c.req.json();

    // Always return success to prevent email enumeration
    if (!email) {
        return c.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const user = await getUser(bucket, email);
    if (!user) {
        // Don't reveal that the user doesn't exist
        return c.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token with 1-hour expiry
    const resetToken = generateResetToken();
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour
    await putUser(bucket, email, user);

    // Build reset URL
    const baseUrl = frontendUrl || c.req.header('origin') || 'http://localhost:5173';
    const resetUrl = `${baseUrl}?reset=true&token=${resetToken}&email=${encodeURIComponent(email.toLowerCase())}`;

    // Send email via Resend
    if (c.env.RESEND_API_KEY) {
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: c.env.RESEND_FROM_EMAIL || 'Pusheen Wallet <onboarding@resend.dev>',
                    to: [email.toLowerCase()],
                    subject: '🐱 Pusheen Wallet — Password Reset',
                    html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FFF9F0; border-radius: 24px;">
              <h1 style="color: #4A2C00; font-family: 'Fredoka', sans-serif; text-align: center;">🐱 Pusheen Wallet</h1>
              <p style="color: #4A2C00; font-size: 16px;">Hello!</p>
              <p style="color: #8B5E3C; font-size: 14px;">We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #FF8C00; color: white; padding: 14px 32px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #8B5E3C; font-size: 12px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
                }),
            });
        } catch (err) {
            console.error('Failed to send reset email:', err);
        }
    }

    return c.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
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
