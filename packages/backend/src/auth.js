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

async function deriveTokenWrappingKey(serverSecret) {
    return deriveKey(serverSecret, 'server-internal-salt', 'pusheen-wallet-token-wrap');
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
        createdAt: new Date().toISOString(),
    };

    await putUser(bucket, email, user);

    // Wrap the DEK statelessly for the session token
    const tokenWrappingKey = await deriveTokenWrappingKey(c.env.JWT_SECRET);
    const tokenWrappedDEK = await wrapKey(dekBase64, tokenWrappingKey);

    // Generate JWT
    const token = await sign(
        {
            sub: userId,
            email: email.toLowerCase(),
            dek: tokenWrappedDEK,
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

    // Unwrap DEK to re-wrap for the session token
    const passwordKey = await derivePasswordWrappingKey(password, email);
    const dekBase64 = await unwrapKey(user.passwordWrappedDEK, passwordKey);
    const tokenWrappingKey = await deriveTokenWrappingKey(c.env.JWT_SECRET);
    const tokenWrappedDEK = await wrapKey(dekBase64, tokenWrappingKey);

    // Generate JWT
    const token = await sign(
        {
            sub: user.id,
            email: user.email,
            dek: tokenWrappedDEK,
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
    const { email, oldPassword, newPassword, recoveryKey } = await c.req.json();

    if (!email || !oldPassword || !newPassword || !recoveryKey) {
        return c.json({ error: 'Email, old password, new password, and recovery key are required' }, 400);
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

    // Validate recovery key
    try {
        const recoveryKeyObj = await deriveRecoveryWrappingKey(recoveryKey, email);
        await unwrapKey(user.recoveryWrappedDEK, recoveryKeyObj);
    } catch (err) {
        return c.json({ error: 'Invalid recovery key.' }, 401);
    }

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

    // Re-wrap for new session token
    const tokenWrappingKey = await deriveTokenWrappingKey(c.env.JWT_SECRET);
    const tokenWrappedDEK = await wrapKey(dekBase64, tokenWrappingKey);

    // Issue new token
    const token = await sign(
        {
            sub: user.id,
            email: user.email,
            dek: tokenWrappedDEK,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        },
        c.env.JWT_SECRET
    );

    return c.json({ success: true, token });
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
