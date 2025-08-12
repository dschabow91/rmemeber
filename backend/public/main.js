import React, { useState, useEffect } from 'https://esm.sh/react@18'
import ReactDOM from 'https://esm.sh/react-dom@18/client'

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    if (res.ok) {
      const { user } = await res.json()
      onLoggedIn(user)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Login failed')
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 mt-10 text-center">
      <img src="https://images.unsplash.com/photo-1581091012184-5c43e0d0b637?auto=format&fit=crop&w=600&q=80" alt="factory" className="w-full h-32 object-cover rounded" />
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@motherlode.local" className="border p-2 w-full" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="ChangeMe123!" className="border p-2 w-full" required />
      <button className="btn btn-primary w-full">Login</button>
    </form>
  )
}

function ChangePassword() {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')

  async function submit(e) {
    e.preventDefault()
    await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
    })
    setOldPw('')
    setNewPw('')
  }

  return (
    <form onSubmit={submit} className="card space-y-2 max-w-sm mx-auto">
      <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Old password" className="border p-2 w-full" required />
      <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" className="border p-2 w-full" required />
      <button className="btn btn-primary">Update</button>
    </form>
  )
}

function EntryForm({ onSaved }) {
  const [date, setDate] = useState('')
  const [shift, setShift] = useState('AM')
  const [line, setLine] = useState('1')
  const [tasks, setTasks] = useState('')
  const [issues, setIssues] = useState('')
  const [nextActions, setNextActions] = useState('')
  const [files, setFiles] = useState([])

  async function submit(e) {
    e.preventDefault()
    let attachments = []
    if (files.length) {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
      if (up.ok) attachments = (await up.json()).files
    }
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ date, shift, line, completedTasks: tasks, issues, nextActions, attachments })
    })
    setDate('')
    setTasks('')
    setIssues('')
    setNextActions('')
    setFiles([])
    onSaved && onSaved()
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="text-lg font-semibold">New Entry</h3>
      <div className="flex flex-wrap gap-2">
        <label>Date <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="border p-1" /></label>
        <label>Shift
          <select value={shift} onChange={e => setShift(e.target.value)} className="border p-1" required>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <label>Line
          <select value={line} onChange={e => setLine(e.target.value)} className="border p-1" required>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
      </div>
      <textarea value={tasks} onChange={e => setTasks(e.target.value)} placeholder="Completed tasks" className="border w-full p-1" />
      <textarea value={issues} onChange={e => setIssues(e.target.value)} placeholder="Issues" className="border w-full p-1" />
      <textarea value={nextActions} onChange={e => setNextActions(e.target.value)} placeholder="Next actions" className="border w-full p-1" />
      <input type="file" multiple onChange={e => setFiles(e.target.files)} />
      <button className="btn btn-secondary">Save</button>
    </form>
  )
}

function EntriesList() {
  const [entries, setEntries] = useState([])
  const [filterDate, setFilterDate] = useState('')

  async function load() {
    const params = new URLSearchParams()
    if (filterDate) params.append('date', filterDate)
    const res = await fetch('/api/entries?' + params.toString(), { credentials: 'include' })
    if (res.ok) setEntries(await res.json())
  }

  useEffect(() => { load() }, [filterDate])

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Entries</h3>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border p-1" />
      </div>
      <div>
        {entries.map(e => (
          <div key={e.id} className="border p-2 my-2 rounded bg-white">
            <div className="flex justify-between">
              <div><b>{e.date}</b> - {e.shift} - Line {e.line}</div>
              <a className="link" href={`/api/entries/export?date=${e.date}&line=${e.line}`}>Export</a>
            </div>
            <div className="mt-1">{e.completedTasks}</div>
            <div className="mt-1">{e.issues}</div>
            <div className="mt-1">{e.nextActions}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Dashboard({ user, onLogout }) {
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full">
      <div className="card flex justify-between items-center">
        <h2 className="text-lg font-semibold">Welcome {user.name}</h2>
        <div className="space-x-2">
          <button onClick={() => setShowPw(!showPw)} className="link">Change Password</button>
          <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); onLogout() }} className="link text-red-600">Logout</button>
        </div>
      </div>
      {showPw && <ChangePassword />}
      <EntryForm onSaved={() => {}} />
      <EntriesList />
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(async res => {
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      }
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null
  if (!user) return <Login onLoggedIn={setUser} />
  return <Dashboard user={user} onLogout={() => setUser(null)} />
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)

