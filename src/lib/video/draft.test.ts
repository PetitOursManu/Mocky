import { describe, it, expect } from 'vitest'
import {
  BULLET_FIELDS,
  DEFAULT_SCENE_DURATION_MS,
  OVERLAY_MAX_LENGTH,
  addScene,
  addTextScene,
  clampDuration,
  draftBlockers,
  draftFromTimeline,
  draftTotalMs,
  emptyDraft,
  formatSeconds,
  moveScene,
  removeScene,
  sceneCap,
  setAspectRatio,
  setBullet,
  setTemplate,
  templateUsesImages,
  toTimelineInput,
  updateScene,
  type TemplateChoice,
  type VideoDraft,
} from './draft'
import {
  DEFAULT_KEN_BURNS,
  DEFAULT_OVERLAY_MOVE,
  MAX_SCENES,
  MAX_TOTAL_DURATION_MS,
  TEMPLATE_LIMITS,
  TEXT_LIMITS,
  VIDEO_TEMPLATES,
  VideoTimelineSchema,
  type SlideshowTimeline,
  type VideoTemplate,
  type VideoTimeline,
} from './timeline'

const IMG = 'a'.repeat(64)
const IMG2 = 'b'.repeat(64)

/**
 * Parsed by the real entry point, then narrowed to the one template the fixture
 * is meant to be. The narrowing is the assertion: a fixture that stopped being
 * what it says would throw here rather than quietly typecheck as something the
 * form has no fields for.
 */
function parsed<T extends VideoTemplate>(template: T, doc: unknown): Extract<VideoTimeline, { template: T }> {
  const out = VideoTimelineSchema.parse(doc)
  if (out.template !== template) throw new Error(`this fixture is meant to be a ${template}`)
  return out as Extract<VideoTimeline, { template: T }>
}

const slideshow = (doc: unknown): SlideshowTimeline => parsed('slideshow', doc)

/** A draft of `n` scenes on one picture, in the composition asked for. */
function withScenes(n: number, template: TemplateChoice = 'slideshow', id = IMG): VideoDraft {
  let d = setTemplate(emptyDraft(), template)
  for (let i = 0; i < n; i++) d = template === 'titles' ? addTextScene(d) : addScene(d, id)
  return d
}

/** Fill every line a composition insists on, so only the case under test fails. */
function complete(draft: VideoDraft): VideoDraft {
  let d = draft
  for (const scene of draft.scenes) {
    d = updateScene(d, scene.key, { headline: 'Une accroche', bandTitle: 'Un titre' })
    d = setBullet(d, scene.key, 0, 'Un argument')
  }
  return d
}

describe('the catalogue on the panel', () => {
  it('opens on automatic, because that is what serves a brief', () => {
    // The default is the position where the model reads the sentence and picks
    // the composition built for it. `slideshow` as the default would make the
    // other four an option discovered by accident, if at all.
    expect(emptyDraft().template).toBe('auto')
  })

  it('has no timeline at all until a composition is chosen', () => {
    // The repair this feature refuses, in its most tempting form: assembling
    // the slideshow that would have passed hands somebody a film in a
    // composition they never chose and calls it the one they asked for.
    expect(toTimelineInput(withScenes(2, 'auto'))).toBeNull()
    expect(draftBlockers(withScenes(2, 'auto'))).toContain('no-template')
  })

  it('asks the schema which compositions use a picture, rather than keeping a list', () => {
    // A sixth composition with no image in it answers correctly on the day it
    // lands, without anybody remembering a boolean somewhere else.
    expect(templateUsesImages('titles')).toBe(false)
    for (const name of VIDEO_TEMPLATES) {
      if (name !== 'titles') expect(templateUsesImages(name)).toBe(true)
    }
  })

  it('caps the scenes at the chosen composition’s own ceiling', () => {
    expect(sceneCap('product')).toBe(TEMPLATE_LIMITS.product.maxScenes)
    // `auto` gets the widest, which is the only honest ceiling while the
    // composition is undecided — and the number `compose.js` refuses a larger
    // selection with, before spending a call on the contradiction.
    expect(sceneCap('auto')).toBe(MAX_SCENES)
  })

  it('opens a new scene inside every composition’s window', () => {
    // An "Add" button whose click puts the draft outside the schema is the
    // defect `DEFAULT_SCENE_DURATION_MS` is chosen to avoid — and the windows
    // are not the same: the product floor is 3 s, the vertical ceiling 8 s.
    for (const name of VIDEO_TEMPLATES) {
      expect(DEFAULT_SCENE_DURATION_MS).toBeGreaterThanOrEqual(TEMPLATE_LIMITS[name].minSceneMs)
      expect(DEFAULT_SCENE_DURATION_MS).toBeLessThanOrEqual(TEMPLATE_LIMITS[name].maxSceneMs)
    }
  })
})

