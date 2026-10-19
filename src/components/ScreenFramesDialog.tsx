import { useEffect, useState } from 'react'
import { FRAME_FAMILIES, FRAME_SHAPES } from '../lib/frameShapes'
import { FRAME_FOCI, changeScreenFrame, findScreenFrames, type FrameChange, type ScreenFrame } from '../lib/screenFrames'
import { imageUrl } from '../lib/imageLibrary'
import { ImagePicker } from './ImagePicker'
import { FrameArt, ShapeIcon } from './FrameArt'
import { Banner, Button, Icon, Modal, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * The frames of a screen: change a frame's shape, its picture or its framing,
 * or put one of the screen's pictures in a frame — all without a model call.
 *
 * Every change is a few attributes written at offsets the parser vouched for
 * (`lib/screenFrames.ts`); the caller owns `previousCode`, so "Revert" undoes it
 * like any edit. The lists are re-read from `code` after every write, never kept
 * across one: an offset moves with every edit.
 *
 * Its own dialog rather than a section of the media dialog, because the two
 * change different things: that one swaps WHICH picture, this one the SHAPE it
 * is cut into — and a picture in a frame still appears there, to be swapped.
 */

type Target = { kind: 'frame' | 'img'; index: number }
const keyOf = (f: Target) => `${f.kind}:${f.index}`

function ShapePicker({ current, onPick }: { current: string | null; onPick: (id: string) => void }) {
  const t = useT()
  return (
    <div className="space-y-3">
      {FRAME_FAMILIES.map((family) => (
        <div key={family}>
          <p className="kicker mb-1">{t(`frames.family.${family}`)}</p>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
            {FRAME_SHAPES.filter((s) => s.family === family).map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === current}
                aria-label={t(`frames.shape.${s.id}`)}
                title={t(`frames.shape.${s.id}`)}
                onClick={() => onPick(s.id)}
                className={`flex aspect-square items-center justify-center border p-1.5 transition-colors ${
                  s.id === current
                    ? 'border-accent bg-accent/10 text-accent-ink'
                    : 'border-line-soft text-ink-muted hover:border-line hover:text-ink'
                }`}
              >
                <ShapeIcon shape={s.id} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ScreenFramesDialog({
  screenName,
  code,
  projectId,
  onChange,
  onClose,
}: {
  screenName: string
  /** The screen's current source; the lists follow it. */
  code: string
  projectId?: string
  /** Hands the rewritten source back; the caller owns previousCode and Revert. */
  onChange: (nextCode: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [items, setItems] = useState<ScreenFrame[] | null>(null)
  const [open, setOpen] = useState<{ key: string; panel: 'shape' | 'image' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    findScreenFrames(code)
      .then((found) => live && setItems(found))
      .catch(() => live && setItems([]))
    return () => {
      live = false
    }
  }, [code])

  async function apply(target: Target, change: FrameChange) {
    setError(null)
    const next = await changeScreenFrame(code, target, change)
    if (next == null) {
      setError(t('frames.cannotWrite'))
      return
    }
    setOpen(null)
    onChange(next)
  }

  const toggle = (target: Target, panel: 'shape' | 'image') =>
    setOpen((o) => (o?.key === keyOf(target) && o.panel === panel ? null : { key: keyOf(target), panel }))
  const isOpen = (target: Target, panel: 'shape' | 'image') => open?.key === keyOf(target) && open.panel === panel

  const frames = items?.filter((f) => f.kind === 'frame') ?? []
  const pictures = items?.filter((f) => f.kind === 'img') ?? []

  return (
    <Modal
      title={t('frames.title', { name: screenName })}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('frames.close')}
        </Button>
      }
    >
      <p className="measure text-body-sm text-ink-muted">{t('frames.intro')}</p>
      {error && (
        <Banner tone="danger" className="mt-3">
          {error}
        </Banner>
      )}

      {items === null ? (
        <p className="mt-4 flex items-center gap-2 text-body-sm text-ink-faint">
          <Spinner /> {t('frames.loading')}
        </p>
      ) : !frames.length && !pictures.length ? (
        <p className="mt-4 text-body-sm text-ink-faint">{t('frames.empty')}</p>
      ) : null}

      {frames.length > 0 && (
        <div className="mt-5">
          <p className="kicker">{t('frames.inScreen')}</p>
          <ul className="mt-2 space-y-2">
            {frames.map((f) => (
              <li key={keyOf(f)} className="border border-line-soft bg-surface">
                <div className="flex flex-wrap items-center gap-3 p-2">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center">
                    <FrameArt shape={f.shape ?? 'rounded'} src={f.src} className="max-h-20 w-16" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-ink">{t(`frames.shape.${f.shape ?? 'rounded'}`)}</p>
                    <p className="truncate text-caption text-ink-faint">{f.alt || t('frames.noAlt')}</p>
                    {f.repeated && <p className="text-caption text-ink-faint">{t('frames.repeated')}</p>}
                  </div>
                  <label className="flex items-center gap-1.5 text-body-sm text-ink-muted">
                    <input type="checkbox" checked={f.shadow} onChange={(e) => void apply(f, { shadow: e.target.checked })} />
                    {t('frames.shadow')}
                  </label>
                  <Button size="sm" variant={isOpen(f, 'shape') ? 'primary' : 'ghost'} onClick={() => toggle(f, 'shape')}>
                    <Icon name="crop" size={15} />
                    {t('frames.shapeButton')}
                  </Button>
                  <Button
                    size="sm"
                    variant={isOpen(f, 'image') ? 'primary' : 'ghost'}
                    disabled={f.src == null}
                    title={f.src == null ? t('frames.computedSrc') : undefined}
                    onClick={() => toggle(f, 'image')}
                  >
                    <Icon name="image" size={15} />
                    {t('frames.imageButton')}
                  </Button>
                </div>

                {isOpen(f, 'shape') && (
                  <div className="space-y-4 border-t border-line-soft bg-ink/5 p-3">
                    <ShapePicker current={f.shape} onPick={(shape) => void apply(f, { shape })} />
                    <div>
                      <p className="kicker mb-1">{t('frames.focus')}</p>
                      <div className="grid w-24 grid-cols-3 gap-1" role="group" aria-label={t('frames.focus')}>
                        {FRAME_FOCI.map((focus) => {
                          const on = (f.focus ?? 'center') === focus
                          const label = t('frames.focusOf', { name: t(`frames.focus.${focus}`) })
                          return (
                            <button
                              key={focus}
                              type="button"
                              aria-pressed={on}
                              aria-label={label}
                              title={label}
                              onClick={() => void apply(f, { focus })}
                              className={`aspect-square border ${on ? 'border-accent bg-accent' : 'border-line-soft bg-surface hover:border-line'}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {isOpen(f, 'image') && (
                  <div className="border-t border-line-soft bg-ink/5 p-3">
                    <ImagePicker
                      projectId={projectId}
                      heading={t('frames.chooseImage')}
                      selected={f.src?.startsWith('/api/images/') ? [f.src.slice('/api/images/'.length)] : []}
                      onPick={(hash) => void apply(f, { src: imageUrl(hash) })}
                      onError={setError}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pictures.length > 0 && (
        <div className="mt-5">
          <p className="kicker">{t('frames.pictures')}</p>
          <p className="measure mb-2 text-caption text-ink-faint">{t('frames.picturesHint')}</p>
          <ul className="space-y-2">
            {pictures.map((p) => (
              <li key={keyOf(p)} className="border border-line-soft bg-surface">
                <div className="flex items-center gap-3 p-2">
                  <img src={p.src ?? ''} alt="" className="h-16 w-24 shrink-0 border border-line-soft object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-ink">{p.alt || <span className="text-ink-faint">{t('frames.noAlt')}</span>}</p>
                    {p.repeated && <p className="text-caption text-ink-faint">{t('frames.repeated')}</p>}
                  </div>
                  <Button size="sm" variant={isOpen(p, 'shape') ? 'primary' : 'ghost'} onClick={() => toggle(p, 'shape')}>
                    <Icon name="crop" size={15} />
                    {t('frames.frameIt')}
                  </Button>
                </div>
                {isOpen(p, 'shape') && (
                  <div className="border-t border-line-soft bg-ink/5 p-3">
                    <p className="mb-2 text-body-sm text-ink-muted">{t('frames.chooseShape')}</p>
                    <ShapePicker current={null} onPick={(shape) => void apply(p, { shape })} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
