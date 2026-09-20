// Admin-configurable image-generation settings, persisted as JSON under
// server/data (same "no database, no native deps" store as the rest of Mocky).
//
// Secrets (API keys/tokens) are stored here but NEVER returned to the browser:
// `publicView()` replaces each with a `has…` boolean. Updates are partial —
// omitting a secret (or sending "") keeps the stored value, so an admin never
// has to retype a key; sending `null` clears it.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DEFAULT_CF_MODEL, DEFAULT_CF_EDIT_MODEL } from './providers/cloudflare.js'
import { DEFAULT_FAL_MODEL, DEFAULT_FAL_EDIT_MODEL, DEFAULT_FAL_VIDEO_MODEL } from './providers/fal.js'
import { createProvider } from './providers/index.js'
import { DEFAULT_FPS, DEFAULT_FRAME_WIDTH, MAX_FRAMES } from '../videos/frames.js'

/** Selectable providers, in the order shown in the Admin UI. */
export const PROVIDER_IDS = ['pollinations', 'fal', 'openai-image', 'cloudflare-workers-ai', 'sd-webui', 'none']

/**
 * Who can be chosen for the 'edit' profile: the providers that answer yes to
 * `supportsInit`.
 *
 * Derived by ASKING each provider rather than kept as a second hand-written
 * list, because the two would drift and the drift is invisible — a provider
 * added to the list without the capability is offered in the panel, accepted on
 * save, and only fails when a user finally edits an image. Instantiating is free
 * here: the factories close over their options and touch nothing.
 */
export const EDIT_PROVIDER_IDS = PROVIDER_IDS.filter((id) => createProvider(id, {}).supportsInit)

/**
 * Who can make a video. Only fal, for now, and that is not an oversight: none of
 * the other configured providers has a text-to-video endpoint at all.
 * '' means the feature is off, which is the default — it costs real money per
 * clip and nobody should discover that by accident.
 */
export const VIDEO_PROVIDER_IDS = ['fal', 'none']

/**
 * Three independent image profiles, because the three jobs are genuinely
 * different:
 *
 *  - 'content'     — the pictures embedded in the generated screen (hero,
 *    produits, backgrounds). Wanted fast and cheap; there can be several per
 *    screen. This is the historical, zero-config path (Pollinations by default).
 *  - 'inspiration' — the single art-direction reference Muse shows to the model.
 *    A different skill entirely: it must render a convincing web/app layout, so
 *    it is worth a slower, stronger (pricier) model.
 *  - 'edit'        — image-to-image: an existing picture goes in, a derivative
 *    comes out. Not a stronger model of the same kind but a different endpoint
 *    of a different model, which most text-to-image ids do not have at all.
 *
 * 'inspiration' and 'edit' are both OPTIONAL, and they are optional in opposite
 * ways. An empty 'inspiration' reuses 'content' — exactly the pre-split
 * behaviour. An empty 'edit' means image-to-image is OFF on this instance, and
 * nothing is substituted: see `resolveImageProfile`.
 */
export const IMAGE_PROFILES = ['content', 'inspiration', 'edit']

/**
 * One profile's settings. `provider: ''` means "not configured".
 *
 * `kind: 'edit'` swaps in the image-to-image model defaults, which are not the
 * same ids: Cloudflare's flux default cannot take an input image at all, and
 * fal's schnell endpoint has no `image_url` field. Inheriting them would ship an
 * edit profile pre-configured to fail.
 */
export function defaultImageProfile(provider = '', kind = 'generate') {
  const edit = kind === 'edit'
  return {
    provider,
    pollinations: { token: '' },
    fal: { apiKey: '', model: edit ? DEFAULT_FAL_EDIT_MODEL : DEFAULT_FAL_MODEL, timeoutSec: 300 },
    // gpt-image-1 serves both /v1/images/generations and /v1/images/edits, so
    // this one default is right for either kind.
    openai: { baseUrl: 'https://api.openai.com', apiKey: '', model: 'gpt-image-1' },
    cloudflare: { accountId: '', apiToken: '', model: edit ? DEFAULT_CF_EDIT_MODEL : DEFAULT_CF_MODEL },
    sdWebui: { baseUrl: 'http://127.0.0.1:7860', steps: 20 },
  }
}

/**
 * Video settings. A separate shape from an image profile because almost nothing
 * is shared: one provider instead of six, a timeout in minutes rather than
 * seconds, and the frame-cutting parameters that have no image equivalent.
 */
