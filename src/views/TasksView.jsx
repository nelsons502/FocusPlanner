import { useEffect, useMemo, useState, useRef } from 'react'
import {
  listProjects,
  listTasks,
  createProject,
  createTask,
  updateTask,
  updateProject,
  duplicateTask,
  deleteTask,
  reorderProjects,
} from '../db/queries'
import { hexToRgba } from '../lib/colors'
import { updateUser } from '../lib/auth'

const PRIORITIES = ['Urgent', 'Important', 'Delegate', 'Regulate']
const PRIORITY_RANK = { Urgent: 0, Important: 1, Delegate: 2, Regulate: 3 }
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']

// sort: incomplete first → date ascending (nulls last) → priority
function sortTasks(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  const ad = a.start_datetime ? new Date(a.start_datetime).getTime() : Infinity
  const bd = b.start_datetime ? new Date(b.start_datetime).getTime() : Infinity
  if (ad !== bd) return ad - bd
  const ap = PRIORITY_RANK[a.priority] ?? 99
  const bp = PRIORITY_RANK[b.priority] ?? 99
  return ap - bp
}

export default function TasksView({ user, onUserChange }) {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [collapsed, setCollapsed] = useState({})
  const [showCompleted, setShowCompleted] = useState({})
  const [showAccomplished, setShowAccomplished] = useState(false)
  const [projectModal, setProjectModal] = useState(null) // { mode, project? }
  const [taskModal, setTaskModal] = useState(null) // { mode, task?, projectId? }
  const [ctxMenu, setCtxMenu] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragId = useRef(null)

  async function reload() {
    setProjects(await listProjects(user.id))
    setTasks(await listTasks(user.id))
  }

  useEffect(() => {
    reload()
  }, [user.id])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const orderedProjects = useMemo(() => {
    const list = showAccomplished ? projects : projects.filter((p) => !p.accomplished)
    return [...list].sort((a, b) => {
      if (a.id === user.focus_project_id) return -1
      if (b.id === user.focus_project_id) return 1
      return a.sort_order - b.sort_order
    })
  }, [projects, showAccomplished, user.focus_project_id])

  const tasksByProject = useMemo(() => {
    const m = { null: [] }
    for (const p of projects) m[p.id] = []
    for (const t of tasks) {
      const key = t.project_id ?? 'null'
      if (!m[key]) m[key] = []
      m[key].push(t)
    }
    for (const key of Object.keys(m)) m[key].sort(sortTasks)
    return m
  }, [tasks, projects])

  async function handleDrop(targetId) {
    const srcId = dragId.current
    dragId.current = null
    setDragOver(null)
    if (!srcId || srcId === targetId) return
    if (srcId === user.focus_project_id || targetId === user.focus_project_id) return
    const nonFocus = orderedProjects
      .filter((p) => p.id !== user.focus_project_id)
      .map((p) => p.id)
    const from = nonFocus.indexOf(srcId)
    const to = nonFocus.indexOf(targetId)
    if (from < 0 || to < 0) return
    nonFocus.splice(from, 1)
    nonFocus.splice(to, 0, srcId)
    await reorderProjects(user.id, nonFocus)
    reload()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAccomplished}
              onChange={(e) => setShowAccomplished(e.target.checked)}
            />
            Show accomplished projects
          </label>
          <button
            onClick={() => setProjectModal({ mode: 'create' })}
            className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded text-sm font-medium"
          >
            + New Project
          </button>
        </div>
      </div>

      {orderedProjects.map((p) => {
        const isFocus = p.id === user.focus_project_id
        const isCollapsed = collapsed[p.id]
        const projectTasks = (tasksByProject[p.id] || []).filter(
          (t) => showCompleted[p.id] || !t.completed,
        )
        return (
          <section
            key={p.id}
            draggable={!isFocus}
            onDragStart={() => (dragId.current = p.id)}
            onDragEnd={() => {
              dragId.current = null
              setDragOver(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!isFocus && dragId.current && dragId.current !== p.id) setDragOver(p.id)
            }}
            onDragLeave={() => setDragOver((d) => (d === p.id ? null : d))}
            onDrop={() => handleDrop(p.id)}
            className={`border rounded-lg overflow-hidden transition-all ${
              p.accomplished
                ? 'opacity-50 border-slate-200 dark:border-slate-700'
                : 'border-slate-300 dark:border-slate-600'
            } ${!isFocus ? 'cursor-move' : ''} ${
              dragOver === p.id
                ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-[1.01]'
                : ''
            } ${dragId.current === p.id ? 'opacity-40' : ''}`}
          >
            <header
              className="px-4 py-3 flex items-center gap-3 bg-white dark:bg-slate-800"
              style={{ borderLeft: `4px solid ${p.color || '#94a3b8'}` }}
            >
              <button
                onClick={() => setCollapsed({ ...collapsed, [p.id]: !isCollapsed })}
                className="text-slate-400 hover:text-slate-600 w-4"
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
              {p.icon && <span className="text-xl">{p.icon}</span>}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  {isFocus && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-full font-medium">
                      ★ Focus
                    </span>
                  )}
                  {p.accomplished && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                      Accomplished
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{p.description}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={!!showCompleted[p.id]}
                  onChange={(e) =>
                    setShowCompleted({ ...showCompleted, [p.id]: e.target.checked })
                  }
                />
                Show completed
              </label>
              <button
                onClick={() => setTaskModal({ mode: 'create', projectId: p.id })}
                className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                + Task
              </button>
              <button
                onClick={() => setProjectModal({ mode: 'edit', project: p })}
                className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                title="Edit project"
              >
                ✎
              </button>
            </header>
            {!isCollapsed && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {projectTasks.length === 0 && (
                  <li className="px-4 py-3 text-sm text-slate-400">No tasks</li>
                )}
                {projectTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    color={p.color}
                    onToggle={async () => {
                      await updateTask(t.id, user.id, { completed: !t.completed })
                      reload()
                    }}
                    onEdit={() => setTaskModal({ mode: 'edit', task: t })}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setCtxMenu({ x: e.clientX, y: e.clientY, task: t })
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <NoProjectSection
        tasks={(tasksByProject['null'] || []).filter(
          (t) => showCompleted['null'] || !t.completed,
        )}
        showCompleted={!!showCompleted['null']}
        onToggleShowCompleted={(v) => setShowCompleted({ ...showCompleted, null: v })}
        onAddTask={() => setTaskModal({ mode: 'create', projectId: null })}
        onToggleTask={async (t) => {
          await updateTask(t.id, user.id, { completed: !t.completed })
          reload()
        }}
        onEditTask={(t) => setTaskModal({ mode: 'edit', task: t })}
        onContextMenu={(e, t) => {
          e.preventDefault()
          setCtxMenu({ x: e.clientX, y: e.clientY, task: t })
        }}
      />

      {ctxMenu && (
        <div
          className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg py-1 z-50 text-sm"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => {
              setTaskModal({ mode: 'edit', task: ctxMenu.task })
              setCtxMenu(null)
            }}
            className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              await duplicateTask(ctxMenu.task.id, user.id)
              setCtxMenu(null)
              reload()
            }}
            className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Duplicate
          </button>
          <button
            onClick={async () => {
              await deleteTask(ctxMenu.task.id, user.id)
              setCtxMenu(null)
              reload()
            }}
            className="block w-full text-left px-4 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600"
          >
            Delete
          </button>
        </div>
      )}

      {projectModal && (
        <ProjectModal
          initial={projectModal.project}
          isFocus={projectModal.project?.id === user.focus_project_id}
          onSetFocus={async (on) => {
            const id = on ? projectModal.project.id : null
            await updateUser(user.id, { focus_project_id: id })
            onUserChange({ ...user, focus_project_id: id })
          }}
          onClose={() => setProjectModal(null)}
          onSave={async (data) => {
            if (projectModal.mode === 'edit') {
              await updateProject(projectModal.project.id, user.id, data)
            } else {
              await createProject(user.id, data)
            }
            setProjectModal(null)
            reload()
          }}
        />
      )}
      {taskModal && (
        <TaskModal
          projects={projects}
          initial={taskModal.task}
          defaultProjectId={taskModal.projectId}
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
    </div>
  )
}

function TaskRow({ task, color, onToggle, onEdit, onContextMenu }) {
  const hasColor = !!color
  return (
    <li
      onContextMenu={onContextMenu}
      className={`px-4 py-2.5 flex items-center gap-3 text-sm group ${
        hasColor ? '' : 'bg-slate-200 dark:bg-slate-700'
      }`}
      style={hasColor ? { backgroundColor: hexToRgba(color, 0.12) } : undefined}
    >
      <input type="checkbox" checked={task.completed} onChange={onToggle} />
      <span className={task.completed ? 'line-through text-slate-400 flex-1' : 'flex-1'}>
        {task.description}
      </span>
      {task.priority && (
        <span className="text-xs px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded">
          {task.priority}
        </span>
      )}
      {task.start_datetime && (
        <span className="text-xs text-slate-500">
          {new Date(task.start_datetime).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
      <button
        onClick={onEdit}
        className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700"
      >
        ✎
      </button>
    </li>
  )
}

function NoProjectSection({
  tasks,
  showCompleted,
  onToggleShowCompleted,
  onAddTask,
  onToggleTask,
  onEditTask,
  onContextMenu,
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <section className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
      <header className="px-4 py-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-slate-600 w-4"
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <h3 className="font-semibold text-slate-500 flex-1">No project</h3>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => onToggleShowCompleted(e.target.checked)}
          />
          Show completed
        </label>
        <button
          onClick={onAddTask}
          className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          + Task
        </button>
      </header>
      {!collapsed && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {tasks.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400">No tasks</li>
          )}
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              color={null}
              onToggle={() => onToggleTask(t)}
              onEdit={() => onEditTask(t)}
              onContextMenu={(e) => onContextMenu(e, t)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
const fmtDateTime = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  return dt.toISOString().slice(0, 16)
}

function ProjectModal({ initial, isFocus, onSetFocus, onClose, onSave }) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    start_date: fmtDate(initial?.start_date),
    end_date: fmtDate(initial?.end_date),
    icon: initial?.icon ?? '',
    color: initial?.color ?? COLORS[0],
    accomplished: initial?.accomplished ?? false,
  })
  const editing = !!initial
  return (
    <Modal title={editing ? 'Edit Project' : 'New Project'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            ...form,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            icon: form.icon || null,
          })
        }}
        className="space-y-3"
      >
        <input
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <textarea
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="Description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <input
            type="date"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </div>
        <div className="flex gap-3">
          <input
            className="w-20 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2 text-center"
            placeholder="🎯"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
          />
          <div className="flex gap-1 items-center">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-800' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {editing && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.accomplished}
                onChange={(e) => setForm({ ...form, accomplished: e.target.checked })}
              />
              Accomplished
            </label>
            <button
              type="button"
              onClick={() => onSetFocus(!isFocus)}
              className={`w-full px-3 py-2 rounded text-sm font-medium border ${
                isFocus
                  ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900 dark:border-amber-700 dark:text-amber-200'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {isFocus ? '★ This is your Focus Project' : '☆ Set as Focus Project'}
            </button>
          </>
        )}
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

function TaskModal({ projects, initial, defaultProjectId, onClose, onSave }) {
  const [form, setForm] = useState({
    description: initial?.description ?? '',
    project_id: initial?.project_id ?? defaultProjectId ?? null,
    priority: initial?.priority ?? '',
    start_datetime: fmtDateTime(initial?.start_datetime),
    end_datetime: fmtDateTime(initial?.end_datetime),
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
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="Description"
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
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2 text-sm"
            value={form.start_datetime}
            onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
          />
          <input
            type="datetime-local"
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2 text-sm"
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
