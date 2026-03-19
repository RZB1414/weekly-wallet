/**
 * Weekly Wallet — Main Server
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

app.get('/', (c) => c.text('🐱 Weekly Wallet Backend is Alive!'))
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
app.use('/api/user/*', authMiddleware())

// ──────────────────────────────────────────────
// Helper: get user's DEK for encryption/decryption
// ──────────────────────────────────────────────
async function getUserDEK(c) {
  const tokenWrappedDEK = c.get('tokenWrappedDEK')
  if (!tokenWrappedDEK) {
    throw new Error('No Data Encryption Key present in session token')
  }

  // Unwrap the stateless session DEK using the server's internal wrapping key
  const serverSecret = c.env.JWT_SECRET
  const tokenWrappingKey = await deriveKey(
    serverSecret,
    'server-internal-salt',
    'pusheen-wallet-token-wrap'
  )

  const dekBase64 = await unwrapKey(tokenWrappedDEK, tokenWrappingKey)
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

const REFUNDS_CATEGORY_NAME = 'Refunds'
const REFUNDS_CATEGORY_ALIASES = new Set(['refunds', 'refounds'])

function isRefundsCategory(categoryName = '') {
  return REFUNDS_CATEGORY_ALIASES.has(String(categoryName).trim().toLowerCase())
}

function normalizeRefundsCategoryName(categoryName = '') {
  return isRefundsCategory(categoryName) ? REFUNDS_CATEGORY_NAME : categoryName
}

function normalizeRefundExpense(expense) {
  if (!expense) return expense

  return {
    ...expense,
    category: normalizeRefundsCategoryName(expense.category),
    refundTargetCategory: normalizeRefundsCategoryName(expense.refundTargetCategory),
  }
}

function dedupeRefundExpenses(expenses = []) {
  const normalizedExpenses = expenses.map((expense) => normalizeRefundExpense(expense))
  const consumedExpenseIds = new Set()
  const dedupedExpenses = []

  normalizedExpenses.forEach((expense, index) => {
    if (!expense || consumedExpenseIds.has(expense.id)) {
      return
    }

    if (expense.type === 'credit' && isRefundsCategory(expense.category) && !expense.refundTargetCategory) {
      const linkedExpense = normalizedExpenses.find((candidate, candidateIndex) => {
        if (candidateIndex === index || !candidate || consumedExpenseIds.has(candidate.id)) {
          return false
        }

        return (
          candidate.type === 'credit' &&
          !isRefundsCategory(candidate.category) &&
          candidate.date === expense.date &&
          Number(candidate.amount) === Number(expense.amount) &&
          candidate.name === `${expense.name} → ${candidate.category}`
        )
      })

      if (linkedExpense) {
        consumedExpenseIds.add(linkedExpense.id)
        dedupedExpenses.push({
          ...expense,
          refundTargetCategory: linkedExpense.category,
        })
        return
      }
    }

    dedupedExpenses.push(expense)
  })

  return dedupedExpenses
}

function normalizeWeeksData(payload = {}) {
  return {
    ...payload,
    weeks: Array.isArray(payload.weeks)
      ? payload.weeks.map((week) => ({
          ...week,
          expenses: Array.isArray(week?.expenses)
            ? dedupeRefundExpenses(week.expenses)
            : [],
        }))
      : [],
  }
}

function normalizeMonthlyPlanningData(payload = {}) {
  const normalizedCategories = Array.isArray(payload.categories)
    ? payload.categories.map((category) => {
        if (typeof category === 'string') {
          return normalizeRefundsCategoryName(category)
        }

        if (!category || typeof category !== 'object') {
          return category
        }

        return {
          ...category,
          name: normalizeRefundsCategoryName(category.name),
        }
      })
    : []

  const dedupedCategories = normalizedCategories.filter((category, index, list) => {
    const categoryName = typeof category === 'string' ? category : category?.name

    if (!isRefundsCategory(categoryName)) {
      return true
    }

    return list.findIndex((candidate) => {
      const candidateName = typeof candidate === 'string' ? candidate : candidate?.name
      return isRefundsCategory(candidateName)
    }) === index
  })

  const hasRefundsCategory = dedupedCategories.some((category) => {
    const categoryName = typeof category === 'string' ? category : category?.name
    return isRefundsCategory(categoryName)
  })

  if (!hasRefundsCategory) {
    dedupedCategories.push({
      name: REFUNDS_CATEGORY_NAME,
      budget: 0,
      type: 'credit',
      frequency: 'monthly',
    })
  }

  return {
    ...payload,
    categories: dedupedCategories.map((category) => {
      if (typeof category === 'string') {
        return normalizeRefundsCategoryName(category)
      }

      if (!category || typeof category !== 'object') {
        return category
      }

      if (isRefundsCategory(category.name)) {
        return {
          ...category,
          name: REFUNDS_CATEGORY_NAME,
          type: 'credit',
          frequency: category.frequency || 'monthly',
          budget: category.budget || 0,
        }
      }

      return category
    }),
    expenses: Array.isArray(payload.expenses)
      ? dedupeRefundExpenses(payload.expenses)
      : [],
  }
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
    const normalizedData = normalizeWeeksData(data || { weeks: [] })

    if (data && JSON.stringify(data) !== JSON.stringify(normalizedData)) {
      await encryptedPut(bucket, `${userId}/weeks-data.json`, normalizedData, dek)
    }

    return c.json(normalizedData)
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
    await encryptedPut(bucket, `${userId}/weeks-data.json`, normalizeWeeksData(body), dek)
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
    const normalizedData = normalizeMonthlyPlanningData(data || { categories: [], expenses: [], salary: 0 })

    if (data && JSON.stringify(data) !== JSON.stringify(normalizedData)) {
      await encryptedPut(
        bucket,
        `${userId}/monthly-planning-${year}-${month}.json`,
        normalizedData,
        dek
      )
    }

    return c.json(normalizedData)
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
      normalizeMonthlyPlanningData(body),
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
// GET /api/user/profile
// ──────────────────────────────────────────────
app.get('/api/user/profile', async (c) => {
  const email = c.get('email')
  const bucket = c.env.WEEKLY_WALLET_BUCKET

  try {
    const key = `users/${email.toLowerCase()}.json`
    const obj = await bucket.get(key)
    if (!obj) {
      return c.json({ error: 'User not found' }, 404)
    }

    const user = await obj.json()
    return c.json({ id: user.id, email: user.email, avatar: user.avatar || '/no-avatar.jpg', customTabs: user.customTabs, projectionMonths: user.projectionMonths })
  } catch (err) {
    console.error('Error reading profile:', err)
    return c.json({ error: 'Failed to read profile' }, 500)
  }
})

// ──────────────────────────────────────────────
// POST /api/user/profile
// ──────────────────────────────────────────────
app.post('/api/user/profile', async (c) => {
  const email = c.get('email')
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const body = await c.req.json()

  try {
    const key = `users/${email.toLowerCase()}.json`
    const obj = await bucket.get(key)
    if (!obj) {
      return c.json({ error: 'User not found' }, 404)
    }

    const user = await obj.json()

    // Only update supported profile fields
    if (body.avatar !== undefined) {
      user.avatar = body.avatar
    }
    if (body.customTabs !== undefined) {
      user.customTabs = body.customTabs
    }
    if (body.projectionMonths !== undefined) {
      user.projectionMonths = body.projectionMonths
    }

    user.updatedAt = new Date().toISOString()
    await bucket.put(key, JSON.stringify(user))

    return c.json({ success: true, user: { id: user.id, email: user.email, avatar: user.avatar, customTabs: user.customTabs, projectionMonths: user.projectionMonths } })
  } catch (err) {
    console.error('Error updating profile:', err)
    return c.json({ error: 'Failed to update profile' }, 500)
  }
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

            await reply(`✅ Account linked successfully!\n\n🐱 Welcome, you're now connected to Weekly Wallet.\n\nYou will receive password reset codes here.`)
            return c.json({ ok: true })
          }
        }
      }

      // No matching account found
      await reply('🐱 Welcome to Weekly Wallet Bot!\n\nTo link your account:\n1. Register with your Telegram username in the app\n2. Come back here and send /start\n\nOr send a 6-digit code from the app menu → "Link Telegram".')
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
