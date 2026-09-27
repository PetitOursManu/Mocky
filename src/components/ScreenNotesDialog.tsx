import { useState } from 'react'
import { Button, Icon, IconButton, Modal, Textarea } from '../ui'
import { useLang, useT } from '../i18n'
import type { Screen } from '../lib/project'
import { addNote, editNote, NOTE_MAX_LEN, removeNote, type ScreenNote } from '../lib/screenNotes'

/**
 * The notes a person keeps on one screen. Private to them: nothing here is
 * ever put in a prompt — see `lib/screenNotes.ts`.
 *
 * The dialog says so in its first line, because the composer sits right under
 * it and a field that looks like a place to write TO the model will be read as
 * one. Someone who believes their note steers the next generation, and watches
 * it be ignored, has found a bug that is not there.
 */
export default function ScreenNotesDialog({
  screen,
  onChange,
  onClose,
}: {
  screen: Screen
  onChange: (notes: ScreenNote[] | undefined) => void
  onClose: () => void
}) {
  const t = useT()
  const [lang] = useLang()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const notes = screen.userNotes ?? []

  const when = (n: ScreenNote) => {
    const at = new Date(n.updatedAt ?? n.createdAt).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
    return n.updatedAt ? t('notes.edited', { date: at }) : at
  }

  function add() {
    const next = addNote(screen.userNotes, draft)
    if (next === screen.userNotes) return
    onChange(next)
    setDraft('')
  }

  function saveEdit(id: string) {
    onChange(editNote(screen.userNotes, id, editDraft))
    setEditingId(null)
  }

  return (
    <Modal title={t('notes.title', { name: screen.name })} size="md" onClose={onClose}>
      <p className="measure flex items-start gap-2 text-body-sm text-ink-muted">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
        {t('notes.private')}
      </p>

      {notes.length === 0 ? (
        <p className="mt-4 text-body-sm text-ink-faint">{t('notes.empty')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line-soft bg-raised px-3 py-2">
              {editingId === n.id ? (
                <>
                  <Textarea
                    autoFocus
                    rows={3}
                    maxLength={NOTE_MAX_LEN}
                    value={editDraft}
                    aria-label={t('notes.editLabel')}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(n.id)
                    }}
                    className="w-full"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="quiet" onClick={() => setEditingId(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => saveEdit(n.id)}>
                      {t('notes.save')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-body text-ink">{n.text}</p>
                    <p className="mt-1 text-caption text-ink-faint">{when(n)}</p>
                  </div>
                  <IconButton
                    label={t('notes.edit')}
                    variant="quiet"
                    onClick={() => {
                      setEditDraft(n.text)
                      setEditingId(n.id)
                    }}
                  >
                    <Icon name="pencil" size={16} />
                  </IconButton>
                  <IconButton
                    label={t('notes.delete')}
                    variant="quiet"
                    onClick={() => {
                      if (confirm(t('notes.deleteConfirm'))) onChange(removeNote(screen.userNotes, n.id))
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Textarea
          rows={3}
          maxLength={NOTE_MAX_LEN}
          value={draft}
          placeholder={t('notes.placeholder')}
          aria-label={t('notes.addLabel')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          }}
          className="w-full"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-caption text-ink-faint">{t('notes.shortcut')}</span>
          <Button variant="primary" disabled={!draft.trim()} onClick={add}>
            <Icon name="plus" size={16} />
            {t('notes.add')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
