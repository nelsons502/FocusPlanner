import { useEffect, useState } from 'react'
import { getJournalEntry, saveJournalEntry, listValues } from '../db/queries'
import { toLocalDate } from '../lib/dates'

const addDays = (d, n) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function JournalView({ user }) {
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [entry, setEntry] = useState('')
  const [valueIds, setValueIds] = useState([])
  const [values, setValues] = useState([])
  const [saved, setSaved] = useState(false)

  async function load() {
    const je = await getJournalEntry(user.id, toLocalDate(date))
    setEntry(je?.entry ?? '')
    setValueIds(je?.value_ids ?? [])
    setValues(await listValues(user.id))
  }

  useEffect(() => {
    load()
  }, [user.id, date.getTime()])

  async function save() {
    if (!entry.trim()) return
    await saveJournalEntry(user.id, toLocalDate(date), entry, valueIds)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isFuture = date > today

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            ‹
          </button>
          <input
            type="date"
            value={toLocalDate(date)}
            max={toLocalDate(today)}
            onChange={(e) => setDate(new Date(e.target.value + 'T00:00:00'))}
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 py-1.5 font-semibold"
          />
          <button
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= today}
            className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <button
          onClick={save}
          disabled={!entry.trim() || isFuture}
          className="px-4 py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded text-sm font-medium disabled:opacity-40"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <textarea
        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-4 py-3 min-h-[400px] font-serif"
        placeholder={
          isFuture ? "Can't journal the future…" : "What's on your mind today?"
        }
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        disabled={isFuture}
      />

      <div>
        <p className="text-sm text-slate-500 mb-2">
          Which values does this entry connect with?
        </p>
        <div className="flex flex-wrap gap-2">
          {values.map((v) => {
            const active = valueIds.includes(v.id)
            return (
              <button
                key={v.id}
                onClick={() =>
                  setValueIds(
                    active ? valueIds.filter((id) => id !== v.id) : [...valueIds, v.id],
                  )
                }
                className={`px-3 py-1 rounded-full text-sm border ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent'
                    : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {v.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
