import { useEffect, useState } from 'react'
import {
  api,
  type AdminUser,
  type VideoAccessMode,
  type VideoExportConfig,
  type VideoExportConfigPatch,
  type VideoWorkerHealth,
} from '../lib/api'
import { Banner, Button, ButtonLink, Field, Icon, Input, Select } from '../ui'
import { useT } from '../i18n'

/** Translation keys, resolved at render — `useT` only runs inside a component. */
const ACCESS_LABEL_KEYS: Record<string, string> = {
  all: 'video.accessAll',
  allowlist: 'video.accessAllowlist',
}

/**
 * Where Remotion's free tier stops — and what it counts.
 *
 * Three EMPLOYEES of the organisation, which is not a number Mocky holds. The
 * only number this panel can count is accounts on the instance, and the two are
 * unrelated: a one-person company can hand the tool to forty clients, and a
 * two-hundred-employee firm can run it for a single designer.
 */
export const REMOTION_FREE_TIER_SEATS = 3

/**
 * How many accounts a scope opens the export to.
 *
 * 'all' means every account on the instance, so the number that matters there is
 * the user count and not the (usually empty) allowlist — reading the list length
 * would have reported 0 for the widest setting there is.
 */
export function exposedAccountCount(
  access: VideoAccessMode,
  allowedUserIds: string[],
  totalUsers: number,
): number {
  return access === 'all' ? totalUsers : allowedUserIds.length
}

/**
 * Whether the licence reminder is worth showing. Deliberately NOT a verdict.
 *
 * More than three accounts is only the point at which the question becomes worth
 * asking; the banner it raises states the rule and leaves the administrator to
 * apply it. A message asserting "you are over the limit" would be wrong about
 * half the instances that saw it, and a warning that is wrong half the time is
 * one people learn to dismiss — including on the instances where it was right.
 *
 * Gated on `enabled` because an instance whose master switch is off renders
 * nothing at all, and a licence question about renders that cannot happen is
 * exactly the kind of noise that teaches the reflex.
 */
export function licenceReminderDue(
  enabled: boolean,
  access: VideoAccessMode,
  allowedUserIds: string[],
  totalUsers: number,
): boolean {
  return enabled && exposedAccountCount(access, allowedUserIds, totalUsers) > REMOTION_FREE_TIER_SEATS
}

/**
 * Instance-wide video export: the master switch, who may use it, and where the
 * Remotion worker lives.
 *
 * Follows TextProviderSettings / ImageProviderSettings — same section frame,
 * same secret discipline (the licence key is never returned, only a boolean),
 * same "the server's answer re-hydrates the form" rule so a refused worker URL
 * or an ignored access mode is visible instead of believed.
 *
 * What differs is that everything here saves together, under one button. Half a
 * form that persists on change and half that waits for Save is how an admin
 * walks away certain the allowlist took when only the switch did.
 */