export function defaultVideoProfile() {
  return {
    provider: '',
    fal: { apiKey: '', model: DEFAULT_FAL_VIDEO_MODEL, timeoutSec: 600 },
    frames: { fps: DEFAULT_FPS, width: DEFAULT_FRAME_WIDTH, max: MAX_FRAMES },
    /** True once someone has actually SET the frame settings, not merely saved
     *  the form around them. Guards dropLegacyFrames — see its note. */
    framesChosen: false,
  }
}

export function defaultImagesConfig() {
  return {
    content: defaultImageProfile('pollinations'),
    inspiration: defaultImageProfile(''),
    edit: defaultImageProfile('', 'edit'),
    video: defaultVideoProfile(),
  }
}

/** The frame settings that were the defaults before clips became watchable. */
const LEGACY_FRAMES = { fps: 12, width: 960, max: 150 }

/**
 * Forget a persisted frame block that nobody ever chose.
 *
 * `update()` rewrites the WHOLE config, so an admin who once saved an image
 * provider also wrote the frame settings that happened to be the defaults that
 * day. Those values then shadow the defaults for good — raising them in code
 * would change nothing on any instance whose admin had ever pressed Save, and
 * the symptom would be "the new setting does nothing", with no error to explain
 * it.
 *
 * Dropping the block was safe while no interface exposed fps, width or max: an
 * exact match on the old triple could only have been written incidentally, never
 * chosen. The Admin panel now offers those fields, so the shape of the values
 * can no longer tell the two apart — an admin is perfectly entitled to ask for
 * 12 / 960 / 150 on purpose, and a rule that reads intent out of the numbers
 * would undo it on the next boot. A test says so.
 *
 * So intent is recorded instead of inferred. `framesChosen` is set by
 * mergeVideo the first time a patch actually CARRIES a frames block, which only
 * the panel does; the incidental writes that caused this whole problem never
 * did. Once it is true this function never touches the config again.
 */
function dropLegacyFrames(raw) {
  if (raw?.video?.framesChosen) return raw
  const f = raw?.video?.frames
  if (!f) return raw
  const same =
    Number(f.fps) === LEGACY_FRAMES.fps &&
    Number(f.width) === LEGACY_FRAMES.width &&
    Number(f.max) === LEGACY_FRAMES.max
  if (!same) return raw
  const { frames: _dropped, ...video } = raw.video
  return { ...raw, video }
}

/**
 * Configs written before the split stored ONE profile at the root. Lift it into
 * 'content' so an existing instance keeps generating exactly as before, keys and
 * model intact.
 */
function liftLegacy(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.content || raw.inspiration || raw.edit) return raw // already the new shape
  if (typeof raw.provider !== 'string') return null
  // No 'edit' here on purpose: a config written before image-to-image existed
  // says nothing about it, and the honest reading of silence is "off".
  return { content: raw, inspiration: defaultImageProfile('') }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** undefined/'' → keep; null → clear; string → set. */
const secret = (next, prev) => {
  if (next === null) return ''
  if (next === undefined) return prev
  const s = str(next)
  return s === '' ? prev : s
}

/**
 * Merge one profile.
 *
 * `allowEmpty` lets an optional profile be cleared back to nothing; the content
 * profile must always name a real provider. `ids` narrows what may be selected:
 * the 'edit' profile only accepts providers that can actually take an input
 * image, so a doomed configuration is refused at the moment it is saved rather
 * than at the moment someone edits an image — the panel greys them out, and this
 * is the same rule on the side an HTTP client cannot bypass.
 */
