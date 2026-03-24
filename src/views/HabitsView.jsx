import { useEffect, useMemo, useState } from 'react'
import {
  listValues,
  listHabits,
  createValue,
  deleteValue,
  createHabit,
  deleteHabit,
  setHabitDormant,
} from '../db/queries'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function HabitsView({ user }) {
  const [values, setValues] = useState([])
  const [habits, setHabits] = useState([])
  const [valueModal, setValueModal] = useState(false)
  const [habitModal, setHabitModal] = useState(null) // { valueId }

  async function reload() {
    setValues(await listValues(user.id))
    setHabits(await listHabits(user.id))
  }

  useEffect(() => {
    reload()
  }, [user.id])

  // values sorted by habit count (desc), then alphabetically
  const sections = useMemo(() => {
    const byValue = {}
    for (const v of values) byValue[v.id] = []
    for (const h of habits) {
      if (byValue[h.value_id]) byValue[h.value_id].push(h)
    }
    return [...values]
      .sort((a, b) => {
        const diff = (byValue[b.id]?.length || 0) - (byValue[a.id]?.length || 0)
        return diff !== 0 ? diff : a.name.localeCompare(b.name)
      })
      .map((v) => ({
        value: v,
        habits: (byValue[v.id] || []).sort((a, b) =>
          a.description.localeCompare(b.description),
        ),
      }))
  }, [values, habits])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Habits</h2>
          <p className="text-sm text-slate-500">
            Build consistency around what matters to you
          </p>
        </div>
        <button
          onClick={() => setValueModal(true)}
          className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded text-sm font-medium"
        >
          + New Value
        </button>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p>No values yet. Create one to start building habits.</p>
        </div>
      )}

      {sections.map(({ value, habits: valueHabits }) => (
        <section
          key={value.id}
          className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
        >
          <header className="px-4 py-3 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{value.name}</h3>
              {value.description && (
                <p className="text-xs text-slate-500">{value.description}</p>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {valueHabits.length} habit{valueHabits.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setHabitModal({ valueId: value.id })}
              className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              + Habit
            </button>
            <button
              onClick={async () => {
                if (
                  !confirm(
                    `Delete "${value.name}"? This will also delete all its habits.`,
                  )
                )
                  return
                await deleteValue(value.id, user.id)
                reload()
              }}
              className="text-xs text-slate-400 hover:text-red-600 px-1"
              title="Delete value"
            >
              ✕
            </button>
          </header>

          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {valueHabits.length === 0 && (
              <li className="px-4 py-4 text-sm text-slate-400 text-center">
                No habits yet
              </li>
            )}
            {valueHabits.map((h) => {
              const total = Number(h.total) || 0
              const done = Number(h.done) || 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <li
                  key={h.id}
                  className={`px-4 py-3 flex items-center gap-4 ${
                    h.dormant ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{h.description}</span>
                      {h.dormant && (
                        <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">
                          Dormant
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {h.frequency === 'daily'
                        ? 'Daily'
                        : `Weekly · ${DAYS[h.day_of_week]}`}
                      {' · since '}
                      {new Date(h.start_date).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="w-32">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{done}/{total}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      await setHabitDormant(h.id, user.id, !h.dormant)
                      reload()
                    }}
                    className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {h.dormant ? 'Reactivate' : 'Make dormant'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${h.description}" and all its history?`))
                        return
                      await deleteHabit(h.id, user.id)
                      reload()
                    }}
                    className="text-xs text-slate-400 hover:text-red-600 px-1"
                    title="Delete habit"
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {valueModal && (
        <ValueModal
          onClose={() => setValueModal(false)}
          onSave={async (data) => {
            await createValue(user.id, data)
            setValueModal(false)
            reload()
          }}
        />
      )}
      {habitModal && (
        <HabitModal
          values={values}
          defaultValueId={habitModal.valueId}
          onClose={() => setHabitModal(null)}
          onSave={async (data) => {
            await createHabit(user.id, data)
            setHabitModal(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function ValueModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', description: '' })
  return (
    <Modal title="New Value" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(form)
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="Name (e.g. Health, Growth, Family)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <textarea
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
          placeholder="What does this value mean to you? (optional)"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
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

function HabitModal({ values, defaultValueId, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    description: '',
    value_id: defaultValueId ?? values[0]?.id ?? '',
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
          autoFocus
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
          <div>
            <label className="text-xs text-slate-500">Start</label>
            <input
              type="date"
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">End (blank = rolling 4wk)</label>
            <input
              type="date"
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded px-3 py-2"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
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