describe('setTemplate', () => {
  it('keeps the pictures when the composition changes', () => {
    // Somebody picks `product` to see what it looks like and goes back. With a
    // scene union in the draft the four pictures they had chosen would be gone
    // by then — punishing a click on a radio button.
    const there = withScenes(3, 'slideshow')
    const back = setTemplate(setTemplate(there, 'product'), 'slideshow')
    expect(back.scenes.map((s) => s.imageId)).toEqual([IMG, IMG, IMG])
  })

  it('pulls the durations into the new window instead of leaving them illegal', () => {
    // A 15 s slideshow beat has no way to be shown by a vertical slider that
    // stops at 8 s, so leaving it would put the draft in a state the form
    // cannot display and the user cannot get out of.
    let d = withScenes(1, 'slideshow')
    d = updateScene(d, d.scenes[0].key, { durationMs: TEMPLATE_LIMITS.slideshow.maxSceneMs })
    expect(setTemplate(d, 'vertical').scenes[0].durationMs).toBe(TEMPLATE_LIMITS.vertical.maxSceneMs)
  })

  it('drops nothing when the new composition holds fewer scenes', () => {
    // Ten pictures into a six-scene product card: the rows stay and the blocker
    // fires. Discarding four of somebody's images to honour a click on a radio
    // button is the helpfulness this feature refuses everywhere else.
    const ten = withScenes(10, 'slideshow')
    const asProduct = setTemplate(ten, 'product')
    expect(asProduct.scenes).toHaveLength(10)
    expect(draftBlockers(asProduct)).toContain('too-many-scenes')
  })

  it('starts the scene settings on the new composition’s defaults when leaving automatic', () => {
    // Under `auto` no camera move is on screen, so the value in the record is a
    // placeholder nobody chose. It is READ off each scene schema rather than
    // written down here, which is why this test kept passing the day `slideshow`
    // stopped defaulting to a held frame — and the assertion that it is never
    // `static` is the part that would have caught the defect.
    const picked = addScene(setTemplate(emptyDraft(), 'auto'), IMG)
    for (const template of ['vertical', 'slideshow'] as const) {
      const move = setTemplate(picked, template).scenes[0].kenBurns
      expect(move, template).toBe(DEFAULT_KEN_BURNS[template])
      expect(move, template).not.toBe('static')
    }
  })

  it('keeps a camera move the user did choose when swapping two real compositions', () => {
    let d = withScenes(1, 'slideshow')
    d = updateScene(d, d.scenes[0].key, { kenBurns: 'pan-left' })
    expect(setTemplate(d, 'vertical').scenes[0].kenBurns).toBe('pan-left')
  })

  it('sets the ratio a vertical cut is typed as, since there is no other', () => {
    // `VerticalTimelineSchema` types `aspectRatio` as the literal 9:16. Leaving
    // 16:9 on the draft would build a document refused whole.
    const wide = setAspectRatio(withScenes(1, 'slideshow'), '16:9')
    expect(setTemplate(wide, 'vertical').aspectRatio).toBe('9:16')
  })
})

