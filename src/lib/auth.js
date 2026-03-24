import { getDb } from '../db/client'

const KEY = 'focus-planner:userId'

export async function getCurrentUser() {
  const id = localStorage.getItem(KEY)
  if (!id) return null
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [Number(id)])
  return rows[0] ?? null
}

export async function login(username, password) {
  const db = getDb()
  const { rows } = await db.query(
    'SELECT * FROM users WHERE username = $1 AND password = $2',
    [username, password],
  )
  const user = rows[0]
  if (user) localStorage.setItem(KEY, String(user.id))
  return user ?? null
}

export async function logout() {
  localStorage.removeItem(KEY)
}

export async function updateUser(id, data) {
  const db = getDb()
  const sets = []
  const vals = []
  let i = 1
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  vals.push(id)
  await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, vals)
}

export async function register(username, password) {
  const db = getDb()
  const { rows } = await db.query(
    `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *`,
    [username, password],
  )
  localStorage.setItem(KEY, String(rows[0].id))
  return rows[0]
}
