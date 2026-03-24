import { getDb } from './client'
import { toLocalISO } from '../lib/dates'

// ---------- projects ----------
export async function listProjects(userId) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY sort_order, id`,
    [userId],
  )
  return rows
}

export async function createProject(userId, data) {
  const db = getDb()
  const { rows: max } = await db.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM projects WHERE user_id = $1`,
    [userId],
  )
  const { rows } = await db.query(
    `INSERT INTO projects (user_id, title, description, start_date, end_date, icon, color, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      userId,
      data.title,
      data.description,
      data.start_date || null,
      data.end_date || null,
      data.icon || null,
      data.color || null,
      max[0].next,
    ],
  )
  return rows[0]
}

export async function updateProject(id, userId, data) {
  const db = getDb()
  const sets = []
  const vals = []
  let i = 1
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  vals.push(id, userId)
  await db.query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
    vals,
  )
}

export async function reorderProjects(userId, orderedIds) {
  const db = getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await db.query(
      `UPDATE projects SET sort_order = $1 WHERE id = $2 AND user_id = $3`,
      [i, orderedIds[i], userId],
    )
  }
}

// ---------- tasks ----------
export async function listTasks(userId) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM tasks WHERE user_id = $1 ORDER BY id`,
    [userId],
  )
  return rows
}

export async function createTask(userId, data) {
  const db = getDb()
  const { rows } = await db.query(
    `INSERT INTO tasks (user_id, project_id, description, start_datetime, end_datetime, priority, completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      userId,
      data.project_id ?? null,
      data.description,
      data.start_datetime ?? null,
      data.end_datetime ?? null,
      data.priority ?? null,
      data.completed ?? false,
    ],
  )
  return rows[0]
}

export async function updateTask(id, userId, data) {
  const db = getDb()
  const sets = []
  const vals = []
  let i = 1
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  vals.push(id, userId)
  await db.query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
    vals,
  )
}

export async function duplicateTask(id, userId) {
  const db = getDb()
  const { rows } = await db.query(
    `INSERT INTO tasks (user_id, project_id, description, start_datetime, end_datetime, priority, completed)
     SELECT user_id, project_id, description, start_datetime, end_datetime, priority, completed
     FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId],
  )
  return rows[0]
}

export async function deleteTask(id, userId) {
  const db = getDb()
  await db.query(`DELETE FROM tasks WHERE id = $1 AND user_id = $2`, [id, userId])
}

// ---------- values ----------
export async function listValues(userId) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM user_values WHERE user_id = $1 ORDER BY name`,
    [userId],
  )
  return rows
}

export async function createValue(userId, data) {
  const db = getDb()
  const { rows } = await db.query(
    `INSERT INTO user_values (user_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
    [userId, data.name, data.description || null],
  )
  return rows[0]
}

export async function deleteValue(id, userId) {
  const db = getDb()
  await db.query(`DELETE FROM user_values WHERE id = $1 AND user_id = $2`, [id, userId])
}

// ---------- check-ins ----------
export async function getCheckIn(userId, month) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM check_ins WHERE user_id = $1 AND month = $2`,
    [userId, month],
  )
  if (rows[0]) return rows[0]
  const { rows: created } = await db.query(
    `INSERT INTO check_ins (user_id, month) VALUES ($1, $2) RETURNING *`,
    [userId, month],
  )
  return created[0]
}

export async function saveCheckIn(id, userId, data) {
  const db = getDb()
  const sets = []
  const vals = []
  let i = 1
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  vals.push(id, userId)
  await db.query(
    `UPDATE check_ins SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
    vals,
  )
}

// ---------- journal ----------
export async function getJournalEntry(userId, date) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT je.*, COALESCE(array_agg(jev.value_id) FILTER (WHERE jev.value_id IS NOT NULL), '{}') AS value_ids
     FROM journal_entries je
     LEFT JOIN journal_entry_values jev ON jev.journal_entry_id = je.id
     WHERE je.user_id = $1 AND je.entry_date = $2
     GROUP BY je.id`,
    [userId, date],
  )
  return rows[0] ?? null
}

export async function saveJournalEntry(userId, date, entry, valueIds) {
  const db = getDb()
  const {
    rows: [je],
  } = await db.query(
    `INSERT INTO journal_entries (user_id, entry_date, entry, last_edited)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, entry_date)
     DO UPDATE SET entry = $3, last_edited = NOW()
     RETURNING id`,
    [userId, date, entry],
  )
  await db.query(`DELETE FROM journal_entry_values WHERE journal_entry_id = $1`, [je.id])
  for (const vid of valueIds) {
    await db.query(
      `INSERT INTO journal_entry_values (journal_entry_id, value_id) VALUES ($1, $2)`,
      [je.id, vid],
    )
  }
}

// ---------- habits ----------
export async function listHabits(userId) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT h.*,
       COUNT(hi.id) FILTER (WHERE hi.datetime <= NOW()) AS total,
       COUNT(hi.id) FILTER (WHERE hi.datetime <= NOW() AND hi.completed) AS done
     FROM habits h
     LEFT JOIN habit_instances hi ON hi.habit_id = h.id
     WHERE h.user_id = $1
     GROUP BY h.id
     ORDER BY h.description`,
    [userId],
  )
  return rows
}

export async function deleteHabit(id, userId) {
  const db = getDb()
  await db.query(`DELETE FROM habits WHERE id = $1 AND user_id = $2`, [id, userId])
}

export async function setHabitDormant(id, userId, dormant) {
  const db = getDb()
  await db.query(`UPDATE habits SET dormant = $1 WHERE id = $2 AND user_id = $3`, [
    dormant,
    id,
    userId,
  ])
  if (dormant) {
    // delete future instances
    await db.query(
      `DELETE FROM habit_instances WHERE habit_id = $1 AND user_id = $2 AND datetime > NOW()`,
      [id, userId],
    )
  }
}

export async function listHabitInstances(userId, from, to) {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT hi.*, h.description, h.value_id
     FROM habit_instances hi
     JOIN habits h ON h.id = hi.habit_id
     WHERE hi.user_id = $1 AND hi.datetime >= $2 AND hi.datetime < $3
     ORDER BY hi.datetime`,
    [userId, from, to],
  )
  return rows
}

export async function toggleHabitInstance(id, userId, completed) {
  const db = getDb()
  await db.query(
    `UPDATE habit_instances SET completed = $1 WHERE id = $2 AND user_id = $3`,
    [completed, id, userId],
  )
}

export async function createHabit(userId, data) {
  const db = getDb()
  const {
    rows: [habit],
  } = await db.query(
    `INSERT INTO habits (user_id, value_id, description, frequency, day_of_week, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      userId,
      data.value_id,
      data.description,
      data.frequency,
      data.frequency === 'weekly' ? data.day_of_week : null,
      data.start_date,
      data.end_date || null,
    ],
  )
  // generate instances
  const start = new Date(data.start_date)
  const end = data.end_date
    ? new Date(data.end_date)
    : new Date(Date.now() + 28 * 86400000)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (data.frequency === 'weekly' && d.getDay() !== Number(data.day_of_week)) continue
    const inst = new Date(d)
    inst.setHours(0, 0, 0, 0)
    await db.query(
      `INSERT INTO habit_instances (habit_id, user_id, datetime) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [habit.id, userId, toLocalISO(inst)],
    )
  }
  return habit
}
