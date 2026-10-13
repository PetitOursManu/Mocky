import { useRef, useState } from 'react'
import { Banner, Button, Field, Icon, Input, Textarea } from '../ui'
import { useT } from '../i18n'
import { loadBrand, saveBrand } from '../lib/design'
import { BRAND_COLOR_KEYS, hasBrand, normalizeBrand, type BrandColorKey, type BrandIdentity } from '../lib/brand'
import { imageUrl, uploadImage } from '../lib/imageLibrary'
import { FONT_FAMILIES } from '../lib/fonts'

const EMPTY: BrandIdentity = { name: '', colors: {}, fonts: {}, updatedAt: 0 }

/**
 * "Ma marque" — the account's brand identity (lib/brand.ts), in Settings.
 *
 * A form with an explicit Save rather than a save on every keystroke: a brand
 * half-typed is not a brand, and every generation of every project that uses
 * it reads what is saved here. The logo goes to the image library like any
 * upload, so a sandboxed preview can show it (M6); removing it here forgets it
 * for the brand and leaves the picture in the library, which other screens may
 * already show (M8).
 *
 * Typefaces are typed against the catalogue (a datalist of its names): a name
 * that is not in it is not saved, because a preview cannot draw a face Mocky
 * does not serve, and a brand typeface that silently falls back is worse than
 * none.
 */
export default function BrandSection() {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [brand, setBrand] = useState<BrandIdentity>(() => loadBrand() ?? EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  const change = (patch: Partial<BrandIdentity>) => {
    setBrand((b) => ({ ...b, ...patch }))
    setDirty(true)
    setSaved(false)
  }
  const setColor = (k: BrandColorKey, v: string) => change({ colors: { ...brand.colors, [k]: v || undefined } })

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
    // Nothing worth keeping (no name, no logo) is a removal, said as such.
    if (!saveBrand(hasBrand(clean) ? clean : null)) {
      setError(t('brand.saveFailed'))
      return
    }
    setBrand(loadBrand() ?? EMPTY)
    setDirty(false)
    setSaved(true)
  }

  function remove() {
    if (!window.confirm(t('brand.removeConfirm'))) return
    saveBrand(null)
    setBrand(EMPTY)
    setDirty(false)
    setSaved(false)
  }

  const unknownFont = (name?: string) => !!name?.trim() && !FONT_FAMILIES.some((f) => f.family.toLowerCase() === name.trim().toLowerCase())

  return (
    <section className="lg:col-span-2">
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('brand.title')}</span>
      </div>
      <p className="measure mb-4 text-body text-ink-muted">{t('brand.intro')}</p>

      {error && (
        <div className="mb-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        <div className="flex items-center gap-4 md:col-span-2">
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

        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-body-sm font-medium text-ink">{t('brand.colors')}</legend>
          <div className="flex flex-wrap gap-4">
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
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" disabled={busy || !dirty} onClick={save}>
          {t('brand.save')}
        </Button>
        {hasBrand(loadBrand()) && (
          <Button variant="quiet" size="sm" className="text-danger" disabled={busy} onClick={remove}>
            {t('brand.remove')}
          </Button>
        )}
        {saved && <span className="text-body-sm text-ink-muted">{t('brand.saved')}</span>}
      </div>
      <p className="measure mt-2 text-caption text-ink-faint">{t('brand.howToUse')}</p>
    </section>
  )
}
