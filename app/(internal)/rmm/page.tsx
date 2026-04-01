'use client'

import { useEffect, useState } from 'react'

interface AgentMapping {
  id: string
  rmmAgentId: string
  hostname: string
  clientId: string
  clientName: string | null
  machineLabel: string | null
  isActive: boolean
  createdAt: string
}

interface Client {
  id: string
  clientName: string
}

export default function RmmAgentMapPage() {
  const [agents, setAgents] = useState<AgentMapping[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rmmAgentId: '', hostname: '', clientId: '', machineLabel: '' })
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const [agentsRes, clientsRes] = await Promise.all([
      fetch('/api/rmm/agents'),
      fetch('/api/clients'),
    ])
    setAgents(await agentsRes.json())
    const clientData = await clientsRes.json()
    setClients(Array.isArray(clientData) ? clientData : clientData.clients ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/rmm/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ rmmAgentId: '', hostname: '', clientId: '', machineLabel: '' })
      setShowForm(false)
      await loadData()
    }
    setSaving(false)
  }

  async function toggleActive(agent: AgentMapping) {
    await fetch(`/api/rmm/agents/${agent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !agent.isActive }),
    })
    await loadData()
  }

  async function deleteAgent(id: string) {
    if (!confirm('Remove this agent mapping?')) return
    await fetch(`/api/rmm/agents/${id}`, { method: 'DELETE' })
    await loadData()
  }

  if (loading) {
    return <div className="text-gray-400">Loading RMM agent mappings...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">RMM Agent Map</h2>
          <p className="text-sm text-gray-400 mt-1">
            Map Tactical RMM agents to clients for automatic ticket routing
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Mapping'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">RMM Agent ID</label>
              <input
                type="text"
                required
                value={form.rmmAgentId}
                onChange={(e) => setForm({ ...form, rmmAgentId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                placeholder="e.g. abc123-def456"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hostname</label>
              <input
                type="text"
                required
                value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                placeholder="e.g. CBB-FRONT-PC"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Client</label>
              <select
                required
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.clientName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Machine Label (optional)</label>
              <input
                type="text"
                value={form.machineLabel}
                onChange={(e) => setForm({ ...form, machineLabel: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                placeholder="e.g. Kathy's desk"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Add Mapping'}
          </button>
        </form>
      )}

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Hostname</th>
              <th className="text-left px-4 py-3 font-medium">Agent ID</th>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Label</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No agent mappings yet. Add them after RMM onboarding.
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr key={a.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-200 font-mono text-xs">{a.hostname}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{a.rmmAgentId.slice(0, 12)}...</td>
                  <td className="px-4 py-3 text-gray-200">{a.clientName ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-gray-400">{a.machineLabel ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${a.isActive ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                      {a.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      onClick={() => toggleActive(a)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      {a.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteAgent(a.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        {agents.length} agent{agents.length !== 1 ? 's' : ''} mapped
        {' '}/{' '}
        {agents.filter((a) => a.isActive).length} active
      </div>
    </div>
  )
}
