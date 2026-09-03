// Server-side MongoDB access for AarogyaGPT API routes.
// Connection is lazy + cached; all calls degrade gracefully when DB is down.

import { MongoClient } from 'mongodb'

const DB_NAME = process.env.DB_NAME || 'aarogya'
const CONNECT_TIMEOUT = 5000

let client = null
let db = null
let connecting = null

export function isConfigured() {
  return !!process.env.MONGO_URL
}

async function connect() {
  if (db) return db
  if (connecting) return connecting

  connecting = (async () => {
    const c = new MongoClient(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT,
      connectTimeoutMS: CONNECT_TIMEOUT,
    })
    await c.connect()
    client = c
    db = c.db(DB_NAME)
    await ensureIndexes(db)
    return db
  })()

  try {
    return await connecting
  } catch (err) {
    connecting = null // allow retry on next request
    throw err
  }
}

async function ensureIndexes(database) {
  await Promise.allSettled([
    database.collection('health_checks').createIndex({ userId: 1, createdAt: -1 }),
    database.collection('health_checks').createIndex({ userId: 1, id: 1 }, { unique: true }),
    database.collection('reminders').createIndex({ userId: 1, createdAt: -1 }),
    database.collection('reminders').createIndex({ userId: 1, id: 1 }, { unique: true }),
    database.collection('profiles').createIndex({ userId: 1 }, { unique: true }),
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
  ])
}

// Every route wraps DB work in this: 'unavailable' flows to the caller as a
// typed error so the API can respond 503 and the client can fall back.
export async function withDb(fn) {
  if (!isConfigured()) {
    const err = new Error('MONGO_URL is not configured')
    err.code = 'DB_NOT_CONFIGURED'
    throw err
  }
  try {
    return await fn(await connect())
  } catch (e) {
    if (client && ['MongoNetworkError', 'MongoServerSelectionError', 'MongoNotConnectedError'].some((code) => e?.name === code || String(e?.message).includes(code))) {
      try { await client.close() } catch {}
      client = null
      db = null
      e.dbDown = true
    }
    throw e
  }
}
