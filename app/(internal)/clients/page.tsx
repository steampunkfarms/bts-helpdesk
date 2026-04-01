'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  clientName: string
  primaryEmail: string
  phone: string | null
  slaTier: string
  isActive: boolean
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Client>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [slaTier, setSlaTier] = useState('standard')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: name, primaryEmail: email, phone: phone || null, slaTier }),
    })
    if (res.ok) {
      const data = await res.json()
      setClients((prev) => [...prev, data.client])
      setName(''); setEmail(''); setPhone(''); setSlaTier('standard'); setShowForm(false)
    }
    setSaving(false)
  }

  function startEdit(c: Client) {
    setEditingId(c.id)
    setDraft({ clientName: c.clientName, primaryEmail: c.primaryEmail, phone: c.phone, slaTier: c.slaTier, isActive: c.isActive })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      const data = await res.json()
      setClients((prev) => prev.map((c) => (c.id === id ? data.client : c)))
      setEditingId(null)
      setDraft({})
    }
    setSaving(false)
  }

  async function impersonate(clientId: string) {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    if (res.ok) {
      window.location.href = '/portal'
    }
  }

  const inputClass = 'px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm w-full focus:border-orange-500 focus:outline-none'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Clients</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Client'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
            <input type="email" placeholder="Primary email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            <input type="text" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            <select value={slaTier} onChange={(e) => setSlaTier(e.target.value)} className={inputClass}>
              <option value="priority">Priority</option>
              <option value="standard">Standard</option>
              <option value="basic">Basic</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Client'}
          </button>
        </form>
      )}

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">SLA Tier</th>
              <th className="text-left px-4 py-3 font-medium">Active</th>
              <th className="text-left px-4 py-3 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No clients registered yet.</td></tr>
            ) : (
              clients.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id} className="border-b border-gray-800 bg-gray-800/30">
                    <td className="px-4 py-2"><input type="text" value={draft.clientName ?? ''} onChange={(e) => setDraft({ ...draft, clientName: e.target.value })} className={inputClass} /></td>
                    <td className="px-4 py-2"><input type="email" value={draft.primaryEmail ?? ''} onChange={(e) => setDraft({ ...draft, primaryEmail: e.target.value })} className={inputClass} /></td>
                    <td className="px-4 py-2"><input type="text" value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} /></td>
                    <td className="px-4 py-2">
                      <select value={draft.slaTier ?? 'standard'} onChange={(e) => setDraft({ ...draft, slaTier: e.target.value })} className={inputClass}>
                        <option value="priority">Priority</option>
                        <option value="standard">Standard</option>
                        <option value="basic">Basic</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={draft.isActive ?? true} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
                    </td>
                    <td className="px-4 py-2 space-x-1">
                      <button onClick={() => saveEdit(c.id)} disabled={saving} className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs disabled:opacity-50">Save</button>
                      <button onClick={cancelEdit} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-white cursor-pointer" onClick={() => startEdit(c)}>{c.clientName}</td>
                    <td className="px-4 py-3 text-gray-300 cursor-pointer" onClick={() => startEdit(c)}>{c.primaryEmail}</td>
                    <td className="px-4 py-3 text-gray-400 cursor-pointer" onClick={() => startEdit(c)}>{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 cursor-pointer" onClick={() => startEdit(c)}>{c.slaTier}</td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => startEdit(c)}>{c.isActive ? '✓' : '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => impersonate(c.id)}
                        className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs"
                      >
                        View Portal
                      </button>
                    </td>
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
