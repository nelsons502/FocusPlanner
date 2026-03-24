import { PGlite } from '@electric-sql/pglite'
import schema from './schema.sql?raw'
import { seed } from './seed'

let db = null
let initPromise = null

export function initDb() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    db = await PGlite.create('idb://focus-planner')
    await db.exec(schema)
    await seed(db)
    return db
  })()
  return initPromise
}

export function getDb() {
  if (!db) throw new Error('DB not initialized')
  return db
}
