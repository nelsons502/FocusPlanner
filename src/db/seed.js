export async function seed(db) {
  const { rows: existing } = await db.query('SELECT id FROM users LIMIT 1')
  if (existing.length) return

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const dt = (dayOffset, h, m = 0) => {
    const d = new Date(today)
    d.setDate(d.getDate() + dayOffset)
    d.setHours(h, m, 0, 0)
    return `${iso(d)}T${pad(h)}:${pad(m)}:00`
  }

  // user
  const {
    rows: [user],
  } = await db.query(
    `INSERT INTO users (username, password) VALUES ('test', 'test') RETURNING id`,
  )
  const uid = user.id

  // projects
  const projects = [
    ['Launch side project', 'Ship v1 of the habit-tracking Chrome extension', '🚀', '#6366f1'],
    ['Learn Spanish', 'Reach conversational B1 level', '🇪🇸', '#10b981'],
    ['Home renovation', 'Finish the kitchen remodel', '🏠', '#f59e0b'],
    ['Read 12 books', 'One book per month this year', '📚', '#8b5cf6'],
  ]
  const projIds = []
  for (let i = 0; i < projects.length; i++) {
    const [title, desc, icon, color] = projects[i]
    const {
      rows: [p],
    } = await db.query(
      `INSERT INTO projects (user_id, title, description, icon, color, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uid, title, desc, icon, color, i],
    )
    projIds.push(p.id)
  }

  // set focus project
  await db.query('UPDATE users SET focus_project_id = $1 WHERE id = $2', [projIds[0], uid])

  // tasks
  const tasks = [
    [projIds[0], 'Design popup UI mockup', dt(0, 9), dt(0, 10, 30), 'Important', false],
    [projIds[0], 'Set up manifest.json', dt(1, 14), dt(1, 15), 'Urgent', false],
    [projIds[0], 'Write storage layer', null, null, 'Important', false],
    [projIds[0], 'Research publishing to Chrome Web Store', null, null, 'Delegate', false],
    [projIds[1], 'Duolingo 20min', dt(0, 7, 30), dt(0, 8), 'Regulate', true],
    [projIds[1], 'Watch one episode of Spanish show', dt(2, 20), dt(2, 21), 'Regulate', false],
    [projIds[1], 'Book tutor session', null, null, 'Important', false],
    [projIds[2], 'Get quotes from contractors', dt(1, 10), dt(1, 11), 'Urgent', false],
    [projIds[2], 'Pick cabinet hardware', null, null, null, false],
    [projIds[3], 'Finish chapter 4', dt(0, 21), dt(0, 22), 'Regulate', false],
    [null, 'Call dentist', dt(3, 9), dt(3, 9, 30), 'Delegate', false],
    [null, 'Return library books', null, null, null, false],
  ]
  for (const [pid, desc, start, end, prio, done] of tasks) {
    await db.query(
      `INSERT INTO tasks (user_id, project_id, description, start_datetime, end_datetime, priority, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uid, pid, desc, start, end, prio, done],
    )
  }

  // values
  const values = [
    ['Health', 'Physical and mental wellbeing'],
    ['Growth', 'Continuous learning and self-improvement'],
    ['Connection', 'Relationships with family and friends'],
  ]
  const valIds = []
  for (const [name, desc] of values) {
    const {
      rows: [v],
    } = await db.query(
      `INSERT INTO user_values (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
      [uid, name, desc],
    )
    valIds.push(v.id)
  }

  // habits + instances
  const habits = [
    [valIds[0], 'Morning run', 'daily', null],
    [valIds[0], 'Meditate 10 min', 'daily', null],
    [valIds[1], 'Read 30 pages', 'daily', null],
    [valIds[2], 'Call parents', 'weekly', 0],
  ]
  const start = new Date(today)
  start.setDate(start.getDate() - 7)
  for (const [vid, desc, freq, dow] of habits) {
    const {
      rows: [h],
    } = await db.query(
      `INSERT INTO habits (user_id, value_id, description, frequency, day_of_week, start_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uid, vid, desc, freq, dow, iso(start)],
    )
    // generate instances: 7 days back to 28 days forward
    for (let d = -7; d <= 28; d++) {
      const inst = new Date(today)
      inst.setDate(inst.getDate() + d)
      inst.setHours(0, 0, 0, 0)
      if (freq === 'weekly' && inst.getDay() !== dow) continue
      await db.query(
        `INSERT INTO habit_instances (habit_id, user_id, datetime, completed)
         VALUES ($1, $2, $3, $4)`,
        [h.id, uid, `${iso(inst)}T00:00:00`, d < 0 && Math.random() > 0.3],
      )
    }
  }

  // check-ins for current + next month
  const m1 = new Date(today.getFullYear(), today.getMonth(), 1)
  const m2 = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  for (const m of [m1, m2]) {
    await db.query(`INSERT INTO check_ins (user_id, month) VALUES ($1, $2)`, [uid, iso(m)])
  }
}
