import { useEffect, useMemo, useRef, useState } from 'react'
import { listTasks, listProjects, updateTask } from '../db/queries'
import { hexToRgba } from '../lib/colors'

const PRIORITIES = ['Urgent', 'Important', 'Delegate', 'Regulate']
const QUADRANTS = [
  { key: 'Urgent', label: 'Urgent', sub: 'Important & urgent — do now', pos: 'tl' },
  { key: 'Important', label: 'Important', sub: 'Important, not urgent — schedule', pos: 'tr' },
  { key: 'Delegate', label: 'Delegate', sub: 'Urgent, not important — hand off', pos: 'bl' },
  { key: 'Regulate', label: 'Regulate', sub: 'Neither — limit or drop', pos: 'br' },
]
const WINDOWS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '3d', label: 'Next 3 days', days: 3 },
  { key: '7d', label: 'Next 7 days', days: 7 },
]

export default function PrioritiesView({ user }) {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [win, setWin] = useState('today')
  const [editTask, setEditTask] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragId = useRef(null)

  async function reload() {
    setTasks(await listTasks(user.id))
    setProjects(await listProjects(user.id))
  }

  useEffect(() => {
    reload()
  }, [user.id])

  const projectColor = (id) => projects.find((p) => p.id === id)?.color

  const filtered = useMemo(() => {
    const days = WINDOWS.find((w) => w.key === win).days
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + days)
    return tasks.filter((t) => {
      if (t.completed) return false
      if (!t.start_datetime) return false
      const d = new Date(t.start_datetime)
      return d >= start && d < end
    })
  }, [tasks, win])

  const byPriority = useMemo(() => {
    const m = { none: [] }
    for (const p of PRIORITIES) m[p] = []
    for (const t of filtered) m[t.priority ?? 'none'].push(t)
    return m
  }, [filtered])

  async function handleDrop(priority) {
    const id = dragId.current
    dragId.current = null
    setDragOver(null)
    if (!id) return
    await updateTask(id, user.id, { priority })
    reload()
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Priorities</h2>
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWin(w.key)}
              className={`px-4 py-1.5 text-sm ${
                win === w.key
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* matrix */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {QUADRANTS.map((q) => (
          <Quadrant
            key={q.key}
            quadrant={q}
            tasks={byPriority[q.key]}
            projectColor={projectColor}
            isDragOver={dragOver === q.key}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(q.key)
            }}
            onDragLeave={() => setDragOver((d) => (d === q.key ? null : d))}
            onDrop={() => handleDrop(q.key)}
            onDragStart={(t) => (dragId.current = t.id)}
            onToggle={async (t) => {
              await updateTask(t.id, user.id, { completed: true })
              reload()
            }}
            onEdit={setEditTask}
          />
        ))}
      </div>

      {/* no priority — 2x wide, 0.5x tall */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver('none')
        }}
        onDragLeave={() => setDragOver((d) => (d === 'none' ? null : d))}
        onDrop={() => handleDrop(null)}
        className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragOver === 'none'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-600'
        }`}
        style={{ minHeight: '8rem' }}
      >
        <h3 className="text-sm font-semibold text-slate-500 mb-2">No Priority</h3>
        <div className="flex flex-wrap gap-2">
          {byPriority.none.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              color={projectColor(t.project_id)}
              onDragStart={() => (dragId.current = t.id)}
              onToggle={async () => {
                await updateTask(t.id, user.id, { completed: true })
                reload()
              }}
              onEdit={() => setEditTask(t)}
            />
          ))}
          {byPriority.none.length === 0 && (
            <span className="text-xs text-slate-400">Drop tasks here to clear priority</span>
          )}
        </div>
      </div>

      {editTask && (
        <EditModal
          task={editTask}
          projects={projects}
          onClose={() => setEditTask(null)}
          onSave={async (data) => {
            await updateTask(editTask.id, user.id, data)
            setEditTask(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function Quadrant({
  quadrant,
  tasks,
  projectColor,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onToggle,
  onEdit,
}) {
  const corner = {
    tl: 'border-t-4 border-l-4 border-t-red-500 border-l-red-500',
    tr: 'border-t-4 border-r-4 border-t-blue-500 border-r-blue-500',
    bl: 'border-b-4 border-l-4 border-b-amber-500 border-l-amber-500',
    br: 'border-b-4 border-r-4 border-b-slate-400 border-r-slate-400',
  }[quadrant.pos]
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-lg p-4 overflow-y-auto transition-colors ${corner} ${
        isDragOver
          ? 'bg-blue-50 dark:bg-blue-950/30'
          : 'bg-white dark:bg-slate-800'
      }`}
    >
      <div className="mb-3">
        <h3 className="font-bold">{quadrant.label}</h3>
        <p className="text-xs text-slate-500">{quadrant.sub}</p>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            color={projectColor(t.project_id)}
            onDragStart={() => onDragStart(t)}
            onToggle={() => onToggle(t)}
            onEdit={() => onEdit(t)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-slate-400">Nothing here</p>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, color, onDragStart, onToggle, onEdit }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onEdit}
      className={`px-3 py-2 rounded cursor-move flex items-center gap-2 text-sm border ${
        color ? '' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
      }`}
      style={
        color ? { backgroundColor: hexToRgba(color, 0.15), borderColor: color } : undefined
      }
    >
      <input
        type="checkbox"
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />
      <span className="flex-1">{task.description}</span>
      {task.start_datetime && (
        <span className="text-xs text-slate-500">
          {new Date(task.start_datetime).toLocaleDateString(undefined, {
            weekday: 'short',
          })}
        </span>
      )}
    </div>
  )
}

function EditModal({ task, projects, onClose, onSave }) {
  const fmt = (d) => {
    if (!d) return ''
    const x = new Date(d)
    const p = (n) => String(n).padStart(2, '0')
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`
  }
  const [form, setForm] = useState({
    description: task.description,
    project_id: task.project_id,
    priority: task.priority ?? '',
    start_datetime: fmt(task.start_datetime),
    end_datetime: fmt(task.end_datetime),
  })
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Edit Task</h3>
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
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <select
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            value={form.project_id ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                project_id: e.target.value ? Number(e.target.value) : null,
              })
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
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
