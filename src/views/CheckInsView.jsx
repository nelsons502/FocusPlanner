import { useEffect, useState } from 'react'
import { getCheckIn, saveCheckIn, listProjects } from '../db/queries'
import { updateUser } from '../lib/auth'
import { toLocalDate } from '../lib/dates'

const QUESTIONS = [
  { key: 'memorable', q: 'What was a memorable part of this past month? Describe it.' },
  { key: 'lessons', q: "What were three lessons you've learned this past month?" },
  {
    key: 'time_review',
    q: 'Review your planned tasks for the past month and assess your priorities. Are you happy with how you spent your time? If not, what steps will you take next month to adjust them?',
  },
  { key: 'accomplished', q: 'What did you accomplish last past month? What are you proud of?' },
  {
    key: 'different',
    q: 'How are you different between this past month and the month before it?',
  },
  {
    key: 'grateful',
    q: 'Who are you especially grateful for this past month? Let them know in person or with a Thank You letter.',
  },
  {
    key: 'growth',
    q: 'Name three ways you can grow this upcoming month. What concrete actions can you take to work towards these?',
  },
]

const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)

export default function CheckInsView({ user, onUserChange }) {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()))
  const [checkIn, setCheckIn] = useState(null)
  const [form, setForm] = useState({})
  const [projects, setProjects] = useState([])
  const [saved, setSaved] = useState(false)

  async function load() {
    const ci = await getCheckIn(user.id, toLocalDate(month))
    setCheckIn(ci)
    setForm({
      memorable: ci.memorable ?? '',
      lessons: ci.lessons ?? '',
      time_review: ci.time_review ?? '',
      accomplished: ci.accomplished ?? '',
      different: ci.different ?? '',
      grateful: ci.grateful ?? '',
      growth: ci.growth ?? '',
      rating: ci.rating ?? '',
      focus_change: ci.focus_change ?? '',
    })
    setProjects(await listProjects(user.id))
  }

  useEffect(() => {
    load()
  }, [user.id, month.getTime()])

  async function save() {
    await saveCheckIn(checkIn.id, user.id, {
      ...form,
      rating: form.rating ? Number(form.rating) : null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!checkIn) return <div className="p-6 text-slate-400">Loading…</div>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(addMonths(month, -1))}
            className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            ‹
          </button>
          <h2 className="text-2xl font-bold">
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            ›
          </button>
        </div>
        <button
          onClick={save}
          className="px-4 py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded text-sm font-medium"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-5">
        {QUESTIONS.map(({ key, q }) => (
          <div key={key}>
            <label className="block text-sm font-medium mb-2">{q}</label>
            <textarea
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-2 text-sm"
              rows={3}
              value={form[key] ?? ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium mb-2">
            From 1–10, how do you feel overall about this past month?
          </label>
          <div className="flex gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setForm({ ...form, rating: n })}
                className={`w-10 h-10 rounded-full text-sm font-medium ${
                  Number(form.rating) === n
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
          <label className="block text-sm font-medium mb-2">
            Your current Focus Project is{' '}
            <span className="font-bold">
              {projects.find((p) => p.id === user.focus_project_id)?.title ?? '(none)'}
            </span>
            . Want to change it for next month?
          </label>
          <div className="flex gap-3">
            <select
              className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-2 text-sm"
              value={user.focus_project_id ?? ''}
              onChange={async (e) => {
                const id = e.target.value ? Number(e.target.value) : null
                await updateUser(user.id, { focus_project_id: id })
                onUserChange({ ...user, focus_project_id: id })
              }}
            >
              <option value="">No focus project</option>
              {projects
                .filter((p) => !p.accomplished)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.title}
                  </option>
                ))}
            </select>
          </div>
          <textarea
            className="w-full mt-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-2 text-sm"
            rows={2}
            placeholder="Notes on why you're changing (or keeping) your focus…"
            value={form.focus_change ?? ''}
            onChange={(e) => setForm({ ...form, focus_change: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
