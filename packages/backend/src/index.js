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

app.get('/api/monthly-planning', async (c) => {
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const object = await bucket.get('monthly-planning.json')

  if (!object) {
    return c.json({ categories: [], expenses: [] })
  }

  const data = await object.json()
  return c.json(data)
})

app.post('/api/monthly-planning', async (c) => {
  const bucket = c.env.WEEKLY_WALLET_BUCKET
  const body = await c.req.json()

  await bucket.put('monthly-planning.json', JSON.stringify(body))
  return c.json({ success: true })
})

export default app