describe('addScene', () => {
  it('opens on the schema’s own defaults, neither livelier nor quieter', () => {
    // A hand-built timeline and a model-written one naming the same images must
    // render the same film. They would not if the form opened on a move the
    // schema does not default to — in either direction: the panel used to open on
    // `static` because the schema did, and the day the schema stopped, a form
    // still opening there would have been the defect surviving in the one place
    // nobody thought to look.
    const [scene] = addScene(withScenes(0, 'slideshow'), IMG).scenes
    expect(scene.kenBurns).toBe(DEFAULT_KEN_BURNS.slideshow)
    expect(scene.move).toBe(DEFAULT_OVERLAY_MOVE)
    expect(scene.transitionOut).toBe('crossfade')
    expect(scene.overlayText).toBe('')
  })

  it('never makes the timeline illegal by itself, even at the scene ceiling', () => {
    // The bug this forbids: an "Add" button whose last permitted click puts the
    // draft over the 120 s cap and disables the render button it just filled.
    expect(MAX_SCENES * DEFAULT_SCENE_DURATION_MS).toBeLessThanOrEqual(MAX_TOTAL_DURATION_MS)
    expect(draftBlockers(withScenes(MAX_SCENES, 'slideshow'))).toEqual([])
  })

  it('refuses past the scene ceiling instead of growing a list the API will reject', () => {
    const full = withScenes(MAX_SCENES, 'slideshow')
    expect(addScene(full, IMG2).scenes).toHaveLength(MAX_SCENES)
    // And the ceiling is the CHOSEN composition's, not the widest one.
    const cards = withScenes(TEMPLATE_LIMITS.product.maxScenes, 'product')
    expect(addScene(cards, IMG2).scenes).toHaveLength(TEMPLATE_LIMITS.product.maxScenes)
  })

  it('gives every scene its own key, including two scenes on one picture', () => {
    // A timeline that opens and closes on the same image is normal, so the
    // image id cannot be the React key — two rows would share one.
    const d = addScene(addScene(emptyDraft(), IMG), IMG)
    expect(d.scenes[0].key).not.toBe(d.scenes[1].key)
  })
})

describe('addTextScene', () => {
  it('adds a scene with no picture at all', () => {
    // The one composition whose scene schema has no `imageId`. Adding a card
    // through the picker would mean a picture nothing renders.
    const d = addTextScene(setTemplate(emptyDraft(), 'titles'))
    expect(d.scenes[0].imageId).toBe('')
  })

  it('honours the same ceiling as the picker', () => {
    const full = withScenes(TEMPLATE_LIMITS.titles.maxScenes, 'titles')
    expect(addTextScene(full).scenes).toHaveLength(TEMPLATE_LIMITS.titles.maxScenes)
  })
})

describe('moveScene', () => {
  const three = (): VideoDraft => {
    let d = setTemplate(emptyDraft(), 'slideshow')
    for (const id of [IMG, IMG2, 'c'.repeat(64)]) d = addScene(d, id)
    return d
  }

  it('reorders without touching anything else', () => {
    const d = three()
    const moved = moveScene(d, d.scenes[2].key, -1)
    expect(moved.scenes.map((s) => s.key)).toEqual([d.scenes[0].key, d.scenes[2].key, d.scenes[1].key])
  })

  it('clamps at the ends rather than wrapping', () => {
    // Wrapping sends "up" from the first row to the last, and the user reads
    // that as the row having vanished.
    const d = three()
    expect(moveScene(d, d.scenes[0].key, -1).scenes.map((s) => s.key)).toEqual(d.scenes.map((s) => s.key))
    expect(moveScene(d, d.scenes[2].key, 1).scenes.map((s) => s.key)).toEqual(d.scenes.map((s) => s.key))
  })

  it('ignores a key that is not there', () => {
    const d = three()
    expect(moveScene(d, 'nope', 1)).toEqual(d)
  })
})

describe('clampDuration', () => {
  it('snaps onto the half-second ladder and stays inside the schema’s bounds', () => {
    expect(clampDuration(4200, 'slideshow')).toBe(4000)
    expect(clampDuration(4300, 'slideshow')).toBe(4500)
    expect(clampDuration(100, 'slideshow')).toBe(1000)
    expect(clampDuration(99000, 'slideshow')).toBe(15000)
  })

  it('uses the window of the composition it is given, never one fixed pair', () => {
    // The windows genuinely differ, which is the whole reason this takes a
    // template: a beat legal in a slideshow is refused in a vertical cut.
    expect(clampDuration(99000, 'vertical')).toBe(TEMPLATE_LIMITS.vertical.maxSceneMs)
    expect(clampDuration(1000, 'product')).toBe(TEMPLATE_LIMITS.product.minSceneMs)
  })

  it('survives the empty number input', () => {
    // `Number('')` is 0 and `Number('x')` is NaN; both reach here from a control
    // mid-edit, and a NaN duration is a scene the schema refuses with a message
    // about a field the user never saw.
    expect(clampDuration(NaN, 'slideshow')).toBe(DEFAULT_SCENE_DURATION_MS)
  })

  it('only ever produces whole milliseconds', () => {
    // `durationMs` is `z.number().int()`. A 0.1 s step would have made 4166.66.
    for (const raw of [1234, 5678.9, 12345.5]) expect(Number.isInteger(clampDuration(raw, 'slideshow'))).toBe(true)
  })
})

