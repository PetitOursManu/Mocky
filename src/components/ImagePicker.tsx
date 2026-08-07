import { useEffect, useRef, useState } from 'react'
import {
  ACCEPTED_IMAGE_TYPES,
  generateImage,
  imageUrl,
  listLibrary,
  uploadImage,
  type LibraryImage,
} from '../lib/imageLibrary'
import { Button, Icon, Input, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * Pick one image: from the library, from a file, or from the provider.
 *
 * Lifted out of ScreenImagesDialog when the video export needed the same three
 * ways in. Deliberately not Bibliothèque, which is the other component that
 * browses the library: that one also deletes images and downloads the whole
 * library as a ZIP, and neither belongs one click away from "choose a picture".
 *
 * The strings keep their `library.swap*` keys even though the component no
 * longer lives in the swap dialog. They are the picker's own words — search,
 * upload, generate — and renaming a key means editing the FR and EN halves of a
 * dictionary for no change anyone can see. The one string that WAS about
 * swapping, the heading, is a prop instead: "Choisir la nouvelle image" is a lie
 * in a dialog that is adding a scene, not replacing anything.
 */
export function ImagePicker({
  projectId,
  heading,
  selected = [],
  disabled = false,
  onPick,
  onError,
}: {
  projectId?: string
  /** What this picker is FOR. The caller's sentence, not the component's. */
  heading: string
  /**
   * Hashes already in use, marked in the grid.
   *
   * A list rather than the single `currentHash` this started as: a video
   * timeline can hold the same picture in several scenes, so "already chosen"
   * is a set from the outset. The swap dialog passes a one-element list.
   */
  selected?: string[]
  disabled?: boolean
  onPick: (hash: string) => void
  onError: (message: string) => void
}) {
  const t = useT()
  const [items, setItems] = useState<LibraryImage[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [prompt, setPrompt] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Debounced AND aborted: cancelling only the timer left two requests racing,
  // and the older one answering last showed results for a query the field no
  // longer held. Same correction as Bibliothèque's.
  useEffect(() => {
    const ctrl = new AbortController()
    const id = setTimeout(() => {
      setLoading(true)
      listLibrary({ q: q.trim() || undefined }, ctrl.signal)
        .then(setItems)
        .catch((e) => {
          if (e?.name !== 'AbortError') onError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => setLoading(false))
    }, 200)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function run<T>(work: () => Promise<T>, use: (out: T) => void) {
    setBusy(true)
    try {
      use(await work())
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const frozen = busy || disabled

  return (
    <div>
      <div className="kicker mb-2 text-accent-ink">{heading}</div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          disabled={disabled}
          placeholder={t('library.swapSearch')}
          onChange={(e) => setQ(e.currentTarget.value)}
          className="min-w-48 flex-1"
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0]
            // Cleared straight away so re-picking the same file still fires.
            e.currentTarget.value = ''
            if (!file) return
            run(
              () => uploadImage(file, { project: projectId }),
              (meta) => onPick(meta.hash),
            )
          }}
        />
        <Button size="sm" disabled={frozen} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={15} />
          {t('library.swapUpload')}
        </Button>
      </div>

      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!prompt.trim()) return
          run(
            () => generateImage(prompt.trim(), { project: projectId }),
            (out) => {
              // A provider that answered without producing anything is not an
              // error, and not an image either. Saying nothing would look like
              // a button that does nothing.
              if (!out) return onError(t('library.swapGenerateSkipped'))
              setPrompt('')
              onPick(out.hash)
            },
          )
        }}
      >
        <Input
          value={prompt}
          disabled={disabled}
          placeholder={t('library.swapGeneratePlaceholder')}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          className="min-w-48 flex-1"
        />
        <Button type="submit" size="sm" variant="primary" disabled={frozen || !prompt.trim()}>
          <Icon name="sparkle" size={15} />
          {busy ? t('library.swapGenerating') : t('library.swapGenerate')}
        </Button>
      </form>

      <div className="mt-3 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-body-sm text-ink-faint">{t('library.swapEmpty')}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.map((m) => (
              <li key={m.hash}>
                <button
                  type="button"
                  disabled={frozen}
                  title={m.prompt}
                  onClick={() => onPick(m.hash)}
                  className={`block w-full overflow-hidden border transition disabled:opacity-40 ${
                    selected.includes(m.hash) ? 'border-accent' : 'border-line-soft hover:border-line'
                  }`}
                >
                  <img src={imageUrl(m.hash)} alt={m.prompt} className="block aspect-[4/3] w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
