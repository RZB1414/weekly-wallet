import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors())

app.get('/api/weeks', async (c) => {
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const object = await bucket.get('weeks-data.json')

  if (!object) {
    return c.json({ weeks: [] })
  }

  const data = await object.json()
  return c.json(data)
})

app.post('/api/weeks', async (c) => {
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const body = await c.req.json()

  await bucket.put('weeks-data.json', JSON.stringify(body))
  return c.json({ success: true })
})

app.get('/api/monthly-planning/:year/:month', async (c) => {
  const { year, month } = c.req.param()
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const object = await bucket.get(`monthly-planning-${year}-${month}.json`)

  if (!object) {
    return c.json({ categories: [], expenses: [], salary: 0 })
  }

  const data = await object.json()
  return c.json(data)
})

app.post('/api/monthly-planning/:year/:month', async (c) => {
  const { year, month } = c.req.param()
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const body = await c.req.json()

  await bucket.put(`monthly-planning-${year}-${month}.json`, JSON.stringify(body))
  return c.json({ success: true })
})

app.get('/api/monthly-plannings', async (c) => {
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const options = { prefix: 'monthly-planning-' }
  const listed = await bucket.list(options)

  const plans = listed.objects.map(obj => {
    // Extract year and month from 'monthly-planning-YYYY-MM.json'
    const match = obj.key.match(/monthly-planning-(\d{4})-(\d{1,2})\.json/)
    if (match) {
      return { year: parseInt(match[1]), month: parseInt(match[2]) }
    }
    return null
  }).filter(p => p !== null)

  // Sort by date descending
  plans.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })

  return c.json({ plans })
})

export default app