describe('draftBlockers', () => {
  it('says nothing is there rather than letting an empty render be queued', () => {
    expect(draftBlockers(setTemplate(emptyDraft(), 'slideshow'))).toEqual(['no-scenes'])
  })

  it('catches the total ceiling, which no per-scene bound can', () => {
    // 20 × 15 s is 300 s: every scene legal, the film two and a half times too
    // long. This is the check the per-scene slider cannot make.
    let d = withScenes(MAX_SCENES, 'slideshow')
    d = { ...d, scenes: d.scenes.map((s) => ({ ...s, durationMs: 15000 })) }
    expect(draftTotalMs(d)).toBeGreaterThan(MAX_TOTAL_DURATION_MS)
    expect(draftBlockers(d)).toContain('over-budget')
  })

  it('catches an overlay past the legibility limit', () => {
    const d = withScenes(1, 'slideshow')
    const long = { ...d, scenes: [{ ...d.scenes[0], overlayText: 'x'.repeat(OVERLAY_MAX_LENGTH + 1) }] }
    expect(draftBlockers(long)).toContain('overlay-too-long')
  })

  /**
   * The lines each composition insists on, named one by one.
   *
   * Every one is `min(1)` in the schema, so an empty box is a refused document
   * and not a shorter film. Reported as one "something is missing" they would
   * send somebody hunting through fourteen inputs.
   */
  it.each([
    ['overlay', 'band-title-missing'],
    ['titles', 'headline-missing'],
    ['product', 'headline-missing'],
  ] as const)('names the empty required line of a %s scene', (template, blocker) => {
    expect(draftBlockers(withScenes(1, template))).toContain(blocker)
  })

  it('asks a product card for at least one argument', () => {
    const empty = withScenes(1, 'product')
    expect(draftBlockers(empty)).toContain('bullets-missing')
    const one = setBullet(complete(empty), empty.scenes[0].key, 0, 'Livré en 24 h')
    expect(draftBlockers(one)).not.toContain('bullets-missing')
  })

  it('clears once every required line is filled', () => {
    for (const template of ['overlay', 'titles', 'product'] as const) {
      expect(draftBlockers(complete(withScenes(1, template)))).toEqual([])
    }
  })

  it('catches a line past the bound of the composition showing it', () => {
    const d = complete(withScenes(1, 'product'))
    const long = { ...d, scenes: [{ ...d.scenes[0], cta: 'x'.repeat(TEXT_LIMITS.productCta + 1) }] }
    expect(draftBlockers(long)).toContain('text-too-long')
  })

  /**
   * The defect: a title card kept its row and lost nothing but its picture.
   *
   * `titles` is the one scene kind with no `imageId`, so its rows carry `''`,
   * and `setTemplate` deliberately keeps every row when the selector moves.
   * Fill in a titles draft, switch to a composition that puts a picture on the
   * screen, and the form looked finished — no thumbnail is drawn because there
   * is none, no box is empty, and the button fired a document the schema refuses
   * for `imageId: ''`. The 400 arrived after the click.
   */
  it.each(['slideshow', 'overlay', 'vertical', 'product'] as const)(
    'refuses a %s whose scene lost its picture on the way from a title card',
    (template) => {
      const cards = complete(withScenes(2, 'titles'))
      expect(draftBlockers(cards)).toEqual([])
      const moved = complete(setTemplate(cards, template))
      expect(moved.scenes).toHaveLength(2)
      expect(draftBlockers(moved)).toContain('image-missing')
      expect(toTimelineInput(moved)).not.toBeNull()
      expect(VideoTimelineSchema.safeParse(toTimelineInput(moved)).success).toBe(false)
    },
  )

  it('says nothing about a picture the chosen composition does not use', () => {
    // `titles` has no `imageId` in its scene schema, and `auto` has no scene
    // schema yet — a blocker there would name a box that is deliberately absent.
    expect(draftBlockers(complete(withScenes(2, 'titles')))).toEqual([])
    expect(draftBlockers(withScenes(2, 'auto'))).not.toContain('image-missing')
    expect(draftBlockers(complete(withScenes(1, 'product')))).not.toContain('image-missing')
  })

  it('ignores a field the chosen composition does not render', () => {
    // The flat draft record is what keeps a switched-away headline alive, and
    // this is the other half of that bargain: a slideshow is not blocked by a
    // band title left over from a look somebody tried and abandoned.
    const d = withScenes(1, 'slideshow')
    const leftover = { ...d, scenes: [{ ...d.scenes[0], bandTitle: 'x'.repeat(TEXT_LIMITS.bandTitle + 1) }] }
    expect(draftBlockers(leftover)).toEqual([])
  })
})

