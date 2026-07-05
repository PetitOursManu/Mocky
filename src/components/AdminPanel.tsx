import { useEffect, useState } from 'react'
import { api, type AdminUser } from '../lib/api'

export default function AdminPanel({ currentUsername }: { currentUsername: string }) {
  const [allowReg, setAllowReg] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Add-user form
  const [newName, setNewName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
  const [adding, setAdding] = useState(false)

  async function refresh() {
    try {
      const [cfg, list] = await Promise.all([api.admin.getConfig(), api.admin.listUsers()])
      setAllowReg(cfg.allowRegistration)
      setUsers(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  async function toggleReg() {
    const next = !allowReg
    setAllowReg(next)
    try {
      await api.admin.setAllowRegistration(next)
    } catch (e) {
      setAllowReg(!next)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      await api.admin.addUser(newName.trim(), newPass, newRole)
      setNewName('')
      setNewPass('')
      setNewRole('user')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  async function removeUser(u: AdminUser) {
    if (!confirm(`Delete user "${u.username}" and all their projects? This cannot be undone.`)) return
    try {
      await api.admin.deleteUser(u.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-slate-100">Admin</h2>
        <p className="mb-4 text-sm text-slate-400">Manage users and sign-ups for this Mocky instance.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-700/50 bg-rose-900/30 p-2 text-xs text-rose-200">{error}</div>
        )}

        {/* Registration toggle */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
          <span>
            <span className="block text-sm font-medium text-slate-200">Allow public sign-ups</span>
            <span className="block text-xs text-slate-500">
              When off, only you can create accounts (below). New visitors can still sign in.
            </span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-indigo-500" checked={allowReg} onChange={toggleReg} />
        </label>

        {/* Add user */}
        <form onSubmit={addUser} className="mt-4 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
          <div className="mb-2 text-sm font-medium text-slate-200">Add a user</div>
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="input min-w-[140px] flex-1"
              placeholder="username"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="input min-w-[140px] flex-1"
              type="password"
              placeholder="password (min 6)"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <select
              className="input w-28"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" className="btn-primary" disabled={adding || newName.trim().length < 3 || newPass.length < 6}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {/* Users list */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
        <div className="mb-3 text-sm font-medium text-slate-200">Users · {users.length}</div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="space-y-1">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2"
              >
                <span className="text-sm text-slate-100">{u.username}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {u.role}
                </span>
                <span className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</span>
                <div className="ml-auto">
                  {u.username === currentUsername ? (
                    <span className="text-xs text-slate-500">you</span>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md border border-rose-800/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/30"
                      onClick={() => removeUser(u)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
