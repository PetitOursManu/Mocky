import { useMemo, useState } from 'react'
import { Banner, Button, Field, Icon, Input, Modal, Select, Spinner } from '../ui'
import { useT } from '../i18n'
import { BLOCK_KINDS, type Block, type BlockKind } from '../lib/blocks'

/**
 * "Save as a block": a name and a kind, nothing else. The element and what it
 * reads were already read off the code (lib/blocks.ts) before this opens, so a
 * refusal never reaches a form the person filled in for nothing.
 */
export function BlockSaveDialog({
  initialName,
  initialKind,
  saving,
  error,
  onSave,
  onClose,
}: {
  initialName: string
  initialKind: BlockKind
  saving: boolean
  error: string | null
  onSave: (name: string, kind: BlockKind) => void
  onClose: () => void
}) {
  const t = useT()
  const [name, setName] = useState(initialName)
  const [kind, setKind] = useState<BlockKind>(initialKind)
  const submit = () => name.trim() && !saving && onSave(name.trim(), kind)
  return (
    <Modal
      title={t('blocks.saveTitle')}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!name.trim() || saving} onClick={submit}>
            {saving ? t('blocks.saving') : t('blocks.confirmSave')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <p className="measure text-body-sm text-ink-muted">{t('blocks.saveHelp')}</p>
        <Field label={t('blocks.name')}>
          {(p) => <Input {...p} autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('blocks.kindLabel')}>
          {(p) => (
            <Select {...p} value={kind} onChange={(e) => setKind(e.currentTarget.value as BlockKind)}>
              {BLOCK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`blocks.kind.${k}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {error && <Banner tone="danger">{error}</Banner>}
      </form>
    </Modal>
  )
}

/**
 * The library: pick a block to insert, rename or delete one. The dialog writes
 * nothing into a screen itself — ProjectView owns the write-back conventions.
 */
export function BlockLibraryDialog({
  blocks,
  failed,
  uses,
  after,
  onInsert,
  onRename,
  onDelete,
  onClose,
}: {
  /** Null while loading. */
  blocks: Block[] | null
  failed: boolean
  /** How many copies of each block this project holds. */
  uses: Record<string, number>
  /** True when the block goes after a picked element, false at the end of the screen. */
  after: boolean
  onInsert: (block: Block) => void
  onRename: (block: Block, name: string) => void
  onDelete: (block: Block) => void
  onClose: () => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!blocks || !q) return blocks ?? []
    return blocks.filter((b) => `${b.name} ${t(`blocks.kind.${b.kind}`)} ${b.from?.screen ?? ''}`.toLowerCase().includes(q))
  }, [blocks, query, t])

  return (
    <Modal title={t('blocks.libraryTitle')} size="md" onClose={onClose}>
      <p className="measure mb-3 text-body-sm text-ink-muted">{t(after ? 'blocks.whereAfter' : 'blocks.whereEnd')}</p>
      {failed && <Banner tone="danger">{t('blocks.loadFailed')}</Banner>}
      {!blocks && !failed && (
        <p className="flex items-center gap-2 text-body-sm text-ink-muted">
          <Spinner />
          {t('blocks.loading')}
        </p>
      )}
      {blocks && blocks.length === 0 && <p className="measure text-body-sm text-ink-faint">{t('blocks.empty')}</p>}
      {blocks && blocks.length > 6 && (
        <Input
          className="mb-2"
          value={query}
          placeholder={t('blocks.search')}
          aria-label={t('blocks.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {blocks && blocks.length > 0 && shown.length === 0 && <p className="text-body-sm text-ink-faint">{t('blocks.noMatch')}</p>}
      <ul className="divide-y divide-line-soft">
        {shown.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 py-2">
            {renaming?.id === b.id ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (renaming.name.trim()) onRename(b, renaming.name.trim())
                  setRenaming(null)
                }}
              >
                <Input
                  autoFocus
                  className="min-w-0 flex-1"
                  value={renaming.name}
                  maxLength={80}
                  aria-label={t('blocks.name')}
                  onChange={(e) => setRenaming({ id: b.id, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setRenaming(null))}
                />
                <Button size="sm" type="submit">
                  {t('blocks.renameSave')}
                </Button>
              </form>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-ink">{b.name}</p>
                <p className="truncate text-caption text-ink-muted">
                  {t(`blocks.kind.${b.kind}`)}
                  {b.from?.screen ? ` · ${t('blocks.from', { screen: b.from.screen })}` : ''}
                  {uses[b.id] ? ` · ${t('blocks.uses', { n: uses[b.id] })}` : ''}
                </p>
              </div>
            )}
            {renaming?.id !== b.id && (
              <>
                <Button size="sm" variant="quiet" aria-label={`${t('blocks.rename')} · ${b.name}`} onClick={() => setRenaming({ id: b.id, name: b.name })}>
                  <Icon name="pencil" size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  aria-label={`${t('blocks.delete')} · ${b.name}`}
                  onClick={() => confirm(t('blocks.deleteConfirm', { name: b.name })) && onDelete(b)}
                >
                  <Icon name="trash" size={14} />
                </Button>
                <Button size="sm" variant="primary" onClick={() => onInsert(b)}>
                  {t('blocks.insert')}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
