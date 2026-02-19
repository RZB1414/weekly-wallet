/**
 * Pusheen Wallet — Monitor Worker
 *
 * Runs daily at noon (UTC+4) via Cloudflare Cron Trigger.
 * Performs comprehensive health checks and sends a Telegram report
 * exclusively to the owner.
 *
 * Secrets required:
 *   TELEGRAM_BOT_TOKEN  — Bot API token
 *   TELEGRAM_CHAT_ID    — Owner's Telegram chat ID
 *
 * Env vars (set in wrangler.toml):
 *   FRONTEND_URL — Cloudflare Pages URL
 *   BACKEND_URL  — Cloudflare Worker backend URL
 */

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runHealthChecks(env, ctx));
    },

    // Also allow manual trigger via HTTP for testing
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/__trigger') {
            // Protection: only allow with correct secret header
            const secret = request.headers.get('X-Monitor-Secret');
            if (secret !== env.MONITOR_SECRET && env.MONITOR_SECRET) {
                return new Response('Unauthorized', { status: 401 });
            }

            const report = await runHealthChecks(env, ctx);
            return new Response(report, { status: 200 });
        }

        // Cloudflare's built-in scheduled test endpoint - keep generic for security
        if (url.pathname === '/__scheduled') {
            await runHealthChecks(env, ctx);
            return new Response('✅ Scheduled check complete. Report sent to Telegram.', { status: 200 });
        }

        return new Response('🐱 Pusheen Wallet Monitor — Use cron or /__trigger', { status: 200 });
    },
};

// ─── Health Check Runner ────────────────────────────────────────

async function runHealthChecks(env, ctx = { waitUntil: () => { } }) {
    const results = [];
    const startTime = Date.now();

    const FRONTEND = env.FRONTEND_URL;
    const BACKEND = env.BACKEND_URL;

    // 0. Backend Root Check
    results.push(await checkEndpoint('Backend Root', BACKEND, {
        expectedStatus: 200,
        bodyContains: 'Alive',
    }));

    // 1. Frontend availability
    results.push(await checkEndpoint('Frontend', FRONTEND, {
        expectedStatus: 200,
        bodyContains: '<',
    }));

    // 2. Backend protected route (should return 401 = worker alive + auth works)
    results.push(await checkEndpoint('Backend API (Auth Guard)', `${BACKEND}/api/weeks`, {
        expectedStatus: 401,
    }));

    // 3. Auth register validation (empty body → 400)
    results.push(await checkEndpoint('Auth Register Validation', `${BACKEND}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: 400,
    }));

    // 4. Auth login validation (empty body → 400)
    results.push(await checkEndpoint('Auth Login Validation', `${BACKEND}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: 400,
    }));

    // 5. Monthly planning protected route (should 401)
    results.push(await checkEndpoint('Monthly Planning (Auth Guard)', `${BACKEND}/api/monthly-planning/2026/1`, {
        expectedStatus: 401,
    }));

    // 6. Monthly plannings list (should 401)
    results.push(await checkEndpoint('Plannings List (Auth Guard)', `${BACKEND}/api/monthly-plannings`, {
        expectedStatus: 401,
    }));

    // 7. CORS headers check
    results.push(await checkCORS(`${BACKEND}/api/weeks`));

    // 8. Telegram Bot alive
    results.push(await checkTelegramBot(env.TELEGRAM_BOT_TOKEN));

    // 9. SSL / HTTPS check on frontend
    results.push(await checkSSL(FRONTEND, 'Frontend SSL'));

    // 10. SSL / HTTPS check on backend
    results.push(await checkSSL(BACKEND, 'Backend SSL'));

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    // Build Telegram message
    const message = buildReport(results, passed, failed, totalTime);

    // Send to owner's Telegram
    ctx.waitUntil(sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message));

    console.log("--- REPORT START ---");
    console.log(message);
    console.log("--- REPORT END ---");

    return message;
}

// ─── Individual Check Functions ─────────────────────────────────

