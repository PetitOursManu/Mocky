import { useState } from 'react'
import Preview from './Preview'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'
import { deleteCreation } from '../lib/creations/browser'
import { testScreen, type Creation } from '../lib/creations/stage'

/**
 * What a model made for this account and what was checked before keeping it.
 *
 * A preview is opened on demand, one at a time: each is a live frame running
 * generated code, and a library of forty should not start forty of them.
 */
export default function CreationsGrid({
  creations,
  onRemoved,
}: {
  creations: Creation[]
  onRemoved: (id: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  if (creations.length === 0) {
    return <p className="measure py-10 text-center text-body-sm text-ink-faint">{t('library.creations.empty')}</p>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {creations.map((c) => (
        <article key={c.id} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3">
          <div className="flex items-baseline gap-2">
            <h3 className="min-w-0 truncate font-mono text-body-sm text-ink" title={c.name}>
              {c.name}
            </h3>
            <span className="kicker ml-auto shrink-0">{t(`library.creations.kind.${c.kind}`)}</span>
          </div>
          <p className="mt-1 text-body-sm text-ink-muted">{c.description}</p>
          {c.review && <p className="mt-2 text-caption text-ink-faint">{t('library.creations.reviewed', { text: c.review })}</p>}

          {open === c.id && (
            <div className="mt-3 h-52 overflow-hidden rounded-lg border border-line-soft">
              <Preview code={testScreen(c.source, c.usage)} caps={['icons']} radius="0" />
            </div>
          )}
          {code === c.id && (
            <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-sunken p-2 font-mono text-caption text-ink-muted">{c.source}</pre>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(open === c.id ? null : c.id)}>
              {t(open === c.id ? 'library.creations.hidePreview' : 'library.creations.preview')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCode(code === c.id ? null : c.id)}>
              <Icon name="code" size={14} />
              {t('library.creations.source')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-ink-faint hover:text-danger"
              onClick={async () => {
                if (!confirm(t('library.creations.deleteConfirm', { name: c.name }))) return
                if (await deleteCreation(c.id).catch(() => false)) onRemoved(c.id)
              }}
            >
              <Icon name="trash" size={14} />
              {t('common.delete')}
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}
