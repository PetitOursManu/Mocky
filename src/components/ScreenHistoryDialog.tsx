import { useMemo, useState } from 'react'
import { Banner, Button, Icon, Input, Modal, Spinner } from '../ui'
import { useLang, useT } from '../i18n'
import type { Screen } from '../lib/project'
import { MAIN_BRANCH, screenHistory, VERSION_LABEL_MAX } from '../lib/versions'
import type { VersionsApi } from '../lib/useVersions'

/**
 * Every saved state of one screen — from its own versions AND from every
 * project version that held it (`screenHistory` says why both) — with the two
 * things one does with a past state: look at it beside the present one, and
 * take it back.
 */
export default function ScreenHistoryDialog({
  api,
  screen,
  busy,
  onCompare,
  onClose,
}: {
  api: VersionsApi
  screen: Screen
  busy: boolean
  onCompare: (versionId: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [lang] = useLang()
  const [label, setLabel] = useState('')
  const entries = useMemo(() => screenHistory(api.versions, screen.id), [api.versions, screen.id])
  const when = (at: number) => new Date(at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Modal title={t('versions.screenHistoryTitle', { name: screen.name })} size="md" onClose={onClose}>
      {api.error && <Banner tone="danger">{api.error}</Banner>}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void api.saveScreen(screen.id, label.trim()).then((v) => {
            if (v) setLabel('')
          })
        }}
      >
        <Input
          value={label}
          maxLength={VERSION_LABEL_MAX}
          placeholder={t('versions.labelPlaceholder')}
          aria-label={t('versions.labelLabel')}
          onChange={(e) => setLabel(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button variant="primary" type="submit" disabled={busy || api.working || !screen.code.trim()}>
          {t('versions.saveScreen')}
        </Button>
      </form>

      {api.loading && entries.length === 0 ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-body-sm text-ink-faint">{t('versions.screenHistoryEmpty')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {entries.map(({ version: v }) => (
            <li key={v.id} className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-body text-ink">{v.label || t(`versions.kind.${v.kind}`)}</div>
                <div className="text-caption text-ink-faint">
                  {when(v.createdAt)} · {v.branch === MAIN_BRANCH ? t('versions.mainBranch') : v.branch} ·{' '}
                  {t(v.scope === 'screen' ? 'versions.fromScreen' : 'versions.fromProject')}
                </div>
              </div>
              <Button size="sm" onClick={() => onCompare(v.id)}>
                <Icon name="grid" size={14} />
                {t('versions.compareWithCurrent')}
              </Button>
              <Button
                size="sm"
                disabled={busy || api.working}
                onClick={() => {
                  if (confirm(t('versions.restoreScreenConfirm', { name: screen.name }))) void api.restoreScreen(v.id, screen.id)
                }}
              >
                <Icon name="undo" size={14} />
                {t('versions.restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