async function checkEndpoint(name, url, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        expectedStatus = 200,
        bodyContains = null,
    } = options;

    const start = Date.now();

    try {
        const fetchOptions = { method, headers };
        if (body) fetchOptions.body = body;

        const res = await fetch(url, fetchOptions);
        const latency = Date.now() - start;
        const text = await res.text();

        const statusOk = res.status === expectedStatus;
        const bodyOk = bodyContains ? text.includes(bodyContains) : true;
        const ok = statusOk && bodyOk;

        let detail = `${res.status} (${latency}ms)`;
        if (!statusOk) detail = `Exp ${expectedStatus}, got ${res.status} body="${text.slice(0, 50)}..."`;
        if (!bodyOk) detail += ` | Body mismatch "${text.slice(0, 50)}..."`;

        return { name, ok, detail };
    } catch (err) {
        const latency = Date.now() - start;
        return { name, ok: false, detail: `Error: ${err.message} (${latency}ms)` };
    }
}

async function checkCORS(url) {
    const start = Date.now();

    try {
        const res = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://weekly-wallet.pages.dev',
                'Access-Control-Request-Method': 'GET',
            },
        });
        const latency = Date.now() - start;

        const acao = res.headers.get('Access-Control-Allow-Origin');
        const ok = acao !== null;

        return {
            name: 'CORS Headers',
            ok,
            detail: ok ? `Allow-Origin: ${acao} (${latency}ms)` : `Missing CORS headers (${latency}ms)`,
        };
    } catch (err) {
        const latency = Date.now() - start;
        return { name: 'CORS Headers', ok: false, detail: `Error: ${err.message} (${latency}ms)` };
    }
}

async function checkTelegramBot(botToken) {
    const start = Date.now();

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const latency = Date.now() - start;
        const data = await res.json();

        if (data.ok) {
            return {
                name: 'Telegram Bot',
                ok: true,
                detail: `@${data.result.username} alive (${latency}ms)`,
            };
        }

        return {
            name: 'Telegram Bot',
            ok: false,
            detail: `Bot API error: ${data.description} (${latency}ms)`,
        };
    } catch (err) {
        const latency = Date.now() - start;
        return { name: 'Telegram Bot', ok: false, detail: `Error: ${err.message} (${latency}ms)` };
    }
}

async function checkSSL(url, name) {
    const start = Date.now();

    try {
        // Ensure we're testing HTTPS
        const httpsUrl = url.replace(/^http:/, 'https:');
        const res = await fetch(httpsUrl, { redirect: 'manual' });
        const latency = Date.now() - start;

        return {
            name,
            ok: true,
            detail: `Secure (${res.status}) (${latency}ms)`,
        };
    } catch (err) {
        const latency = Date.now() - start;
        return { name, ok: false, detail: `SSL Error: ${err.message} (${latency}ms)` };
    }
}

// ─── Report Builder ─────────────────────────────────────────────

function buildReport(results, passed, failed, totalTime) {
    const now = new Date();
    // Format date in UTC+4
    const utc4 = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const dateStr = utc4.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
    const timeStr = utc4.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
    });

    let msg = `🐱 *Pusheen Wallet — Daily Monitor*\n`;
    msg += `📅 ${dateStr} — ${timeStr} (UTC+4)\n\n`;

    for (const r of results) {
        const icon = r.ok ? '✅' : '❌';
        msg += `${icon} *${r.name}* — ${r.detail}\n`;
    }

    msg += `\n⏱️ Total check time: ${totalTime}s\n`;

    if (failed === 0) {
        msg += `📊 All ${passed} tests passed! 🎉`;
    } else {
        msg += `⚠️ ${failed}/${passed + failed} tests FAILED!`;
    }

    return msg;
}

// ─── Telegram Sender ────────────────────────────────────────────

async function sendTelegram(botToken, chatId, text) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown',
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('Telegram send error:', errBody);
        }
    } catch (err) {
        console.error('Failed to send Telegram notification:', err);
    }
}
