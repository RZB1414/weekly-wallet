/**
 * Pusheen Wallet — JWT Auth Middleware
 * 
 * Verifies Authorization: Bearer <token> header,
 * sets userId and email on the context.
 */

import { verify } from 'hono/jwt';

export function authMiddleware() {
    return async (c, next) => {
        const authHeader = c.req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Authentication required' }, 401);
        }

        const token = authHeader.slice(7);

        try {
            const payload = await verify(token, c.env.JWT_SECRET);

            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return c.json({ error: 'Token expired. Please log in again.' }, 401);
            }

            // Set user info on context
            c.set('userId', payload.sub);
            c.set('email', payload.email);
        } catch (err) {
            return c.json({ error: 'Invalid token. Please log in again.' }, 401);
        }

        await next();
    };
}
