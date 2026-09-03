// Dev-only in-memory MongoDB for local development and testing.
// Usage: node scripts/dev-mongo.cjs  → runs mongod on 127.0.0.1:27017
// Then: MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=aarogya npm run dev
const { MongoMemoryServer } = require('mongodb-memory-server')

async function main() {
  console.log('Starting in-memory MongoDB (first run downloads the mongod binary)...')
  const mongod = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1', port: 27017, dbName: 'aarogya' },
  })
  const uri = mongod.getUri('aarogya')
  console.log('✅ In-memory MongoDB ready:', uri)
  console.log('   Set MONGO_URL=' + uri.slice(0, uri.lastIndexOf('/')) + '  DB_NAME=aarogya')
  console.log('   Press Ctrl+C to stop.')

  const shutdown = async () => {
    console.log('\nStopping...')
    await mongod.stop().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((e) => {
  console.error('Failed to start in-memory MongoDB:', e.message)
  process.exit(1)
})