describe('OVERLAY_MAX_LENGTH', () => {
  it('comes from the schema, so the input attribute cannot drift from the rule', () => {
    // Typed twice, the form is the half that loses: it would accept 140
    // characters and the render would be refused for a field the user filled in
    // on purpose.
    expect(OVERLAY_MAX_LENGTH).toBe(120)
    const overlong = VideoTimelineSchema.safeParse({
      scenes: [
        {
          imageId: IMG,
          durationMs: 2000,
          textOverlay: { content: 'x'.repeat(OVERLAY_MAX_LENGTH + 1), position: 'bottom' },
        },
      ],
    })
    expect(overlong.success).toBe(false)
  })

  it('draws exactly as many argument boxes as the schema accepts', () => {
    expect(BULLET_FIELDS).toBe(TEXT_LIMITS.productBullets)
  })
})

describe('toTimelineInput', () => {
  /**
   * Every composition, through the real schema.
   *
   * The check that matters is not "it produced an object": it is that a form
   * filled in by hand yields a document the API accepts, for all five. A field
   * emitted on the wrong scene kind is refused by `.strict()`, which is the
   * whole reason this switches on the template rather than spreading the record.
   */
  it.each(VIDEO_TEMPLATES)('produces a %s document the schema accepts', (template) => {
    const d = complete(withScenes(2, template))
    const out = toTimelineInput(d)
    expect(out).not.toBeNull()
    const check = VideoTimelineSchema.safeParse(out)
    expect(check.success).toBe(true)
    if (check.success) expect(check.data.template).toBe(template)
  })

  it('emits nothing of the compositions that were not chosen', () => {
    // The flat draft carries every field; the document must not. A `band` on a
    // slideshow scene is refused whole by `.strict()` — the failure this
    // switch exists to make impossible.
    let d = complete(withScenes(1, 'slideshow'))
    d = updateScene(d, d.scenes[0].key, { bandTitle: 'un titre', headline: 'une accroche', cta: 'acheter' })
    const scene = (toTimelineInput(d) as { scenes: Record<string, unknown>[] }).scenes[0]
    expect(scene).not.toHaveProperty('band')
    expect(scene).not.toHaveProperty('headline')
    expect(scene).not.toHaveProperty('cta')
  })

  it('turns an empty overlay box into null, never into an empty string', () => {
    // `content` is `min(1)`, so '' is a validation failure — and a scene with no
    // caption is the ordinary case, not an error.
    const d = withScenes(1, 'slideshow')
    expect(slideshowScenes(d)[0].textOverlay).toBeNull()
    const spaces = { ...d, scenes: [{ ...d.scenes[0], overlayText: '   ' }] }
    expect(slideshowScenes(spaces)[0].textOverlay).toBeNull()
  })

  it('trims the overlay it does keep', () => {
    const d = withScenes(1, 'slideshow')
    const typed = { ...d, scenes: [{ ...d.scenes[0], overlayText: '  Chapitre 1  ' }] }
    expect(slideshowScenes(typed)[0].textOverlay).toEqual({ content: 'Chapitre 1', position: 'bottom' })
  })

  it('drops the empty argument boxes rather than sending a card with a gap', () => {
    // The schema takes one to three, never exactly three, so two arguments is a
    // two-argument card. An empty string there fails `min(1)` and refuses the
    // whole document.
    let d = complete(withScenes(1, 'product'))
    d = setBullet(d, d.scenes[0].key, 2, '  ')
    const out = toTimelineInput(d) as { scenes: { bullets: string[] }[] }
    expect(out.scenes[0].bullets).toEqual(['Un argument'])
  })

  it('drops the editor’s own fields — the schema is .strict()', () => {
    // `key` exists for React and for nothing else. Leaking it would be refused
    // by the whole-object strictness, which is the point of that strictness.
    const sent = toTimelineInput(withScenes(1, 'slideshow')) as Record<string, unknown>
    expect((sent.scenes as Record<string, unknown>[])[0]).not.toHaveProperty('key')
    expect(VideoTimelineSchema.safeParse(sent).success).toBe(true)
  })
})

