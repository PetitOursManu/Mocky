import { useRef, useState } from 'react'
import { Banner, Button, Field, Icon, Input, Textarea } from '../ui'
import { useT } from '../i18n'
import { loadBrands, saveBrand } from '../lib/design'
import {
  BRAND_COLOR_KEYS,
  hasBrand,
  MAX_BRAND_MEDIA,
  MAX_BRANDS,
  newBrandId,
  normalizeBrand,
  RULES_MAX,
  type BrandColorKey,
  type BrandIdentity,
} from '../lib/brand'
import { imageUrl, uploadImage } from '../lib/imageLibrary'
import { FONT_FAMILIES } from '../lib/fonts'
import { ImagePicker } from './ImagePicker'

const empty = (id: string): BrandIdentity => ({ id, name: '', colors: {}, fonts: {}, updatedAt: 0 })

/**
 * "Mes marques" — the account's brand identities (lib/brand.ts), in Settings.
 *
 * One tab per brand and one form, with an explicit Save rather than a save on
 * every keystroke: a brand half-typed is not a brand, and every generation of
 * every project in it reads what is saved here. The logo and the brand's
 * pictures are pictures of the image library like any upload, so a sandboxed
 * preview can show them (M6); taking one off a brand leaves it in the library,
 * which screens may already show (M8).
 *
 * Typefaces are typed against the catalogue (a datalist of its names): a name
 * that is not in it is not saved, because a preview cannot draw a face Mocky
 * does not serve, and a brand typeface that silently falls back is worse than
 * none.
 */
