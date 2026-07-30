import { useEffect, useState } from 'react'
import { api, type AdminUser } from '../lib/api'
import ImageProviderSettings from './ImageProviderSettings'
import TextProviderSettings from './TextProviderSettings'

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
    <div className="border border-line bg-surface px-6 py-6">
      <header className="rule-double pb-3">
        <span className="kicker text-accent-ink">Admin</span>
        <h2 className="mt-1 text-h2 text-ink">Instance</h2>
        <p className="measure mt-2 text-body text-ink-muted">
          Manage users and sign-ups for this Mocky instance.
        </p>
      </header>

      {error && (
        <div className="mt-4 border border-danger/50 bg-danger/10 p-2 text-body-sm text-danger">{error}</div>
      )}

      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <section>
          <div className="section-head">
            <span className="kicker text-accent-ink">Access</span>
          </div>

          {/* Registration toggle */}
          <label className="flex cursor-pointer items-center justify-between gap-3 border border-line-soft bg-ink/5 p-3">
            <span>
              <span className="block text-body font-medium text-ink">Allow public sign-ups</span>
              <span className="measure block text-body-sm text-ink-muted">
                When off, only you can create accounts (below). New visitors can still sign in.
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-accent" checked={allowReg} onChange={toggleReg} />
          </label>

          {/* Add user */}
          <form onSubmit={addUser} className="mt-4 border border-line-soft bg-ink/5 p-3">
            <div className="kicker mb-2">Add a user</div>
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
        </section>

        {/* Users list */}
        <section>
          <div className="section-head">
            <span className="kicker text-accent-ink">Users</span>
            <span className="ml-auto font-mono text-caption text-accent-ink">{users.length}</span>
          </div>
          {loading ? (
            <p className="text-body text-ink-faint">Loading…</p>
          ) : (
            <ul className="border-t border-line-soft">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 border-b border-line-soft py-2">
                  <span className="text-body text-ink">{u.username}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-caption font-semibold uppercase ${
                      u.role === 'admin' ? 'bg-accent/10 text-accent-ink' : 'bg-ink/5 text-ink-muted'
                    }`}
                  >
                    {u.role}
                  </span>
                  <span className="font-mono text-body-sm text-ink-faint">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  <div className="ml-auto">
                    {u.username === currentUsername ? (
                      <span className="text-body-sm text-ink-faint">you</span>
                    ) : (
                      <button
                        type="button"
                        className="border border-danger/60 px-2 py-1 text-body-sm text-danger hover:bg-danger/10"
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
        </section>
      </div>

      {/* Instance-wide model providers */}
      <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-line pt-8 xl:grid-cols-2">
        <TextProviderSettings />
        <ImageProviderSettings />
      </div>
    </div>
  )
}
