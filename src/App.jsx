import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { initDb } from './db/client'
import { getCurrentUser, logout, updateUser } from './lib/auth'
import TasksView from './views/TasksView'
import CalendarView from './views/CalendarView'
import HabitsView from './views/HabitsView'
import PrioritiesView from './views/PrioritiesView'
import CheckInsView from './views/CheckInsView'
import JournalView from './views/JournalView'
import Login from './views/Login'

const navItems = [
  { to: '/tasks', label: 'Tasks' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/habits', label: 'Habits' },
  { to: '/priorities', label: 'Priorities' },
  { to: '/journal', label: 'Journal' },
  { to: '/checkins', label: 'Check-ins' },
]

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    initDb()
      .then(async () => {
        setUser(await getCurrentUser())
        setReady(true)
      })
      .catch((err) => {
        console.error('DB init failed:', err)
        setError(err.message || String(err))
      })
  }, [])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">Failed to initialize database</p>
          <pre className="text-xs text-slate-600 whitespace-pre-wrap">{error}</pre>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={async (u) => setUser(u)} />
  }

  const dark = user.theme === 'dark'

  return (
    <div className={dark ? 'dark h-full' : 'h-full'}>
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="font-bold text-lg">Focus Planner</h1>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-sm font-medium ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={async () => {
                const next = dark ? 'light' : 'dark'
                await updateUser(user.id, { theme: next })
                setUser({ ...user, theme: next })
              }}
              className="px-2 py-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <span className="text-slate-500">{user.username}</span>
            <button
              onClick={async () => {
                await logout()
                setUser(null)
              }}
              className="px-3 py-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to={`/${user.default_view}`} replace />} />
            <Route
              path="/tasks"
              element={<TasksView user={user} onUserChange={setUser} />}
            />
            <Route path="/calendar" element={<CalendarView user={user} />} />
            <Route path="/habits" element={<HabitsView user={user} />} />
            <Route path="/priorities" element={<PrioritiesView user={user} />} />
            <Route path="/journal" element={<JournalView user={user} />} />
            <Route
              path="/checkins"
              element={<CheckInsView user={user} onUserChange={setUser} />}
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}
