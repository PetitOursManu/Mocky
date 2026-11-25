import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner, Button, Icon, Panel, Spinner, Textarea } from '../ui'
import { useT } from '../i18n'
import type { Project, ProjectIllustration, Screen } from '../lib/project'
import { themeDocumentFormats, themeDocumentPage } from '../lib/screenThemes'
import { VISUAL_THEME } from '../lib/visuals/families'
import { ILLUSTRATE_MAX_CHARS, TextFileError, blockName, readTextFile, splitBlocks, type TextBlock } from '../lib/visuals/textBlocks'
import type { PageFormatId } from '../lib/pageFormats'

/**
 * "Illustrate a text": paste a long text — an article, a report section, a
 * course — and make a visual for each of its blocks, one click each or all at
 * once.
 *
 * The panel cuts the text (`lib/visuals/textBlocks.ts`, no model) and decides;
 * every generation is the view's, through `runNewScreen` with the Visual type,
 * so each visual is an ordinary screen of the project — versions, review,
 * exports, "Visual…" to switch its family. A screen remembers the DIGEST of the
 * block it came from (`Screen.illustrates`), which is how the panel shows
 * "made" next to a block without keeping a list of its own.
 *
 * The text is the project's (`Project.illustration`), saved as it is typed:
 * closing the panel or reloading the page loses nothing.
 */
export default function IllustratePanel({
  project,
  screens,
  busy,
  progress,
  onSave,
  onMake,
  onFocus,
  onClose,
}: {
  project: Project
  screens: Screen[]
  /** Anything else is running: the panel's own runs wait. */
  busy: boolean
  /** What the running illustration is doing, said in a line. */
  progress: string | null
  onSave: (illustration: ProjectIllustration | undefined) => void
  /** Make one visual per block, in order, at this size. */
  onMake: (blocks: TextBlock[], page: PageFormatId) => void
  onFocus: (screenId: string) => void
  onClose: () => void
}) {
  const t = useT()
  const formats = themeDocumentFormats(VISUAL_THEME) ?? []
  const [text, setText] = useState(project.illustration?.text ?? '')
  const [page, setPage] = useState<PageFormatId>(project.illustration?.page ?? themeDocumentPage(VISUAL_THEME) ?? 'slides')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Saved a moment after typing stops, as the campaign brief is.
  const saved = useRef(JSON.stringify(project.illustration ?? null))
  useEffect(() => {
    const next = text.trim() ? { text, page } : undefined
    const json = JSON.stringify(next ?? null)
    if (json === saved.current) return
    const id = window.setTimeout(() => {
      saved.current = json
      onSave(next)
    }, 500)
    return () => window.clearTimeout(id)
  }, [text, page, onSave])

  const blocks = useMemo(() => splitBlocks(text), [text])
  const madeBy = useMemo(() => {
    const m = new Map<string, Screen>()
    for (const s of screens) if (s.illustrates && !m.has(s.illustrates)) m.set(s.illustrates, s)
    return m
  }, [screens])
  const todo = blocks.filter((b) => !madeBy.has(b.digest))

  async function importFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const read = await readTextFile(file)
      if (!read.trim()) setError(t('visuals.illustrate.emptyFile'))
      else setText(read)
    } catch (err) {
      setError(t(`visuals.illustrate.fileError.${err instanceof TextFileError ? err.message : 'read'}`))
    }
  }

  function make(list: TextBlock[]) {
    if (busy || !list.length) return
    saved.current = JSON.stringify({ text, page })
    onSave({ text, page })
    onMake(list, page)
  }

  return (
    <Panel
      title={t('visuals.illustrate.title')}
      onClose={onClose}
      className="absolute right-4 top-11 flex max-h-[calc(100%-4rem)] w-[24rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl shadow-2xl"
    >
      <div className="min-h-0 space-y-3 overflow-y-auto px-3 py-3">
        <p className="text-body-sm text-ink-muted">{t('visuals.illustrate.intro')}</p>
        {error && <Banner tone="warn">{error}</Banner>}
        {progress && (
          <div className="flex items-center gap-2 text-body-sm text-ink" role="status">
            <Spinner className="h-4 w-4" />
            {progress}
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="illustrate-text" className="kicker">
              {t('visuals.illustrate.text')}
            </label>
            <Button size="sm" variant="quiet" disabled={busy} title={t('visuals.illustrate.importTitle')} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} />
              {t('visuals.illustrate.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,.docx,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                void importFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          <Textarea
            id="illustrate-text"
            rows={7}
            maxLength={ILLUSTRATE_MAX_CHARS}
            value={text}
            placeholder={t('visuals.illustrate.placeholder')}
            onChange={(e) => setText(e.target.value)}
          />
        </section>

        <section className="space-y-2 border-t border-line-soft pt-3">
          <span className="kicker">{t('visuals.illustrate.size')}</span>
          <div className="flex flex-wrap gap-1.5">
            {formats.map((f) => (
              <Button key={f} size="sm" variant="ghost" active={page === f} disabled={busy} onClick={() => setPage(f)}>
                {t(`composer.pageFormat.${f}`)}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-2 border-t border-line-soft pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="kicker">{t('visuals.illustrate.blocks', { count: blocks.length })}</span>
            <Button size="sm" variant="primary" disabled={busy || !todo.length} onClick={() => make(todo)}>
              {t('visuals.illustrate.makeAll', { count: todo.length })}
            </Button>
          </div>
          {blocks.length === 0 ? (
            <p className="text-body-sm text-ink-faint">{t('visuals.illustrate.noBlocks')}</p>
          ) : (
            <ol className="space-y-2">
              {blocks.map((b, i) => {
                const made = madeBy.get(b.digest)
                return (
                  <li key={b.digest + i} className="border border-line-soft bg-surface p-2">
                    <p className="text-caption text-ink-faint">
                      {t('visuals.illustrate.block', { n: i + 1 })}
                      {b.heading ? ` · ${b.heading}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-3 text-body-sm text-ink">{b.heading ? b.text.slice(b.heading.length).trim() : b.text}</p>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {made ? (
                        <Button size="sm" variant="ghost" onClick={() => onFocus(made.id)}>
                          <Icon name="eye" size={14} />
                          {t('visuals.illustrate.show', { name: made.name || blockName(b) })}
                        </Button>
                      ) : null}
                      <Button size="sm" variant={made ? 'quiet' : 'ghost'} disabled={busy} onClick={() => make([b])}>
                        <Icon name="branch" size={14} />
                        {made ? t('visuals.illustrate.again') : t('visuals.illustrate.make')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </Panel>
  )
}