function mergeProfile(current, patch, { allowEmpty = false, ids = PROVIDER_IDS, kind = 'generate' } = {}) {
  const fallback = defaultImageProfile(allowEmpty ? '' : 'pollinations', kind)
  const base = { ...fallback, ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}

  const out = {
    provider: ids.includes(p.provider) || (allowEmpty && p.provider === '') ? p.provider : base.provider,
    pollinations: {
      token: secret(p.pollinations?.token, base.pollinations?.token || ''),
    },
    fal: {
      // `fallback`, not the module constant: an admin who clears the model field
      // on the edit profile must land back on the image-to-image default, not on
      // a text-to-image id that will refuse the input image.
      model: str(p.fal?.model, base.fal?.model) || fallback.fal.model,
      apiKey: secret(p.fal?.apiKey, base.fal?.apiKey || ''),
      // Some models (Seedream Pro…) take ~2 min; allow up to 15.
      timeoutSec:
        Number(p.fal?.timeoutSec) > 0
          ? Math.min(900, Math.round(Number(p.fal.timeoutSec)))
          : base.fal?.timeoutSec || 300,
    },
    openai: {
      baseUrl: str(p.openai?.baseUrl, base.openai?.baseUrl) || 'https://api.openai.com',
      model: str(p.openai?.model, base.openai?.model) || 'gpt-image-1',
      apiKey: secret(p.openai?.apiKey, base.openai?.apiKey || ''),
    },
    cloudflare: {
      accountId: str(p.cloudflare?.accountId, base.cloudflare?.accountId),
      model: str(p.cloudflare?.model, base.cloudflare?.model) || fallback.cloudflare.model,
      apiToken: secret(p.cloudflare?.apiToken, base.cloudflare?.apiToken || ''),
    },
    sdWebui: {
      baseUrl: str(p.sdWebui?.baseUrl, base.sdWebui?.baseUrl) || 'http://127.0.0.1:7860',
      steps: Number(p.sdWebui?.steps) > 0 ? Math.min(150, Math.round(Number(p.sdWebui.steps))) : base.sdWebui?.steps || 20,
    },
  }
  return out
}

/** Merge the video section. Same secret rules as an image profile. */
function mergeVideo(current, patch) {
  const base = { ...defaultVideoProfile(), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}
  const f = p.frames && typeof p.frames === 'object' ? p.frames : {}
  const bf = base.frames || defaultVideoProfile().frames
  const clamp = (v, lo, hi, fallback) =>
    Number(v) > 0 ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : fallback
  return {
    provider: VIDEO_PROVIDER_IDS.includes(p.provider) || p.provider === '' ? p.provider : base.provider,
    fal: {
      model: str(p.fal?.model, base.fal?.model) || DEFAULT_FAL_VIDEO_MODEL,
      apiKey: secret(p.fal?.apiKey, base.fal?.apiKey || ''),
      // Video routinely takes minutes; 60 s would time out every single run.
      timeoutSec:
        Number(p.fal?.timeoutSec) > 0
          ? Math.min(1800, Math.round(Number(p.fal.timeoutSec)))
          : base.fal?.timeoutSec || 600,
    },
    // Set the moment a patch carries a frames block at all. The old VideoForm
    // sent { provider, fal } and nothing else, which is precisely why the
    // defaults of the day got frozen into every saved config.
    framesChosen: Boolean(base.framesChosen) || (p.frames && typeof p.frames === 'object'),
    frames: {
      fps: clamp(f.fps, 4, 30, bf.fps),
      width: clamp(f.width, 320, 1920, bf.width),
      max: clamp(f.max, 12, 600, bf.max),
    },
  }
}

/**
 * Apply a partial update. A patch may target one or both profiles; a legacy
 * flat patch is treated as a 'content' patch.
 */
export function mergeImagesConfig(current, patch) {
  const base = liftLegacy(current) || { ...defaultImagesConfig(), ...(current || {}) }
  const p = liftLegacy(patch) || (patch && typeof patch === 'object' ? patch : {})
  return {
    content: mergeProfile(base.content, p.content),
    inspiration: mergeProfile(base.inspiration, p.inspiration, { allowEmpty: true }),
    edit: mergeProfile(base.edit, p.edit, { allowEmpty: true, ids: EDIT_PROVIDER_IDS, kind: 'edit' }),
    video: mergeVideo(base.video, p.video),
  }
}

function publicProfile(prof, fallbackProvider, kind = 'generate') {
  const c = { ...defaultImageProfile(fallbackProvider, kind), ...(prof || {}) }
  return {
    provider: c.provider || '',
    pollinations: { hasToken: Boolean(c.pollinations?.token) },
    fal: { model: c.fal?.model || '', hasApiKey: Boolean(c.fal?.apiKey), timeoutSec: c.fal?.timeoutSec ?? 300 },
    openai: { baseUrl: c.openai?.baseUrl || '', model: c.openai?.model || '', hasApiKey: Boolean(c.openai?.apiKey) },
    cloudflare: {
      accountId: c.cloudflare?.accountId || '',
      model: c.cloudflare?.model || '',
      hasApiToken: Boolean(c.cloudflare?.apiToken),
    },
    sdWebui: { baseUrl: c.sdWebui?.baseUrl || '', steps: c.sdWebui?.steps ?? 20 },
  }
}