export default function BrandSection() {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [brands, setBrands] = useState<BrandIdentity[]>(() => loadBrands())
  const [brand, setBrand] = useState<BrandIdentity>(() => loadBrands()[0] ?? empty(newBrandId([])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [picking, setPicking] = useState(false)

  const stored = brands.find((b) => b.id === brand.id)

  const change = (patch: Partial<BrandIdentity>) => {
    setBrand((b) => ({ ...b, ...patch }))
    setDirty(true)
    setSaved(false)
  }
  const setColor = (k: BrandColorKey, v: string) => change({ colors: { ...brand.colors, [k]: v || undefined } })

  /** Switch the form to another brand, or to a new one — not over unsaved changes without asking. */
  function open(next: BrandIdentity) {
    if (next.id === brand.id) return
    if (dirty && !window.confirm(t('brand.discardConfirm'))) return
    setBrand(next)
    setDirty(false)
    setSaved(false)
    setError(null)
    setPicking(false)
  }

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const img = await uploadImage(file)
      change({ logo: { hash: img.hash, w: img.width, h: img.height } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    const clean = normalizeBrand({ ...brand, updatedAt: Date.now() })
    if (!hasBrand(clean)) {
      setError(t('brand.needName'))
      return
    }
    if (!saveBrand(clean)) {
      setError(t('brand.saveFailed'))
      return
    }
    const list = loadBrands()
    setBrands(list)
    setBrand(list.find((b) => b.id === clean.id) ?? clean)
    setDirty(false)
    setSaved(true)
    setError(null)
  }

  function remove() {
    if (!stored) return
    if (!window.confirm(t('brand.removeConfirm', { name: stored.name || stored.id }))) return
    saveBrand(null, stored.id)
    const list = loadBrands()
    setBrands(list)
    setBrand(list[0] ?? empty(newBrandId(list)))
    setDirty(false)
    setSaved(false)
  }

  const unknownFont = (name?: string) => !!name?.trim() && !FONT_FAMILIES.some((f) => f.family.toLowerCase() === name.trim().toLowerCase())
  const media = brand.media ?? []

  return (
    <section className="lg:col-span-2">
      <div className="section-head">
        <span className="kicker">{t('brand.title')}</span>
      </div>
      <p className="measure mb-4 text-body text-ink-muted">{t('brand.intro')}</p>

      {/* One tab per brand, then "New brand". */}
      <div role="tablist" aria-label={t('brand.title')} className="mb-4 flex flex-wrap gap-1.5">
        {brands.map((b) => (
          <Button key={b.id} size="sm" role="tab" aria-selected={b.id === brand.id} active={b.id === brand.id} onClick={() => open(b)}>
            {b.logo ? <img src={imageUrl(b.logo.hash)} alt="" className="h-4 w-4 object-contain" /> : <Icon name="star" size={14} />}
            {b.name || b.id}
          </Button>
        ))}
        {!stored && brands.length > 0 && (
          <Button size="sm" role="tab" aria-selected active>
            <Icon name="plus" size={14} />
            {brand.name || t('brand.newBrand')}
          </Button>
        )}
        {stored && brands.length < MAX_BRANDS && (
          <Button size="sm" variant="quiet" onClick={() => open(empty(newBrandId(brands)))}>
            <Icon name="plus" size={14} />
            {t('brand.newBrand')}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      {/* `grid-cols-1` below md for the reason SettingsPanel gives on its own
          grids: an implicit column is as wide as its widest content. */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {/* Stacked below sm. Side by side, a 160px logo frame and "Remplacer le
            logo" asked for more than a phone's column holds, and the hint
            beside them was squeezed to a word per line. */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4 md:col-span-2">
          <div className="flex h-20 w-40 shrink-0 items-center justify-center border border-line-soft bg-ink/5 p-2">
            {brand.logo ? (
              <img src={imageUrl(brand.logo.hash)} alt={t('brand.logo')} className="max-h-full max-w-full object-contain" />
            ) : (
              <Icon name="image" size={24} className="text-ink-faint" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} />
                {brand.logo ? t('brand.logoReplace') : t('brand.logoAdd')}
              </Button>
              {brand.logo && (
                <Button variant="quiet" size="sm" className="text-danger" disabled={busy} onClick={() => change({ logo: undefined })}>
                  <Icon name="trash" size={14} />
                  {t('brand.logoRemove')}
                </Button>
              )}
            </div>
            <p className="measure mt-1.5 text-caption text-ink-faint">{t('brand.logoHint')}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg,image/avif,image/gif" className="hidden" onChange={pickLogo} />
        </div>

        <Field label={t('brand.name')}>
          {(p) => <Input {...p} value={brand.name} maxLength={80} onChange={(e) => change({ name: e.target.value })} placeholder={t('brand.namePlaceholder')} />}
        </Field>
        <Field label={t('brand.tagline')}>
          {(p) => <Input {...p} value={brand.tagline ?? ''} maxLength={160} onChange={(e) => change({ tagline: e.target.value || undefined })} placeholder={t('brand.taglinePlaceholder')} />}
        </Field>
        <Field label={t('brand.website')}>
          {(p) => <Input {...p} value={brand.website ?? ''} maxLength={120} onChange={(e) => change({ website: e.target.value || undefined })} placeholder="exemple.fr" />}
        </Field>

        {/* `min-w-0`: a fieldset's default `min-inline-size` is min-content —
            the one element that will not shrink to its column on its own. */}
        <fieldset className="min-w-0 md:col-span-2">
          <legend className="mb-2 text-body-sm font-medium text-ink">{t('brand.colors')}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {BRAND_COLOR_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-body-sm text-ink-muted">
                <input
                  type="color"
                  value={brand.colors[k] ?? '#000000'}
                  onChange={(e) => setColor(k, e.target.value)}
                  className="h-8 w-10 cursor-pointer border border-line-soft bg-transparent"
                  aria-label={t(`brand.color.${k}`)}
                />
                <span>{t(`brand.color.${k}`)}</span>
                {brand.colors[k] ? (
                  <button type="button" className="text-caption text-ink-faint hover:text-ink" onClick={() => setColor(k, '')} title={t('brand.colorClear')}>
                    ×
                  </button>
                ) : (
                  <span className="text-caption text-ink-faint">—</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t('brand.fontHeading')} error={unknownFont(brand.fonts.heading) ? t('brand.fontUnknown') : null}>
          {(p) => <Input {...p} list="brand-fonts" value={brand.fonts.heading ?? ''} onChange={(e) => change({ fonts: { ...brand.fonts, heading: e.target.value || undefined } })} placeholder="Playfair Display" />}
        </Field>
        <Field label={t('brand.fontBody')} error={unknownFont(brand.fonts.body) ? t('brand.fontUnknown') : null}>
          {(p) => <Input {...p} list="brand-fonts" value={brand.fonts.body ?? ''} onChange={(e) => change({ fonts: { ...brand.fonts, body: e.target.value || undefined } })} placeholder="Inter" />}
        </Field>
        <datalist id="brand-fonts">
          {FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.family} />
          ))}
        </datalist>

        <Field label={t('brand.tone')} className="md:col-span-2">
          {(p) => <Textarea {...p} rows={2} maxLength={300} value={brand.tone ?? ''} onChange={(e) => change({ tone: e.target.value || undefined })} placeholder={t('brand.tonePlaceholder')} />}
        </Field>

        <Field label={t('brand.rules')} hint={t('brand.rulesHint')} className="md:col-span-2">
          {(p) => <Textarea {...p} rows={4} maxLength={RULES_MAX} value={brand.rules ?? ''} onChange={(e) => change({ rules: e.target.value || undefined })} placeholder={t('brand.rulesPlaceholder')} />}
        </Field>

        {/* The brand's own pictures: offered to every new screen in the brand. */}
        <fieldset className="min-w-0 md:col-span-2">
          <legend className="mb-1 text-body-sm font-medium text-ink">{t('brand.media')}</legend>
          <p className="measure mb-2 text-caption text-ink-faint">{t('brand.mediaHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {media.map((h) => (
              <span key={h} className="relative">
                <img src={imageUrl(h)} alt="" className="h-16 w-16 rounded border border-line-soft object-cover" />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-raised text-caption text-ink"
                  aria-label={t('brand.mediaRemove')}
                  title={t('brand.mediaRemove')}
                  onClick={() => change({ media: media.filter((x) => x !== h) })}
                >
                  ×
                </button>
              </span>
            ))}
            {media.length < MAX_BRAND_MEDIA && (
              <Button size="sm" variant="ghost" active={picking} onClick={() => setPicking((v) => !v)}>
                <Icon name="plus" size={14} />
                {t('brand.mediaAdd')}
              </Button>
            )}
          </div>
          {picking && (
            <div className="mt-3">
              <ImagePicker
                heading={t('brand.mediaPick')}
                selected={media}
                compact
                onPick={(hash) => {
                  if (!media.includes(hash)) change({ media: [...media, hash].slice(0, MAX_BRAND_MEDIA) })
                }}
                onError={setError}
              />
            </div>
          )}
        </fieldset>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" disabled={busy || !dirty} onClick={save}>
          {t('brand.save')}
        </Button>
        {stored && (
          <Button variant="quiet" size="sm" className="text-danger" disabled={busy} onClick={remove}>
            {t('brand.remove')}
          </Button>
        )}
        {!stored && brands.length > 0 && (
          <Button variant="quiet" size="sm" onClick={() => open(brands[0])}>
            {t('common.cancel')}
          </Button>
        )}
        {saved && <span className="text-body-sm text-ink-muted">{t('brand.saved')}</span>}
      </div>
      <p className="measure mt-2 text-caption text-ink-faint">{t('brand.howToUse')}</p>
    </section>
  )
}
