import { useEffect, useState } from 'react'
import { api, type AdminUser } from '../lib/api'
import ImageProviderSettings from './ImageProviderSettings'
import TextProviderSettings from './TextProviderSettings'
import UsageReport from './UsageReport'
import { Banner, Button, Field, Icon, IconButton, Input, Modal, Select } from '../ui'
import { useT } from '../i18n'

/** Must match MIN_NEW_PASSWORD in server/index.js — the server is the authority. */
const MIN_PASSWORD = 8

export default function AdminPanel({ currentUsername }: { currentUsername: string }) {
  const t = useT()
  const [allowReg, setAllowReg] = useState(true)
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
  const [adding, setAdding] = useState(false)

  // Password reset dialog — null when closed.
  const [resetting, setResetting] = useState<AdminUser | null>(null)

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
    setNotice(null)
    try {
      await api.admin.addUser(newName.trim(), newPass, newRole, newMustChange)
      setNotice(t('settings.accountCreated', { name: newName.trim() }))
      setNewName('')
      setNewPass('')
      setNewRole('user')
      setNewMustChange(true)
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

  return (
    <div className="border border-line bg-surface px-6 py-6">
      <header className="rule-double pb-3">
        <span className="kicker text-accent-ink">{t('nav.admin')}</span>
        <h2 className="mt-1 text-h2 text-ink">{t('settings.instance')}</h2>
        <p className="measure mt-2 text-body text-ink-muted">{t('settings.adminBlurb')}</p>
      </header>

      {error && (
        <Banner tone="danger" title={t('common.error')} className="mt-4">
          {error}
        </Banner>
      )}
      {notice && !error && (
        <Banner tone="ok" className="mt-4">
          {notice}
        </Banner>
      )}

      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <section>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('settings.access')}</span>
          </div>

          {/* Registration toggle */}
          <label className="flex cursor-pointer items-center justify-between gap-3 border border-line-soft bg-ink/5 p-3">
            <span>
              <span className="block text-body font-medium text-ink">{t('admin.allowSignups')}</span>
              <span className="measure block text-body-sm text-ink-muted">
                {t('settings.allowSignupsHelp')}
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-accent" checked={allowReg} onChange={toggleReg} />
          </label>

          {/* Add user */}
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
                  <Select
                    {...p}
                    value={newRole}
                    onChange={(e) => setNewRole(e.currentTarget.value as 'admin' | 'user')}
                  >
                    <option value="user">{t('settings.roleUser')}</option>
                    <option value="admin">{t('settings.roleAdmin')}</option>
                  </Select>
                )}
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 border border-line-soft bg-surface p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={newMustChange}
                onChange={(e) => setNewMustChange(e.target.checked)}
              />
              <span>
                <span className="block text-body font-medium text-ink">
                  {t('settings.mustChangeFirstLogin')}
                </span>
                <span className="measure mt-0.5 block text-body-sm text-ink-muted">
                  {t('settings.mustChangeFirstLoginHelp')}
                </span>
              </span>
            </label>

            <Button
              type="submit"
              variant="primary"
              disabled={adding || newName.trim().length < 3 || newPass.length < MIN_PASSWORD}
            >
              {adding ? t('settings.creating') : t('settings.createAccount')}
            </Button>
          </form>
        </section>

        {/* Users list */}
        <section>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('admin.users')}</span>
            <span className="ml-auto font-mono text-caption text-accent-ink">{users.length}</span>
          </div>
          {loading ? (
            <p className="text-body text-ink-faint">{t('common.loading')}</p>
          ) : (
            <ul className="border-t border-line-soft">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-2">
                  <span className="text-body text-ink">{u.username}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-caption font-semibold uppercase ${
                      u.role === 'admin' ? 'bg-accent/10 text-accent-ink' : 'bg-ink/5 text-ink-muted'
                    }`}
                  >
                    {u.role === 'admin' ? t('settings.roleAdminShort') : t('settings.roleUser')}
                  </span>
                  <span className="font-mono text-body-sm text-ink-faint">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  {u.mustChangePassword && (
                    <span
                      className="flex items-center gap-1 text-caption text-warn"
                      title={t('settings.mustChangeBadgeTitle')}
                    >
                      <Icon name="warning" size={14} />
                      {t('settings.mustChangeBadge')}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {u.username === currentUsername && (
                      <span className="text-body-sm text-ink-faint">{t('settings.you')}</span>
                    )}
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
                      <IconButton
                        label={t('settings.deleteAccountOf', { name: u.username })}
                        onClick={() => removeUser(u)}
                      >
                        <Icon name="trash" size={16} />
                      </IconButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Usage sits below the two columns rather than inside the account list:
          it fetches on its own, and a row per account with a bar needs the full
          width to stay readable at the sizes the grid gives a column. */}
      <div className="mt-8 border-t border-line pt-8">
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

      {/* Instance-wide model providers */}
      <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-line pt-8 xl:grid-cols-2">
        <TextProviderSettings />
        <ImageProviderSettings />
      </div>
    </div>
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
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy || password.length < MIN_PASSWORD}
          >
            {busy ? t('settings.resetting') : t('settings.reset')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="measure text-body text-ink-muted">
          {isSelf
            ? t('settings.resetSelfBlurb')
            : t('settings.resetOtherBlurb', { name: user.username })}
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
            <span className="block text-body font-medium text-ink">
              {t('settings.mustChangeShort')}
            </span>
            <span className="measure mt-0.5 block text-body-sm text-ink-muted">
              {t('settings.mustChangeShortHelp')}
            </span>
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
