import { useEffect, useMemo, useRef, useState, useCallback, forwardRef } from 'react'
import {
  listTasks,
  listProjects,
  createTask,
  updateTask,
  listHabitInstances,
  toggleHabitInstance,
  createHabit,
  listValues,
} from '../db/queries'
import { hexToRgba } from '../lib/colors'
import { toLocalISO } from '../lib/dates'

const PRIORITIES = ['Urgent', 'Important', 'Delegate', 'Regulate']
const SLOT_PX = 40
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const startOfWeek = (d) => {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() - r.getDay())
  return r
}
const addDays = (d, n) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
const snap15 = (mins) => Math.round(mins / 15) * 15

function usePersist(key, init) {
  const [v, setV] = useState(() => {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : init
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(v)), [key, v])
  return [v, setV]
}

export default function CalendarView({ user }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showWeekends, setShowWeekends] = usePersist('cal:weekends', true)
  const [startHour, setStartHour] = usePersist('cal:startHour', 6)
  const [endHour, setEndHour] = usePersist('cal:endHour', 18)
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [habits, setHabits] = useState([])
  const [values, setValues] = useState([])
  const [taskModal, setTaskModal] = useState(null) // { mode, task?, start?, end? }
  const [habitModal, setHabitModal] = useState(false)
  const [habitsOpen, setHabitsOpen] = useState(true)
  const [, tick] = useState(0)

  // drag state: { type: 'sidebar'|'move'|'resize', taskId, ... }
  const drag = useRef(null)
  // live preview during move/resize: { taskId, start, end }
  const [preview, setPreview] = useState(null)
  // refs to day column DOM nodes for hit-testing
  const colRefs = useRef({})

  const weekEnd = addDays(weekStart, 7)
  const days = useMemo(() => {
    const all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    return showWeekends ? all : all.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
  }, [weekStart, showWeekends])

  async function reload() {
    setTasks(await listTasks(user.id))
    setProjects(await listProjects(user.id))
    setHabits(
      await listHabitInstances(user.id, toLocalISO(weekStart), toLocalISO(weekEnd)),
    )
    setValues(await listValues(user.id))
  }

  useEffect(() => {
    reload()
  }, [user.id, weekStart.getTime()])

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const projectColor = (id) => projects.find((p) => p.id === id)?.color

  const undated = useMemo(() => {
    const groups = {}
    for (const p of [...PRIORITIES, null]) groups[p ?? 'none'] = []
    for (const t of tasks) {
      if (t.start_datetime || t.completed) continue
      groups[t.priority ?? 'none'].push(t)
    }
    return groups
  }, [tasks])

  const scheduled = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.start_datetime) return false
        const d = new Date(t.start_datetime)
        return d >= weekStart && d < weekEnd
      }),
    [tasks, weekStart, weekEnd],
  )

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  // convert Y-offset in a day column to a Date, snapped to 15min
  const yToDate = useCallback(
    (day, y) => {
      const mins = snap15((y / SLOT_PX) * 30)
      const d = new Date(day)
      d.setHours(startHour, 0, 0, 0)
      d.setMinutes(d.getMinutes() + mins)
      return d
    },
    [startHour],
  )

  // find which day column the pointer is over
  function hitDay(clientX) {
    for (const d of days) {
      const el = colRefs.current[d.toDateString()]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX < r.right) return { day: d, rect: r }
    }
    return null
  }

  function handleSlotClick(day, e) {
    if (drag.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const start = yToDate(day, e.clientY - rect.top)
    const end = new Date(start.getTime() + 30 * 60000)
    setTaskModal({ mode: 'create', start, end })
  }

  // sidebar → calendar drop (HTML5 DnD)
  async function handleSidebarDrop(day, e) {
    e.preventDefault()
    const d = drag.current
    if (!d || d.type !== 'sidebar') return
    drag.current = null
    const rect = e.currentTarget.getBoundingClientRect()
    const start = yToDate(day, e.clientY - rect.top)
    const end = new Date(start.getTime() + 30 * 60000)
    await updateTask(d.taskId, user.id, {
      start_datetime: toLocalISO(start),
      end_datetime: toLocalISO(end),
    })
    reload()
  }

  // start move/resize: attach mousemove/mouseup listeners for live preview
  function startDrag(task, type, grabOffsetY = 0) {
    const s = new Date(task.start_datetime)
    const e = new Date(task.end_datetime || s.getTime() + 30 * 60000)
    drag.current = { type, taskId: task.id, duration: e - s, grabOffsetY, start: s }
    setPreview({ taskId: task.id, start: s, end: e })
    let moved = false

    function onMove(ev) {
      moved = true
      const hit = hitDay(ev.clientX)
      if (!hit) return
      const y = ev.clientY - hit.rect.top
      if (type === 'move') {
        const ns = yToDate(hit.day, y - grabOffsetY)
        setPreview({
          taskId: task.id,
          start: ns,
          end: new Date(ns.getTime() + drag.current.duration),
        })
      } else {
        const ne = yToDate(hit.day, y)
        if (ne > drag.current.start) {
          setPreview({ taskId: task.id, start: drag.current.start, end: ne })
        }
      }
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setPreview((cur) => {
        if (cur && moved) {
          updateTask(task.id, user.id, {
            start_datetime: toLocalISO(cur.start),
            end_datetime: toLocalISO(cur.end),
          }).then(reload)
        }
        return null
      })
      // delay clearing so the subsequent click event can see drag was active
      setTimeout(() => (drag.current = null), 0)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="h-full flex">
      <aside className="w-64 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 space-y-4 flex-shrink-0">
        <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">
          Unscheduled
        </h3>
        {[...PRIORITIES, 'none'].map((prio) => {
          const list = undated[prio] || []
          if (!list.length) return null
          return (
            <div key={prio}>
              <h4 className="text-xs font-medium text-slate-400 mb-1">
                {prio === 'none' ? 'No priority' : prio}
              </h4>
              <div className="space-y-1">
                {list.map((t) => {
                  const c = projectColor(t.project_id)
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => (drag.current = { type: 'sidebar', taskId: t.id })}
                      onDragEnd={() => (drag.current = null)}
                      onDoubleClick={() => setTaskModal({ mode: 'edit', task: t })}
                      className={`text-xs px-2 py-1.5 rounded cursor-move border border-slate-200 dark:border-slate-600 ${
                        c ? '' : 'bg-slate-100 dark:bg-slate-700'
                      }`}
                      style={c ? { backgroundColor: hexToRgba(c, 0.15) } : undefined}
                    >
                      {t.description}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {Object.values(undated).every((l) => !l.length) && (
          <p className="text-xs text-slate-400">All tasks scheduled ✓</p>
        )}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              ‹
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              ›
            </button>
          </div>
          <span className="font-semibold">
            {weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => setShowWeekends(e.target.checked)}
            />
            Weekends
          </label>
          <div className="flex items-center gap-1 text-sm">
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-1 py-0.5"
            >
              {Array.from({ length: 15 }, (_, i) => 4 + i)
                .filter((h) => h < endHour)
                .map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
            </select>
            –
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-1 py-0.5"
            >
              {Array.from({ length: 19 }, (_, i) => 4 + i)
                .filter((h) => h > startHour)
                .map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
            </select>
          </div>
          <button
            onClick={() => setHabitModal(true)}
            className="ml-auto px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            + Habit
          </button>
        </div>

        <div className="flex-1 overflow-auto select-none">
          <div
            className="grid min-w-full"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(120px, 1fr))` }}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-r border-slate-200 dark:border-slate-700" />
            {days.map((d) => {
              const today = sameDay(d, new Date())
              return (
                <div
                  key={d.toISOString()}
                  className={`sticky top-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 p-2 text-center ${
                    today ? 'bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="text-xs text-slate-500">{DAYS[d.getDay()]}</div>
                  <div className={`text-lg font-semibold ${today ? 'text-blue-600' : ''}`}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}

            <div className="border-b border-r border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <button
                onClick={() => setHabitsOpen(!habitsOpen)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                {habitsOpen ? '▾' : '▸'}
              </button>
            </div>
            {days.map((d) => {
              const dayHabits = habits.filter((h) => sameDay(new Date(h.datetime), d))
              return (
                <div
                  key={'h' + d.toISOString()}
                  className="border-b border-r border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800/50"
                >
                  {habitsOpen &&
                    dayHabits.map((h) => (
                      <label
                        key={h.id}
                        className="flex items-center gap-1 text-xs py-0.5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={h.completed}
                          onChange={async () => {
                            await toggleHabitInstance(h.id, user.id, !h.completed)
                            reload()
                          }}
                        />
                        <span className={h.completed ? 'line-through text-slate-400' : ''}>
                          {h.description}
                        </span>
                      </label>
                    ))}
                  {habitsOpen && !dayHabits.length && (
                    <div className="text-xs text-slate-300 dark:text-slate-600 text-center py-1">
                      —
                    </div>
                  )}
                </div>
              )
            })}

            <div className="border-r border-slate-200 dark:border-slate-700">
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-xs text-right pr-2 text-slate-400 border-b border-slate-100 dark:border-slate-800"
                  style={{ height: SLOT_PX * 2 }}
                >
                  {h}:00
                </div>
              ))}
            </div>
            {days.map((d) => (
              <DayColumn
                key={'c' + d.toISOString()}
                ref={(el) => (colRefs.current[d.toDateString()] = el)}
                day={d}
                hours={hours}
                startHour={startHour}
                endHour={endHour}
                tasks={scheduled.filter((t) => sameDay(new Date(t.start_datetime), d))}
                preview={preview}
                projectColor={projectColor}
                onSlotClick={(e) => handleSlotClick(d, e)}
                onDrop={(e) => handleSidebarDrop(d, e)}
                onMoveStart={(t, offsetY) => startDrag(t, 'move', offsetY)}
                onResizeStart={(t) => startDrag(t, 'resize')}
                onDoubleClick={(t) => setTaskModal({ mode: 'edit', task: t })}
                onToggle={async (t) => {
                  await updateTask(t.id, user.id, { completed: !t.completed })
                  reload()
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {taskModal && (
        <TaskModal
          projects={projects}
          initial={taskModal.task}
          defaultStart={taskModal.start}
          defaultEnd={taskModal.end}
          onClose={() => setTaskModal(null)}
          onSave={async (data) => {
            if (taskModal.mode === 'edit') {
              await updateTask(taskModal.task.id, user.id, data)
            } else {
              await createTask(user.id, data)
            }
            setTaskModal(null)
            reload()
          }}
        />
      )}
      {habitModal && (
        <HabitModal
          values={values}
          onClose={() => setHabitModal(false)}
          onSave={async (data) => {
            await createHabit(user.id, data)
            setHabitModal(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

const DayColumn = forwardRef(function DayColumn(
  {
    day,
    hours,
    startHour,
    endHour,
    tasks,
    preview,
    projectColor,
    onSlotClick,
    onDrop,
    onMoveStart,
    onResizeStart,
    onDoubleClick,
    onToggle,
  },
  ref,
) {
  const now = new Date()
  const isToday = sameDay(day, now)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nowY = ((nowMins - startHour * 60) / 30) * SLOT_PX
  const showNow = isToday && now.getHours() >= startHour && now.getHours() < endHour

  const toY = (d) => ((d.getHours() * 60 + d.getMinutes() - startHour * 60) / 30) * SLOT_PX

  return (
    <div
      ref={ref}
      className="relative border-r border-slate-200 dark:border-slate-700"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onSlotClick}
    >
      {hours.map((h) => (
        <div key={h} style={{ height: SLOT_PX * 2 }}>
          <div
            className="border-b border-slate-100 dark:border-slate-800"
            style={{ height: SLOT_PX }}
          />
          <div
            className="border-b border-slate-200 dark:border-slate-700"
            style={{ height: SLOT_PX }}
          />
        </div>
      ))}
      {showNow && (
        <div
          className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
          style={{ top: nowY }}
        >
          <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
        </div>
      )}
      {tasks.map((t) => {
        // use preview position if this task is being dragged
        const isPreview = preview?.taskId === t.id
        const s = isPreview ? preview.start : new Date(t.start_datetime)
        const e = isPreview
          ? preview.end
          : new Date(t.end_datetime || s.getTime() + 30 * 60000)
        // hide if preview moved to a different day
        if (isPreview && !sameDay(s, day)) return null
        const top = toY(s)
        const height = Math.max(SLOT_PX / 2, toY(e) - top)
        const c = projectColor(t.project_id)
        return (
          <div
            key={t.id}
            onMouseDown={(ev) => {
              if (ev.button !== 0 || ev.target.closest('input,.resize-handle')) return
              ev.stopPropagation()
              const rect = ev.currentTarget.getBoundingClientRect()
              onMoveStart(t, ev.clientY - rect.top)
            }}
            onDoubleClick={(ev) => {
              ev.stopPropagation()
              onDoubleClick(t)
            }}
            onClick={(ev) => ev.stopPropagation()}
            className={`absolute left-1 right-1 rounded px-1.5 py-0.5 text-xs overflow-hidden cursor-move border ${
              c
                ? 'border-current'
                : 'bg-slate-300 dark:bg-slate-600 border-slate-400 dark:border-slate-500'
            } ${t.completed ? 'opacity-50' : ''} ${isPreview ? 'ring-2 ring-blue-500 z-10' : ''}`}
            style={{
              top,
              height,
              ...(c && { backgroundColor: hexToRgba(c, 0.25), borderColor: c }),
            }}
          >
            <div className="flex items-start gap-1">
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => onToggle(t)}
                onClick={(ev) => ev.stopPropagation()}
                onMouseDown={(ev) => ev.stopPropagation()}
                className="mt-0.5"
              />
              <span
                className={`font-medium text-slate-900 dark:text-slate-100 ${t.completed ? 'line-through' : ''}`}
              >
                {t.description}
              </span>
            </div>
            {isPreview && (
              <div className="text-[10px] text-slate-600 dark:text-slate-300">
                {s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–
                {e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
            <div
              onMouseDown={(ev) => {
                ev.stopPropagation()
                onResizeStart(t)
              }}
              className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10"
            />
          </div>
        )
      })}
      {/* ghost preview when task dragged into this day from another */}
      {preview &&
        sameDay(preview.start, day) &&
        !tasks.some((t) => t.id === preview.taskId) && (
          <div
            className="absolute left-1 right-1 rounded border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              top: toY(preview.start),
              height: Math.max(SLOT_PX / 2, toY(preview.end) - toY(preview.start)),
            }}
          />
        )}
    </div>
  )
})

const fmtLocal = (d) => {
  if (!d) return ''
  const x = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

function TaskModal({ projects, initial, defaultStart, defaultEnd, onClose, onSave }) {
  const [form, setForm] = useState({
    description: initial?.description ?? '',
    project_id: initial?.project_id ?? null,
    priority: initial?.priority ?? '',
    start_datetime: fmtLocal(initial?.start_datetime ?? defaultStart),
    end_datetime: fmtLocal(initial?.end_datetime ?? defaultEnd),
  })
  const editing = !!initial
  return (
    <Modal title={editing ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            ...form,
            project_id: form.project_id || null,
            priority: form.priority || null,
            start_datetime: form.start_datetime || null,
            end_datetime: form.end_datetime || null,
          })
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="What needs doing?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <select
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          value={form.project_id ?? ''}
          onChange={(e) =>
            setForm({ ...form, project_id: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.title}
            </option>
          ))}
        </select>
        <select
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          <option value="">No priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="datetime-local"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-2 py-2 text-sm"
            value={form.start_datetime}
            onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
          />
          <input
            type="datetime-local"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-2 py-2 text-sm"
            value={form.end_datetime}
            onChange={(e) => setForm({ ...form, end_datetime: e.target.value })}
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">
            Cancel
          </button>
          <button className="px-4 py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded text-sm font-medium">
            {editing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function HabitModal({ values, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    description: '',
    value_id: values[0]?.id ?? '',
    frequency: 'daily',
    day_of_week: 1,
    start_date: today,
    end_date: '',
  })
  return (
    <Modal title="New Habit" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ ...form, end_date: form.end_date || null })
        }}
        className="space-y-3"
      >
        <input
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="Habit description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <select
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          value={form.value_id}
          onChange={(e) => setForm({ ...form, value_id: Number(e.target.value) })}
          required
        >
          {values.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <select
            className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          {form.frequency === 'weekly' && (
            <select
              className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
              value={form.day_of_week}
              onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            required
          />
          <input
            type="date"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            placeholder="End (optional)"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">
            Cancel
          </button>
          <button className="px-4 py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded text-sm font-medium">
            Create
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