export default function VideoExportSettings() {
  const t = useT()

  const [cfg, setCfg] = useState<VideoExportConfig | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)

  // Editable copy of the config. The licence key stays out of it: it is the one
  // field the server never sends back, so its input means "replace it", and an
  // empty one means "keep what is stored".
  const [enabled, setEnabled] = useState(false)
  const [access, setAccess] = useState<VideoAccessMode>('allowlist')
  const [allowed, setAllowed] = useState<string[]>([])
  // The 3D scope is its own pair, not a derived view of the one above: an
  // instance whose worker is short of CPU opens Motion to everyone and 3D to
  // three people, which is the whole configuration this setting exists for.
  const [threeDAccess, setThreeDAccess] = useState<VideoAccessMode>('all')
  const [threeDAllowed, setThreeDAllowed] = useState<string[]>([])
  const [workerUrl, setWorkerUrl] = useState('')
  const [licenseKey, setLicenseKey] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [health, setHealth] = useState<VideoWorkerHealth | null>(null)
  const [checking, setChecking] = useState(false)

  function hydrate(c: VideoExportConfig) {
    setCfg(c)
    setEnabled(c.enabled)
    setAccess(c.access)
    setAllowed(c.allowedUserIds)
    setThreeDAccess(c.threeDAccess)
    setThreeDAllowed(c.threeDAllowedUserIds)
    setWorkerUrl(c.workerUrl || '')
    setLicenseKey('')
    setSaved(false)
  }

  useEffect(() => {
    Promise.all([api.admin.getVideoConfig(), api.admin.listUsers()])
      .then(([c, list]) => {
        hydrate(c)
        setUsers(list)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    probe()
  }, [])

  /** Never rejects: the worker route answers a state, and "unknown" is one too. */
  async function probe() {
    setChecking(true)
    try {
      setHealth(await api.admin.videoWorkerHealth())
    } catch (e) {
      setHealth({ available: false, reason: 'unreachable', detail: e instanceof Error ? e.message : String(e) })
    } finally {
      setChecking(false)
    }
  }

  async function push(patch: VideoExportConfigPatch) {
    const fresh = await api.admin.setVideoConfig(patch)
    hydrate(fresh)
    // The URL may have just changed, so the status line on screen describes the
    // previous one until this returns.
    await probe()
    return fresh
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await push({
        enabled,
        access,
        // The whole list, because the server replaces rather than merges it —
        // sending it without an account is the only way to express a removal.
        // A side effect worth knowing about: ids of accounts that no longer
        // exist are pruned here, since the checkboxes only cover accounts that
        // still do.
        allowedUserIds: allowed,
        threeDAccess,
        threeDAllowedUserIds: threeDAllowed,
        workerUrl: workerUrl.trim() || null,
        // '' would be read as "keep", which is what we want for an untouched
        // field — the key is set only when something was typed.
        licenseKey: licenseKey || undefined,
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearLicenseKey() {
    if (!confirm(t('video.licenseKeyClearConfirm'))) return
    setError(null)
    try {
      await push({ licenseKey: null })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  /** One toggle for both lists: which one it edits is the setter it is given. */
  const toggleIn =
    (setList: (fn: (prev: string[]) => string[]) => void) =>
    (id: string) => {
      setSaved(false)
      setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }

  const header = (
    <header className="rule-thin mb-4 border-accent/40 pb-2">
      <span className="kicker text-accent-ink">{t('settings.instance')}</span>
      <h3 className="mt-1 text-h3 text-ink">{t('video.sectionTitle')}</h3>
    </header>
  )

  if (!cfg) {
    return (
      <section>
        {header}
        <p className="text-body text-ink-faint">{error || t('common.loading')}</p>
      </section>
    )
  }

  const exposed = exposedAccountCount(access, allowed, users.length)
  const sameList = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',')
  const dirty =
    enabled !== cfg.enabled ||
    access !== cfg.access ||
    threeDAccess !== cfg.threeDAccess ||
    licenseKey.length > 0 ||
    (workerUrl.trim() || '') !== (cfg.workerUrl || '') ||
    !sameList(allowed, cfg.allowedUserIds) ||
    // The 3D list is in here for the reason every other field is: everything on
    // this form saves together, and a half-dirty state is how an administrator
    // walks away certain a list took when only the switch did.
    !sameList(threeDAllowed, cfg.threeDAllowedUserIds)

  return (
    <section>
      {header}
      <p className="measure mb-4 text-body-sm text-ink-muted">{t('video.blurb')}</p>

      {error && (
        <Banner tone="danger" title={t('common.error')} className="mb-4">
          {error}
        </Banner>
      )}

      {/* Master switch */}
      <label className="flex cursor-pointer items-center justify-between gap-3 border border-line-soft bg-ink/5 p-3">
        <span>
          <span className="block text-body font-medium text-ink">{t('video.enable')}</span>
          <span className="measure block text-body-sm text-ink-muted">{t('video.enableHelp')}</span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-accent"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked)
            setSaved(false)
          }}
        />
      </label>

      {/* Who may export */}
      <AccountScope
        modes={cfg.accessModes}
        access={access}
        onAccess={(mode) => {
          setAccess(mode)
          setSaved(false)
        }}
        allowed={allowed}
        onToggle={toggleIn(setAllowed)}
        users={users}
        labels={{
          title: 'video.accessTitle',
          help: 'video.accessHelp',
          listTitle: 'video.allowedTitle',
          empty: 'video.allowedEmpty',
          allNote: 'video.allowedAllNote',
        }}
      />

      {/* Who may render in 3D — the same control, because it is the same kind of
          decision. A second widget with its own vocabulary would be a second
          thing to learn about a setting that narrows the one above it. */}
      <AccountScope
        modes={cfg.accessModes}
        access={threeDAccess}
        onAccess={(mode) => {
          setThreeDAccess(mode)
          setSaved(false)
        }}
        allowed={threeDAllowed}
        onToggle={toggleIn(setThreeDAllowed)}
        users={users}
        labels={{
          title: 'video.threeDTitle',
          help: 'video.threeDHelp',
          listTitle: 'video.threeDAllowedTitle',
          empty: 'video.threeDAllowedEmpty',
          allNote: 'video.threeDAllowedAllNote',
        }}
        // Stated where the decision is made rather than in a document: the
        // checkboxes here can only take 3D away from an account that is ticked
        // ABOVE, and an admin who does not know that ticks a name and reports
        // that the setting did nothing.
        footnote="video.threeDNarrowsNote"
      />


      {/* The licence reminder. Non-blocking by construction: it says what the
          rule is, it does not claim the administrator is outside it, and nothing
          below it is disabled while it shows. */}
      {licenceReminderDue(enabled, access, allowed, users.length) && (
        <Banner
          tone="warn"
          title={t('video.licenseWarnTitle')}
          className="mt-4"
          action={
            <ButtonLink
              size="sm"
              href="https://www.remotion.dev/"
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('video.licenseWarnLink')}
              <Icon name="link" size={14} />
            </ButtonLink>
          }
        >
          {t('video.licenseWarnBody', { n: exposed })}
        </Banner>
      )}

      {/* Advanced, folded: an instance that never turns export on never needs
          either of these, and the licence key in particular should not be the
          first thing an administrator meets in this block. */}
      <details className="mt-4 border border-line-soft bg-ink/5 p-3">
        <summary className="cursor-pointer text-body-sm font-medium text-ink">{t('video.advanced')}</summary>

        <div className="mt-3 space-y-4">
          <Field label={t('video.workerUrl')} hint={t('video.workerUrlHint')}>
            {(p) => (
              <Input
                {...p}
                value={workerUrl}
                spellCheck={false}
                autoComplete="off"
                // The compose default, not an example host: it is what the
                // shipped docker-compose.yml creates, and an admin copying the
                // placeholder lands on a working setup.
                placeholder="http://video-worker:3030"
                onChange={(e) => {
                  setWorkerUrl(e.currentTarget.value)
                  setSaved(false)
                }}
              />
            )}
          </Field>

          {/* The telemetry consequence is stated where the key is typed, not in
              a document nobody opens: from Remotion 5.0 a licensed render must
              report, so filling this field is the moment the worker container
              acquires an outbound connection. With no key it has none. */}
          <Field label={t('video.licenseKey')} hint={t('video.licenseKeyHint')}>
            {(p) => (
              <Input
                {...p}
                type="password"
                value={licenseKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={cfg.hasLicenseKey ? '••••••••' : ''}
                onChange={(e) => {
                  setLicenseKey(e.currentTarget.value)
                  setSaved(false)
                }}
              />
            )}
          </Field>
          <div>
            {cfg.hasLicenseKey ? (
              <span className="text-caption text-ok">
                ● {t('video.licenseKeyStored')} —{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-ink"
                  onClick={clearLicenseKey}
                >
                  {t('video.licenseKeyClear')}
                </button>
                <span className="ml-2 text-ink-faint">{t('video.licenseKeyKeep')}</span>
              </span>
            ) : (
              <span className="text-caption text-ink-faint">{t('video.licenseKeyNone')}</span>
            )}
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? t('settings.saving') : t('common.save')}
        </Button>
        <Button variant="ghost" size="sm" onClick={probe} disabled={checking}>
          <Icon name="refresh" size={15} />
          {checking ? t('video.workerChecking') : t('video.workerRecheck')}
        </Button>
        {saved && !dirty && (
          <span className="flex items-center gap-1.5 text-body-sm text-ok">
            <Icon name="check" size={16} />
            {t('settings.saved')}
          </span>
        )}
        {dirty && !saving && <span className="text-body-sm text-warn">{t('video.unsaved')}</span>}
      </div>

      {/* Worker status. Three states, and the reason travels with them: "the
          worker is unavailable" with nothing else said is how a configuration
          problem becomes a support thread. */}
      <WorkerStatus health={health} />
    </section>
  )
}

/**
 * One scope control: a mode, and the accounts it names when the mode is a list.
 *
 * Extracted because there are two of them now — who may export, and who may
 * render in 3D — and they are the same decision about the same accounts. Two
 * copies of this markup would have drifted on the day one of them gained a
 * search box, and the drift would read as two different kinds of permission.
 *
 * Everything it does not decide stays outside: it saves nothing, it knows
 * nothing about the licence reminder, and it never reads the config. The parent
 * owns the form, because the whole form saves under one button.
 */
function AccountScope({
  modes,
  access,
  onAccess,
  allowed,
  onToggle,
  users,
  labels,
  footnote,
}: {
  modes: VideoAccessMode[]
  access: VideoAccessMode
  onAccess: (mode: VideoAccessMode) => void
  allowed: string[]
  onToggle: (id: string) => void
  users: AdminUser[]
  /** Translation KEYS, not strings: `useT` only runs inside a component. */
  labels: { title: string; help: string; listTitle: string; empty: string; allNote: string }
  footnote?: string
}) {
  const t = useT()
  return (
    <div className="mt-4 border border-line-soft bg-ink/5 p-3">
      <Field label={t(labels.title)} hint={t(labels.help)}>
        {(p) => (
          <Select {...p} value={access} onChange={(e) => onAccess(e.currentTarget.value as VideoAccessMode)}>
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {ACCESS_LABEL_KEYS[mode] ? t(ACCESS_LABEL_KEYS[mode]) : mode}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {access === 'allowlist' ? (
        <div className="mt-4">
          <div className="section-head">
            <span className="kicker text-accent-ink">{t(labels.listTitle)}</span>
            <span className="ml-auto font-mono text-caption text-accent-ink">
              {t('video.allowedCount', { n: allowed.length, total: users.length })}
            </span>
          </div>
          <ul className="max-h-64 overflow-y-auto border-t border-line-soft">
            {users.map((u) => (
              <li key={u.id} className="border-b border-line-soft">
                <label className="flex cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={allowed.includes(u.id)}
                    onChange={() => onToggle(u.id)}
                  />
                  <span className="text-body text-ink">{u.username}</span>
                  {u.role === 'admin' && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-caption font-semibold uppercase text-accent-ink">
                      {t('settings.roleAdminShort')}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {allowed.length === 0 && <p className="mt-2 text-caption text-ink-faint">{t(labels.empty)}</p>}
        </div>
      ) : (
        <p className="mt-3 text-caption text-ink-faint">{t(labels.allNote, { total: users.length })}</p>
      )}

      {footnote && <p className="measure mt-3 text-caption text-ink-faint">{t(footnote)}</p>}
    </div>
  )
}

function WorkerStatus({ health }: { health: VideoWorkerHealth | null }) {
  const t = useT()
  if (!health) return null

  const notConfigured = !health.available && health.reason === 'not-configured'
  const label = health.available
    ? health.version
      ? t('video.workerAvailableVersion', { version: health.version })
      : t('video.workerAvailable')
    : notConfigured
      ? t('video.workerNotConfigured')
      : t('video.workerUnreachable')

  return (
    <div className="mt-3 border border-line-soft p-3">
      <span className="kicker text-ink">{t('video.workerStatus')}</span>
      <p
        className={`mt-1 flex items-center gap-1.5 text-body-sm ${
          health.available ? 'text-ok' : notConfigured ? 'text-ink-faint' : 'text-warn'
        }`}
      >
        <Icon name={health.available ? 'check' : notConfigured ? 'close' : 'warning'} size={15} />
        {label}
      </p>
      {/* A refused address is not the same failure as a dead one: Mocky declined
          to call it, so restarting the worker fixes nothing. Worth its own
          sentence, because "unreachable" sends an admin to the container logs of
          a container that was never contacted. */}
      {health.reason === 'blocked-target' && (
        <p className="measure mt-1 text-caption text-ink-muted">{t('video.workerBlockedHint')}</p>
      )}
      {/* "Unreachable" is technically right and practically useless: on a fresh
          instance the overwhelmingly likely cause is that the opt-in Compose
          profile was never started, and the raw fetch error ("aborted due to
          timeout") sends an admin looking for a network fault instead. Name the
          likely cause and give the command. */}
      {health.reason === 'unreachable' && (
        <>
          <p className="measure mt-1 text-caption text-ink-muted">{t('video.workerNotStartedHint')}</p>
          <code className="mt-1 block bg-ink/5 px-2 py-1 font-mono text-caption text-ink">
            docker compose --profile video-export up -d --build
          </code>
        </>
      )}
      {health.detail && !health.available && (
        <p className="measure mt-1 font-mono text-caption text-ink-faint">{health.detail}</p>
      )}
    </div>
  )
}
