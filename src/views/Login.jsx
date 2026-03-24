import { useState } from 'react'
import { login, register } from '../lib/auth'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const user =
        mode === 'login'
          ? await login(username, password)
          : await register(username, password)
      if (!user) return setError('Invalid credentials')
      onLogin(user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <form
        onSubmit={submit}
        className="bg-white border border-slate-200 rounded-lg p-8 w-80 space-y-4 shadow-sm"
      >
        <h1 className="text-xl font-bold">Focus Planner</h1>
        <input
          className="w-full border border-slate-300 rounded px-3 py-2"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="w-full border border-slate-300 rounded px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full bg-slate-900 text-white rounded py-2 font-medium">
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="w-full text-sm text-slate-500 hover:text-slate-700"
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  )
}