/** The slideshow arm of the union, narrowed once so the tests above stay readable. */
function slideshowScenes(draft: VideoDraft) {
  const out = toTimelineInput(draft)
  if (!out || !('template' in out) || out.template !== 'slideshow') throw new Error('expected a slideshow')
  return out.scenes
}

describe('draftFromTimeline', () => {
  const proposed = (): SlideshowTimeline =>
    slideshow({
      scenes: [
        { imageId: IMG, durationMs: 5000, kenBurns: 'zoom-in', transitionOut: 'none' },
        {
          imageId: IMG2,
          durationMs: 3000,
          kenBurns: 'pan-left',
          transitionOut: 'wipe-left',
          textOverlay: { content: 'Chapitre 1', position: 'top' },
        },
      ],
      aspectRatio: '9:16',
      outputFormat: 'webm',
    })

  /**
   * One fixture per composition, all five round-tripped.
   *
   * The whole promise of the "describe it" path — what the user sees in the
   * controls IS the proposal, not a summary of it. It used to hold for one
   * template out of five, and the other four were refused with a sentence after
   * a model call had been spent on them.
   */
  const fixtures: Record<VideoTemplate, VideoTimeline> = {
    slideshow: proposed(),
    overlay: parsed('overlay', {
      template: 'overlay',
      scenes: [
        { imageId: IMG, durationMs: 4000, band: { title: 'Le tableau de bord', position: 'top' } },
        { imageId: IMG2, durationMs: 6000, band: { title: 'Les filtres', subtitle: 'En un clic' } },
      ],
    }),
    vertical: parsed('vertical', {
      template: 'vertical',
      scenes: [{ imageId: IMG, durationMs: 3000, kenBurns: 'zoom-out', textOverlay: { content: 'Ici', position: 'center' } }],
    }),
    titles: parsed('titles', {
      template: 'titles',
      scenes: [
        { headline: 'Nouveau', durationMs: 2000, animation: 'stagger' },
        { headline: 'Disponible', subtitle: 'Dès aujourd’hui', durationMs: 3000 },
      ],
    }),
    product: parsed('product', {
      template: 'product',
      scenes: [
        { imageId: IMG, durationMs: 5000, headline: 'La bouilloire', bullets: ['Acier', 'Silencieuse'], cta: 'Commander' },
      ],
    }),
  }

  it.each(VIDEO_TEMPLATES)('round-trips a %s: the pre-filled form is the proposal', (template) => {
    const timeline = fixtures[template]
    expect(VideoTimelineSchema.parse(toTimelineInput(draftFromTimeline(timeline)))).toEqual(timeline)
  })

  it('moves the selector to whatever composition came back', () => {
    // On `auto` the proposal IS the decision, and the selector following it is
    // what tells the user which film they are now looking at.
    expect(draftFromTimeline(fixtures.product).template).toBe('product')
  })

  it('gives every row its own key, including two scenes on one picture', () => {
    // A proposal is reordered before it is rendered, and the array index as a
    // key is what makes React keep a moved row's DOM attached to the wrong scene.
    const d = draftFromTimeline(slideshow({ scenes: [{ imageId: IMG, durationMs: 2000 }, { imageId: IMG, durationMs: 2000 }] }))
    expect(d.scenes[0].key).not.toBe(d.scenes[1].key)
  })

  it('turns a silent scene into an empty box on the form’s own default position', () => {
    // Not `undefined`: a select with no value reads as its first option, which
    // is `top`, so switching an overlay on later would have moved it.
    const d = draftFromTimeline(proposed())
    expect(d.scenes[0].overlayText).toBe('')
    expect(d.scenes[0].overlayPosition).toBe('bottom')
    expect(d.scenes[1].overlayText).toBe('Chapitre 1')
  })

  it('pads a short argument list to the boxes the form draws', () => {
    // Two arguments, three boxes: the third is empty and is dropped again on the
    // way out. A short array would leave a control bound to `undefined`.
    const d = draftFromTimeline(fixtures.product)
    expect(d.scenes[0].bullets).toHaveLength(BULLET_FIELDS)
    expect(d.scenes[0].bullets[2]).toBe('')
  })

  it('arrives as untouched work, so the next proposal does not warn for nothing', () => {
    expect(draftFromTimeline(proposed()).handEdited).toBe(false)
  })
})

