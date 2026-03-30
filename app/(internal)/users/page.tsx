'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<User>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tech')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role, password: password || undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      setUsers((prev) => [...prev, data.user])
      setName(''); setEmail(''); setRole('tech'); setPassword(''); setShowForm(false)
    }
    setSaving(false)
  }

  function startEdit(u: User) {
    setEditingId(u.id)
    setDraft({ name: u.name, email: u.email, role: u.role, isActive: u.isActive })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      const data = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)))
      setEditingId(null)
      setDraft({})
    }
    setSaving(false)
  }

  const inputClass = 'px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm w-full focus:border-orange-500 focus:outline-none'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Users</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="admin">Admin</option>
              <option value="tech">Tech</option>
              <option value="client">Client</option>
            </select>
            {role !== 'client' && (
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            )}
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Add User'}
          </button>
        </form>
      )}

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Active</th>
              <th className="text-left px-4 py-3 font-medium">Last Login</th>
              <th className="text-left px-4 py-3 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users yet.</td></tr>
            ) : (
              users.map((u) =>
                editingId === u.id ? (
                  <tr key={u.id} className="border-b border-gray-800 bg-gray-800/30">
                    <td className="px-4 py-2"><input type="text" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} /></td>
                    <td className="px-4 py-2"><input type="email" value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputClass} /></td>
                    <td className="px-4 py-2">
                      <select value={draft.role ?? 'tech'} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className={inputClass}>
                        <option value="admin">Admin</option>
                        <option value="tech">Tech</option>
                        <option value="client">Client</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={draft.isActive ?? true} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-2 space-x-1">
                      <button onClick={() => saveEdit(u.id)} disabled={saving} className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs disabled:opacity-50">Save</button>
                      <button onClick={cancelEdit} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 cursor-pointer" onClick={() => startEdit(u)}>
                    <td className="px-4 py-3 text-white">{u.name}</td>
                    <td className="px-4 py-3 text-gray-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        u.role === 'admin' ? 'bg-orange-900/50 text-orange-300' :
                        u.role === 'tech' ? 'bg-blue-900/50 text-blue-300' :
                        'bg-gray-800 text-gray-400'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">{u.isActive ? '✓' : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">click to edit</td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