/** Browser-safe projection: secrets replaced by booleans. */
export function publicImagesConfig(cfg) {
  const c = liftLegacy(cfg) || { ...defaultImagesConfig(), ...(cfg || {}) }
  const v = { ...defaultVideoProfile(), ...(c.video || {}) }
  return {
    providers: PROVIDER_IDS,
    profiles: IMAGE_PROFILES,
    content: publicProfile(c.content, 'pollinations'),
    inspiration: publicProfile(c.inspiration, ''),
    // Its own provider list, shorter than `providers`: the panel must not offer
    // a choice the server will reject, and "why is it missing" deserves an
    // answer in the interface rather than an error after the fact.
    editProviders: EDIT_PROVIDER_IDS,
    edit: publicProfile(c.edit, '', 'edit'),
    videoProviders: VIDEO_PROVIDER_IDS,
    video: {
      provider: v.provider || '',
      fal: { model: v.fal?.model || '', hasApiKey: Boolean(v.fal?.apiKey), timeoutSec: v.fal?.timeoutSec ?? 600 },
      frames: { ...defaultVideoProfile().frames, ...(v.frames || {}) },
    },
  }
}

/**
 * The profile whose settings actually apply, or `null` for an 'edit' profile
 * nobody configured.
 *
 * 'inspiration' with no provider of its own falls back to 'content' — the
 * pre-split behaviour, and a harmless one: both make a picture out of a prompt,
 * so the worst case is a less impressive reference image.
 *
 * 'edit' NEVER falls back, and the asymmetry is the whole point. A
 * text-to-image provider handed a source image either refuses — which is what
 * this feature makes them do — or, on a provider that quietly drops unknown
 * fields, renders the prompt alone and hands back a picture the user is told is
 * a derivative of their own. There is no way for anything downstream to tell
 * that apart from a real edit. So an unconfigured 'edit' answers "there is no
 * image-to-image on this instance", which callers must handle, instead of
 * answering with a provider that cannot do the job.
 */
export function resolveImageProfile(cfg, profile = 'content') {
  const c = liftLegacy(cfg) || cfg || defaultImagesConfig()
  if (profile === 'edit') return c.edit?.provider ? c.edit : null
  if (profile === 'inspiration' && c.inspiration?.provider) return c.inspiration
  return c.content || defaultImageProfile('pollinations')
}

export class ImagesConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'images-config.json')
    let migrated = false
    this.config = this._load(() => {
      migrated = true
    })
    // Write the migration back ONCE, so it becomes a past event rather than a
    // rule that runs forever. After this the file holds the new numbers
    // explicitly, `dropLegacyFrames` never matches again, and an admin who
    // deliberately types the old triple into the panel keeps it.
    if (migrated) this._write()
  }

  _load(onMigrate) {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      const clean = dropLegacyFrames(raw)
      if (clean !== raw) onMigrate?.()
      return mergeImagesConfig(defaultImagesConfig(), clean)
    } catch {
      return defaultImagesConfig()
    }
  }

  /** Atomic write of the whole config. Never throws — see `update`. */
  _write() {
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      // 0600: this file holds the fal / OpenAI / Cloudflare keys in clear text.
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (err) {
      // Config that can't persist is still applied in memory — never throw.
      // But log it: a read-only volume used to look exactly like success.
      this.lastPersistError = err.message
      console.error(`mocky: could not save image config to ${this.file} — ${err.message}`)
    }
  }

  get() {
    return this.config
  }

  publicView() {
    return publicImagesConfig(this.config)
  }

  /**
   * Settings that apply for a profile. 'inspiration' falls back to 'content';
   * 'edit' returns null when unconfigured and never borrows another profile.
   */
  profile(name = 'content') {
    return resolveImageProfile(this.config, name)
  }

  /** Video settings, always a complete object even on a pre-video config file. */
  videoProfile() {
    return { ...defaultVideoProfile(), ...(this.config.video || {}) }
  }

  /** Merge a partial update, persist atomically, return the new config. */
  update(patch) {
    this.config = mergeImagesConfig(this.config, patch)
    this._write()
    return this.config
  }
}