describe('handEdited', () => {
  /**
   * What the overwrite warning is asking about.
   *
   * Recorded rather than inferred: a reordered list of default scenes looks
   * exactly like the order the pictures were picked in, and a running order is
   * the edit that costs the most to redo.
   */
  it('stays false while images are only being chosen', () => {
    // Picking pictures is the proposal's INPUT, so a proposal destroys none of
    // it. Warning here would fire on the ordinary path — pick, describe,
    // propose — and a confirmation people click through is not a confirmation.
    const picked = addScene(addScene(emptyDraft(), IMG), IMG2)
    expect(removeScene(picked, picked.scenes[0].key).handEdited).toBe(false)
  })

  it('stays false when the composition itself is chosen', () => {
    // Choosing what to build is not building it, and a warning before the first
    // proposal is one nobody can act on.
    expect(setTemplate(withScenes(2, 'auto'), 'product').handEdited).toBe(false)
  })

  it.each([
    ['a scene is tuned', (d: VideoDraft) => updateScene(d, d.scenes[0].key, { durationMs: 9000 })],
    ['an argument is typed', (d: VideoDraft) => setBullet(d, d.scenes[0].key, 0, 'Acier')],
    ['the running order changes', (d: VideoDraft) => moveScene(d, d.scenes[0].key, 1)],
    ['the aspect ratio is chosen', (d: VideoDraft) => setAspectRatio(d, '9:16')],
  ])('turns true once %s', (_what, act) => {
    expect(act(withScenes(2, 'slideshow')).handEdited).toBe(true)
  })

  it.each([
    ['a move that hits the end of the list', (d: VideoDraft) => moveScene(d, d.scenes[0].key, -1)],
    ['a patch aimed at a scene that is gone', (d: VideoDraft) => updateScene(d, 'nope', { durationMs: 9000 })],
    ['an argument box that does not exist', (d: VideoDraft) => setBullet(d, d.scenes[0].key, 9, 'x')],
  ])('is not set by %s, which changed nothing', (_what, act) => {
    // The warning has to mean something. Raising it for a click that did not
    // alter the draft is how it becomes noise.
    expect(act(withScenes(2, 'slideshow')).handEdited).toBe(false)
  })
})

describe('removeScene', () => {
  it('removes exactly one row when two share a picture', () => {
    const d = withScenes(2, 'slideshow')
    const left = removeScene(d, d.scenes[0].key)
    expect(left.scenes.map((s) => s.key)).toEqual([d.scenes[1].key])
  })
})

describe('formatSeconds', () => {
  it('follows the reader’s decimal mark', () => {
    // A hard-coded dot in a French panel is how an interface reads as
    // translated rather than written.
    expect(formatSeconds(4500, 'fr')).toBe('4,5')
    expect(formatSeconds(4500, 'en')).toBe('4.5')
  })

  it('always shows one decimal, so a column of durations does not jitter', () => {
    expect(formatSeconds(4000, 'en')).toBe('4.0')
    expect(formatSeconds(120000, 'en')).toBe('120.0')
  })
})
