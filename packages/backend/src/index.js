/**
 * Pusheen Wallet — Main Server
 * 
 * Hono on Cloudflare Workers with R2 storage.
 * All data routes require JWT auth and use AES-256-GCM encryption.
 * Data is scoped per user (R2 keys prefixed with userId).
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './auth.js'
import { authMiddleware } from './middleware.js'
import {
  deriveKey,
  unwrapKey,
  importDEK,
  encryptData,
  decryptData,
} from './crypto.js'

const app = new Hono()

app.get('/', (c) => c.text('🐱 Pusheen Wallet Backend is Alive!'))
app.use('/*', cors())

// ──────────────────────────────────────────────
// Public Routes — Auth
// ──────────────────────────────────────────────
app.route('/api/auth', auth)

// ──────────────────────────────────────────────
// Protected Routes — All below require JWT
// ──────────────────────────────────────────────
app.use('/api/weeks', authMiddleware())
app.use('/api/weeks/*', authMiddleware())
app.use('/api/monthly-planning/*', authMiddleware())
app.use('/api/monthly-plannings', authMiddleware())

// ──────────────────────────────────────────────
// Helper: get user's DEK for encryption/decryption
// ──────────────────────────────────────────────
async function getUserDEK(c) {
  const email = c.get('email')
  const bucket = c.env.WEEKLY_WALLET_BUCKET

  // Read user record to get passwordWrappedDEK
  const userObj = await bucket.get(`users/${email}.json`)
  if (!userObj) throw new Error('User record not found')
  const user = await userObj.json()

  // We use the recovery key (server-side) to unwrap DEK for data operations
  // This avoids needing the user's password on every API call
  const recoveryKey = await deriveKey(
    c.env.JWT_SECRET,
    email,
    'pusheen-wallet-recovery-wrap'
  )
  const dekBase64 = await unwrapKey(user.recoveryWrappedDEK, recoveryKey)
  return importDEK(dekBase64)
}

// ──────────────────────────────────────────────
// Helper: encrypted R2 read/write
// ──────────────────────────────────────────────
async function encryptedGet(bucket, key, dek) {
  const obj = await bucket.get(key)
  if (!obj) return null
  const encrypted = await obj.text()
  const plaintext = await decryptData(encrypted, dek)
  return JSON.parse(plaintext)
}

async function encryptedPut(bucket, key, data, dek) {
  const plaintext = JSON.stringify(data)
  const encrypted = await encryptData(plaintext, dek)
  await bucket.put(key, encrypted)
}

// ──────────────────────────────────────────────
// GET /api/weeks
// ──────────────────────────────────────────────
app.get('/api/weeks', async (c) => {
  const userId = c.get('userId')
  const bucket = c.env.WEEKLY_WALLET_BUCKET

  try {
    const dek = await getUserDEK(c)
    const data = await encryptedGet(bucket, `${userId}/weeks-data.json`, dek)
    return c.json(data || { weeks: [] })
  } catch (err) {
    console.error('Error reading weeks:', err)
    return c.json({ weeks: [] })
  }
})

// ──────────────────────────────────────────────
// POST /api/weeks
// ──────────────────────────────────────────────
app.post('/api/weeks', async (c) => {
  const userId = c.get('userId')
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const body = await c.req.json()

  try {
    const dek = await getUserDEK(c)
    await encryptedPut(bucket, `${userId}/weeks-data.json`, body, dek)
    return c.json({ success: true })
  } catch (err) {
    console.error('Error saving weeks:', err)
    return c.json({ error: 'Failed to save' }, 500)
  }
})

// ──────────────────────────────────────────────
// GET /api/monthly-planning/:year/:month
// ──────────────────────────────────────────────
app.get('/api/monthly-planning/:year/:month', async (c) => {
  const userId = c.get('userId')
  const { year, month } = c.req.param()
  const bucket = c.env.WEEKLY_WALLET_BUCKET

  try {
    const dek = await getUserDEK(c)
    const data = await encryptedGet(
      bucket,
      `${userId}/monthly-planning-${year}-${month}.json`,
      dek
    )
    return c.json(data || { categories: [], expenses: [], salary: 0 })
  } catch (err) {
    console.error('Error reading monthly planning:', err)
    return c.json({ categories: [], expenses: [], salary: 0 })
  }
})

// ──────────────────────────────────────────────
// POST /api/monthly-planning/:year/:month
// ──────────────────────────────────────────────
app.post('/api/monthly-planning/:year/:month', async (c) => {
  const userId = c.get('userId')
  const { year, month } = c.req.param()
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const body = await c.req.json()

  try {
    const dek = await getUserDEK(c)
    await encryptedPut(
      bucket,
      `${userId}/monthly-planning-${year}-${month}.json`,
      body,
      dek
    )
    return c.json({ success: true })
  } catch (err) {
    console.error('Error saving monthly planning:', err)
    return c.json({ error: 'Failed to save' }, 500)
  }
})

// ──────────────────────────────────────────────
// GET /api/monthly-plannings
// ──────────────────────────────────────────────
app.get('/api/monthly-plannings', async (c) => {
  const userId = c.get('userId')
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const prefix = `${userId}/monthly-planning-`
  const listed = await bucket.list({ prefix })

  const plans = listed.objects.map(obj => {
    const match = obj.key.match(/monthly-planning-(\d{4})-(\d{1,2})\.json/)
    if (match) {
      return { year: parseInt(match[1]), month: parseInt(match[2]) }
    }
    return null
  }).filter(p => p !== null)

  plans.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })

  return c.json({ plans })
})

// ──────────────────────────────────────────────
// POST /api/telegram/webhook
// Receives messages from Telegram Bot for account linking
// ──────────────────────────────────────────────
app.post('/api/telegram/webhook', async (c) => {
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const botToken = c.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    return c.json({ ok: false, error: 'Bot not configured' }, 500)
  }

  try {
    const update = await c.req.json()
    const message = update.message

    if (!message || !message.text) {
      return c.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim()

    // Helper to reply via Telegram
    const reply = async (replyText) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: replyText }),
      })
    }

    // Handle /start command (including deep links like /start link)
    if (text === '/start' || text.startsWith('/start ')) {
      const senderUsername = message.from?.username

      if (senderUsername) {
        const indexKey = `telegram-index/${senderUsername.toLowerCase()}.json`
        const indexObj = await bucket.get(indexKey)

        if (indexObj) {
          const { email } = await indexObj.json()
          const userObj = await bucket.get(`users/${email}.json`)

          if (userObj) {
            const user = await userObj.json()
            user.telegramChatId = chatId
            user.telegramLinkedAt = new Date().toISOString()
            await bucket.put(`users/${email}.json`, JSON.stringify(user))

            await reply(`✅ Account linked successfully!\n\n🐱 Welcome, you're now connected to Pusheen Wallet.\n\nYou will receive password reset codes here.`)
            return c.json({ ok: true })
          }
        }
      }

      // No matching account found
      await reply('🐱 Welcome to Pusheen Wallet Bot!\n\nTo link your account:\n1. Register with your Telegram username in the app\n2. Come back here and send /start\n\nOr send a 6-digit code from the app menu → "Link Telegram".')
      return c.json({ ok: true })
    }

    // Check if the message is a 6-digit code
    if (/^\d{6}$/.test(text)) {
      const linkObj = await bucket.get(`telegram-links/${text}.json`)

      if (!linkObj) {
        await reply('❌ Invalid or expired code.\n\nGenerate a new one from the app menu → "Link Telegram".')
        return c.json({ ok: true })
      }

      const linkData = await linkObj.json()

      // Check expiry
      if (Date.now() > linkData.expiry) {
        await bucket.delete(`telegram-links/${text}.json`)
        await reply('⏰ This code has expired.\n\nGenerate a new one from the app menu.')
        return c.json({ ok: true })
      }

      // Link the Telegram chat to the user
      const userObj = await bucket.get(`users/${linkData.email}.json`)
      if (!userObj) {
        await reply('❌ User not found. Please try again.')
        return c.json({ ok: true })
      }

      const user = await userObj.json()
      user.telegramChatId = chatId
      user.telegramLinkedAt = new Date().toISOString()
      await bucket.put(`users/${linkData.email}.json`, JSON.stringify(user))

      // Clean up the linking code
      await bucket.delete(`telegram-links/${text}.json`)

      await reply('✅ Account linked successfully!\n\n🐱 You will now receive password reset codes here.')
      return c.json({ ok: true })
    }

    // Unknown message
    await reply('🐱 Send me a 6-digit code from the app to link your account.\n\nGo to app menu → "Link Telegram" to get a code.')
    return c.json({ ok: true })

  } catch (err) {
    console.error('Telegram webhook error:', err)
    return c.json({ ok: true }) // Always return 200 to Telegram
  }
})

export default app
