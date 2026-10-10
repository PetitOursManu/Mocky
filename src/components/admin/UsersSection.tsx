import { useEffect, useState } from 'react'
import { api, type AdminUser, type FreePlanSettings, type Plan } from '../../lib/api'
import { Banner, Button, Field, Icon, IconButton, Input, Modal, Select } from '../../ui'
import { useT } from '../../i18n'
import UsageReport from '../UsageReport'
import { SectionHead } from './AdminDashboard'
import { StateMark } from './ActivitySection'
import { useFmt } from './format'
import type { useDashboard } from './useDashboard'

type Live = ReturnType<typeof useDashboard>

/** Must match MIN_NEW_PASSWORD in server/index.js — the server is the authority. */
const MIN_PASSWORD = 8

/**
 * Accounts: who may sign up, who exists, and what each one weighs.
 *
 * Everything the old Admin page did for accounts, unchanged in behaviour, with
 * two additions from the live stream — whether each person is here right now,
 * and a way to sign an account out of every device at once without changing
 * its password.
 */
export default function UsersSection({ live, currentUsername }: { live: Live; currentUsername: string }) {
  const t = useT()
  const f = useFmt()
  const [allowReg, setAllowReg] = useState(true)
  /** The free plan's settings as saved; null until the server answered. */
  const [freePlan, setFreePlan] = useState<FreePlanSettings | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Add-user form
  const [newName, setNewName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
  // On by default: a password an admin typed for someone else is a shared
  // secret from the moment it is written down or dictated.
  const [newMustChange, setNewMustChange] = useState(true)
  /** Null = follow the newcomers' default, which is what the select shows. */
  const [newPlan, setNewPlan] = useState<Plan | null>(null)
  const [adding, setAdding] = useState(false)

  // Password reset dialog — null when closed.
  const [resetting, setResetting] = useState<AdminUser | null>(null)

  async function refresh() {
    try {
      const [cfg, list] = await Promise.all([api.admin.getConfig(), api.admin.listUsers()])
      setAllowReg(cfg.allowRegistration)
      setFreePlan(cfg.freePlan ?? null)
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

  const presence = new Map((live.data?.people || []).map((p) => [p.id, p]))

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
    setNotice(null)
    try {
      // An administrator is always standard (server/plan.js): no plan to send.
      await api.admin.addUser(newName.trim(), newPass, newRole, newMustChange, newRole === 'admin' ? undefined : (newPlan ?? undefined))
      setNotice(t('settings.accountCreated', { name: newName.trim() }))
      setNewName('')
      setNewPass('')
      setNewRole('user')
      setNewMustChange(true)
      setNewPlan(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  async function removeUser(u: AdminUser) {
    if (!confirm(t('settings.deleteAccountConfirm', { name: u.username }))) return
    setError(null)
    setNotice(null)
    try {
      await api.admin.deleteUser(u.id)
      setNotice(t('settings.accountDeleted', { name: u.username }))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function changePlan(u: AdminUser, plan: Plan) {
    setError(null)
    setNotice(null)
    try {
      await api.admin.setUserPlan(u.id, plan)
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, plan } : x)))
      setNotice(t('plan.changed', { name: u.username, plan: t(`plan.${plan}`) }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function signOut(u: AdminUser) {
    const self = u.username === currentUsername
    if (!confirm(t(self ? 'dashboard.users.signOutSelfConfirm' : 'dashboard.users.signOutConfirm', { name: u.username }))) return
    setError(null)
    setNotice(null)
    try {
      const out = await api.admin.dashboard.signOutEverywhere(u.id)
      setNotice(t('dashboard.users.signedOut', { name: u.username, n: out.revoked }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.users')} title={t('dashboard.users.title')} blurb={t('settings.adminBlurb')} />

      {error && (
        <Banner tone="danger" title={t('common.error')} className="mb-4">
          {error}
        </Banner>
      )}
      {notice && !error && (
        <Banner tone="ok" className="mb-4">
          {notice}
        </Banner>
      )}

      <div className="grid gap-x-12 gap-y-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('settings.access')}</span>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 border border-line-soft bg-ink/5 p-3">
            <span>
              <span className="block text-body font-medium text-ink">{t('admin.allowSignups')}</span>
              <span className="measure block text-body-sm text-ink-muted">{t('settings.allowSignupsHelp')}</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-accent" checked={allowReg} onChange={toggleReg} />
          </label>

          {freePlan && (
            <FreePlanForm
              settings={freePlan}
              onSaved={(next) => {
                setFreePlan(next)
                setError(null)
                setNotice(t('plan.saved'))
              }}
              onError={(msg) => {
                setNotice(null)
                setError(msg)
              }}
            />
          )}

          <form onSubmit={addUser} className="mt-4 space-y-3 border border-line-soft bg-ink/5 p-3">
            <div className="kicker">{t('admin.addUser')}</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('account.username')}>
                {(p) => (
                  <Input
                    {...p}
                    value={newName}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t('settings.minCharsPlaceholder', { n: 3 })}
                    onChange={(e) => setNewName(e.currentTarget.value)}
                  />
                )}
              </Field>

              <Field label={t('account.password')} hint={t('settings.minChars', { n: MIN_PASSWORD })}>
                {(p) => (
                  <Input
                    {...p}
                    // Readable on purpose: the admin has to be able to dictate
                    // this password to the person it belongs to.
                    type="text"
                    value={newPass}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setNewPass(e.currentTarget.value)}
                  />
                )}
              </Field>

              <Field label={t('settings.role')}>
                {(p) => (
                  <Select {...p} value={newRole} onChange={(e) => setNewRole(e.currentTarget.value as 'admin' | 'user')}>
                    <option value="user">{t('settings.roleUser')}</option>
                    <option value="admin">{t('settings.roleAdmin')}</option>
                  </Select>
                )}
              </Field>

              {newRole === 'user' && freePlan && (
                <Field label={t('plan.label')}>
                  {(p) => (
                    <Select
                      {...p}
                      value={newPlan ?? freePlan.newAccounts}
                      onChange={(e) => setNewPlan(e.currentTarget.value as Plan)}
                    >
                      <option value="free">{t('plan.free')}</option>
                      <option value="standard">{t('plan.standard')}</option>
                    </Select>
                  )}
                </Field>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 border border-line-soft bg-surface p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={newMustChange}
                onChange={(e) => setNewMustChange(e.target.checked)}
              />
              <span>
                <span className="block text-body font-medium text-ink">{t('settings.mustChangeFirstLogin')}</span>
                <span className="measure mt-0.5 block text-body-sm text-ink-muted">{t('settings.mustChangeFirstLoginHelp')}</span>
              </span>
            </label>

            <Button type="submit" variant="primary" disabled={adding || newName.trim().length < 3 || newPass.length < MIN_PASSWORD}>
              {adding ? t('settings.creating') : t('settings.createAccount')}
            </Button>
          </form>
        </div>

        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('admin.users')}</span>
            <span className="ml-auto font-mono text-caption text-accent-ink">{users.length}</span>
          </div>
          {loading ? (
            <p className="text-body text-ink-faint">{t('common.loading')}</p>
          ) : (
            <ul className="border-t border-line-soft">
              {users.map((u) => {
                const p = presence.get(u.id)
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-2">
                    <span className="text-body text-ink">{u.username}</span>
                    <span
                      className={`px-2 py-0.5 text-caption font-semibold uppercase ${
                        u.role === 'admin' ? 'bg-accent/10 text-accent-ink' : 'bg-ink/5 text-ink-muted'
                      }`}
                    >
                      {u.role === 'admin' ? t('settings.roleAdminShort') : t('settings.roleUser')}
                    </span>
                    {u.role !== 'admin' && u.plan === 'free' && (
                      <span className="bg-ok/10 px-2 py-0.5 text-caption font-semibold uppercase text-ok">{t('plan.free')}</span>
                    )}
                    <span className="text-body-sm">
                      <StateMark state={p?.state || 'offline'} mcp={p?.mcp} />
                    </span>
                    <span className="font-mono text-caption text-ink-faint" title={t('dashboard.users.createdAt')}>
                      {new Date(u.createdAt).toLocaleDateString()}
                      {p?.lastSeen && p.state === 'offline' ? ` · ${f.ago(p.lastSeen, live.data?.now)}` : ''}
                    </span>
                    {u.mustChangePassword && (
                      <span className="flex items-center gap-1 text-caption text-warn" title={t('settings.mustChangeBadgeTitle')}>
                        <Icon name="warning" size={14} />
                        {t('settings.mustChangeBadge')}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {u.username === currentUsername && <span className="text-body-sm text-ink-faint">{t('settings.you')}</span>}
                      {u.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => changePlan(u, u.plan === 'free' ? 'standard' : 'free')}
                          title={t(u.plan === 'free' ? 'plan.setStandardOf' : 'plan.setFreeOf', { name: u.username })}
                        >
                          {t(u.plan === 'free' ? 'plan.setStandard' : 'plan.setFree')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => signOut(u)}
                        title={t('dashboard.users.signOutOf', { name: u.username })}
                      >
                        {t('dashboard.users.signOut')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setError(null)
                          setNotice(null)
                          setResetting(u)
                        }}
                        title={t('settings.resetPasswordOf', { name: u.username })}
                      >
                        {t('account.password')}
                      </Button>
                      {u.username !== currentUsername && (
                        <IconButton label={t('settings.deleteAccountOf', { name: u.username })} onClick={() => removeUser(u)}>
                          <Icon name="trash" size={16} />
                        </IconButton>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Usage below the two columns: it fetches on its own, and a row per
          account with a bar needs the full width to stay readable. */}
      <div className="mt-10 border-t border-line pt-8">
        <UsageReport />
      </div>

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          isSelf={resetting.username === currentUsername}
          onClose={() => setResetting(null)}
          onDone={async (username) => {
            setResetting(null)
            setNotice(t('settings.passwordResetNotice', { name: username }))
            await refresh()
          }}
        />
      )}
    </section>
  )
}

/**
 * The free plan's two settings: which plan a newcomer starts on, and how many
 * generations a free account gets a day (server/plan.js).
 *
 * Saved with a button rather than on every keystroke: typing "15" through "1"
 * would otherwise set a limit of one for as long as the second digit took.
 */
function FreePlanForm({
  settings,
  onSaved,
  onError,
}: {
  settings: FreePlanSettings
  onSaved: (next: FreePlanSettings) => void
  onError: (message: string) => void
}) {
  const t = useT()
  const [newAccounts, setNewAccounts] = useState<Plan>(settings.newAccounts)
  const [limit, setLimit] = useState(String(settings.dailyLimit))
  const [busy, setBusy] = useState(false)

  const parsed = Number(limit)
  const valid = limit.trim() !== '' && Number.isInteger(parsed) && parsed >= 0
  const dirty = newAccounts !== settings.newAccounts || (valid && parsed !== settings.dailyLimit)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      const cfg = await api.admin.setFreePlan({ newAccounts, dailyLimit: parsed })
      onSaved(cfg.freePlan)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-3 border border-line-soft bg-ink/5 p-3">
      <div className="kicker">{t('plan.adminHeading')}</div>
      <p className="measure text-body-sm text-ink-muted">{t('plan.adminBlurb')}</p>

      {!settings.modelConfigured && (
        <Banner tone="warn" className="text-body-sm">
          {t('plan.noModel')}
        </Banner>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('plan.newAccounts')} hint={t('plan.newAccountsHelp')}>
          {(p) => (
            <Select {...p} value={newAccounts} onChange={(e) => setNewAccounts(e.currentTarget.value as Plan)}>
              <option value="free">{t('plan.free')}</option>
              <option value="standard">{t('plan.standard')}</option>
            </Select>
          )}
        </Field>

        <Field label={t('plan.dailyLimit')} hint={t('plan.dailyLimitHelp')}>
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.currentTarget.value)}
            />
          )}
        </Field>
      </div>

      <Button type="submit" variant="primary" disabled={busy || !valid || !dirty}>
        {t('plan.save')}
      </Button>
    </form>
  )
}

/**
 * Set someone's password without asking for theirs — or for the admin's own.
 *
 * Deliberate: an admin who can already delete the account gains nothing from a
 * second prompt, and a locked-out colleague should not have to wait for one.
 */
function ResetPasswordModal({
  user,
  isSelf,
  onClose,
  onDone,
}: {
  user: AdminUser
  isSelf: boolean
  onClose: () => void
  onDone: (username: string) => void | Promise<void>
}) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [mustChange, setMustChange] = useState(!isSelf)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD

  // Reachable both from the form (Enter) and from the footer button, which the
  // Modal renders outside the <form>.
  async function submit(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return
    setBusy(true)
    setError(null)
    try {
      await api.admin.setUserPassword(user.id, password, mustChange)
      await onDone(user.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('settings.resetPasswordTitle', { name: user.username })}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || password.length < MIN_PASSWORD}>
            {busy ? t('settings.resetting') : t('settings.reset')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="measure text-body text-ink-muted">
          {isSelf ? t('settings.resetSelfBlurb') : t('settings.resetOtherBlurb', { name: user.username })}
        </p>

        {user.sso && (
          <Banner tone="warn" title={t('settings.dashyAccount')}>
            {t('settings.dashyAccountHelp')}
          </Banner>
        )}

        <Field
          label={t('settings.newPassword')}
          hint={t('settings.minChars', { n: MIN_PASSWORD })}
          error={tooShort ? t('settings.minChars', { n: MIN_PASSWORD }) : null}
        >
          {(p) => (
            <Input
              {...p}
              // Visible: this password has to be read back and communicated.
              type="text"
              value={password}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
          )}
        </Field>

        <label className="flex cursor-pointer items-start gap-3 border border-line-soft bg-ink/5 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-accent"
            checked={mustChange}
            onChange={(e) => setMustChange(e.target.checked)}
          />
          <span>
            <span className="block text-body font-medium text-ink">{t('settings.mustChangeShort')}</span>
            <span className="measure mt-0.5 block text-body-sm text-ink-muted">{t('settings.mustChangeShortHelp')}</span>
          </span>
        </label>

        {error && (
          <Banner tone="danger" title={t('settings.resetFailed')}>
            {error}
          </Banner>
        )}
      </form>
    </Modal>
  )
}
