import { describe, it, expect } from 'vitest'
import {
  IMAGE_CAP,
  addImage,
  addImages,
  aspectRatioOverridden,
  composeBlocker,
  effectiveAspectRatio,
  emptyDraft,
  filmDurationMs,
  filmSummary,
  forcedThreeD,
  formatSeconds,
  pictureScenes,
  proposalStale,
  removeImage,
  renderBlocker,
  setAspectRatio,
  setBrief,
  setForceThreeD,
  setOutputFormat,
  toRenderInput,
  withProposal,
  type VideoDraft,
} from './draft'
import {
  MAX_SCENES,
  RenderTimelineSchema,
  TEMPLATE_LIMITS,
  VIDEO_TEMPLATES,
  VideoTimelineSchema,
  type RenderTimeline,
  type VideoTimeline,
} from './timeline'

const IMG = 'a'.repeat(64)
const IMG2 = 'b'.repeat(64)
const IMG3 = 'c'.repeat(64)

/**
 * Fixtures go through the REAL entry point, and through the one the panel really
 * receives: `/compose` answers a document the server has already put a theme on,
 * so a corpus built with `VideoTimelineSchema` would be missing the single key
 * that `toRenderInput` exists to deal with.
 */
const proposalOf = (doc: unknown): RenderTimeline => RenderTimelineSchema.parse(doc)

/**
 * A draft with a brief, a selection and a proposal — the state the render fires
 * from.
 *
 * The third argument of `withProposal` is what the compose call really ASKED
 * for, not the button's position: `forcedThreeD` lets the permission overrule
 * the draft, so the two differ exactly when an account lost the right while the
 * panel was open. These fixtures ask for no 3D and press no button.
 */
function withFilm(doc: unknown, over: Partial<VideoDraft> = {}): VideoDraft {
  let draft = setBrief(emptyDraft(), 'un film calme sur nos produits')
  draft = addImage(draft, IMG)
  draft = withProposal(draft, proposalOf(doc), over.forceThreeD === true)
  return { ...draft, ...over }
}

const SLIDESHOW = {
  template: 'slideshow',
  scenes: [
    { imageId: IMG, durationMs: 4000, kenBurns: 'zoom-in' },
    { imageId: IMG2, durationMs: 3000, kenBurns: 'pan-left' },
  ],
  theme: { colors: { background: '#101014' } },
}

const COMPOSED = {
  template: 'composed',
  scenes: [
    {
      durationMs: 4000,
      background: { kind: 'image', imageId: IMG },
      layers: [{ kind: 'heading', text: 'Bonjour' }],
    },
    {
      durationMs: 3500,
      layers: [
        { kind: 'kicker', text: 'La suite' },
        { kind: 'gallery', imageIds: [IMG2, IMG3] },
      ],
    },
  ],
  theme: { fonts: { heading: 'Inter' } },
}

const VERTICAL = {
  template: 'vertical',
  scenes: [{ imageId: IMG, durationMs: 3000 }],
}

const TITLES = {
  template: 'titles',
  scenes: [{ headline: 'Une accroche', durationMs: 3000 }],
}

describe('the pool of pictures', () => {
  it('holds as many as the widest composition in the catalogue', () => {
    // Not a number of its own: `compose.js` refuses a larger selection outright,
    // so a panel that let people pick past it would spend a round trip learning
    // what this constant already knows.
    expect(IMAGE_CAP).toBe(MAX_SCENES)
    expect(IMAGE_CAP).toBe(Math.max(...VIDEO_TEMPLATES.map((t) => TEMPLATE_LIMITS[t].maxScenes)))
  })

  it('takes the same picture only once', () => {
    // A pool, not a running order. The model decides how often a photograph is
    // seen, and picking it twice in the grid says nothing the list does not
    // already say — where `addScene` deliberately allowed a repeat, because a
    // timeline may legitimately open and close on the same picture.
    const twice = addImage(addImage(emptyDraft(), IMG), IMG)
    expect(twice.imageIds).toEqual([IMG])
  })

  it('refuses past the cap rather than growing a selection the server will refuse', () => {
    let draft = emptyDraft()
    for (let i = 0; i < IMAGE_CAP + 3; i++) draft = addImage(draft, `${i}`.padStart(64, 'f'))
    expect(draft.imageIds).toHaveLength(IMAGE_CAP)
  })

  it('adds a batch one at a time, so the cap applies to each', () => {
    // What the variant flow hands back after its second gate. Concatenating
    // would let a batch overflow a pool the flow had just promised had room.
    let draft = emptyDraft()
    for (let i = 0; i < IMAGE_CAP - 1; i++) draft = addImage(draft, `${i}`.padStart(64, 'f'))
    const after = addImages(draft, [IMG, IMG2, IMG3])
    expect(after.imageIds).toHaveLength(IMAGE_CAP)
    expect(after.imageIds).toContain(IMG)
    expect(after.imageIds).not.toContain(IMG2)
  })

  it('takes one back out without touching the others', () => {
    const three = addImages(emptyDraft(), [IMG, IMG2, IMG3])
    expect(removeImage(three, IMG2).imageIds).toEqual([IMG, IMG3])
  })
})

describe('composeBlocker', () => {
  it('asks for the sentence, and only for the sentence', () => {
    expect(composeBlocker(emptyDraft())).toBe('no-brief')
    expect(composeBlocker(setBrief(emptyDraft(), 'une vidéo calme'))).toBeNull()
  })

  it('treats a box full of spaces as an empty one', () => {
    // It reaches the server as an empty brief and comes back a 400, having spent
    // a request to say what the disabled button could have said for free.
    expect(composeBlocker(setBrief(emptyDraft(), '   \n '))).toBe('no-brief')
  })

  /**
   * The gate that was removed, and the film it was closing the door on.
   *
   * It used to demand a picture before anything could be proposed, because a
   * montage was built FROM a selection. A composed film can be words, shapes and
   * movement on a background with no photograph anywhere in it — so requiring
   * one first would have made the whole reason the blocks exist unreachable
   * through the panel that composes.
   */
  it('proposes a film with no picture at all', () => {
    const wordsOnly = setBrief(emptyDraft(), 'un générique de fin, sur fond noir')
    expect(wordsOnly.imageIds).toEqual([])
    expect(composeBlocker(wordsOnly)).toBeNull()
  })
})

describe('renderBlocker', () => {
  it('has nothing to render before a model has written one', () => {
    expect(renderBlocker(emptyDraft())).toBe('no-proposal')
    expect(renderBlocker(setBrief(emptyDraft(), 'une vidéo'))).toBe('no-proposal')
  })

  it('clears as soon as a proposal lands', () => {
    expect(renderBlocker(withFilm(SLIDESHOW))).toBeNull()
  })
})

describe('proposalStale', () => {
  it('is quiet on a film that answers the request on screen', () => {
    expect(proposalStale(withFilm(SLIDESHOW))).toBe(false)
  })

  it('notices a brief that moved on', () => {
    const draft = withFilm(SLIDESHOW)
    expect(proposalStale(setBrief(draft, 'tout autre chose'))).toBe(true)
  })

  it('ignores a trailing space, because that is not a changed request', () => {
    // The brief is trimmed on the way out and compared trimmed here. Reporting
    // whitespace as a different question would make the notice noise, and a
    // notice people learn to ignore is one that fails the time it was right.
    const draft = withFilm(SLIDESHOW)
    expect(proposalStale(setBrief(draft, `${draft.brief}  `))).toBe(false)
  })

  it('notices a selection that moved on', () => {
    const draft = withFilm(SLIDESHOW)
    expect(proposalStale(addImage(draft, IMG2))).toBe(true)
    expect(proposalStale(removeImage(draft, IMG))).toBe(true)
  })

  /**
   * A remark, never a refusal. The proposed film is still valid and still what
   * the user accepted a moment ago; blocking it would turn a sentence worth
   * reading into a wall, and the fix — ask again — is one press away either way.
   */
  it('never stops the render', () => {
    const moved = setBrief(withFilm(SLIDESHOW), 'autre chose')
    expect(proposalStale(moved)).toBe(true)
    expect(renderBlocker(moved)).toBeNull()
  })

  /**
   * Pressing 3D after a film has come back is a changed REQUEST, exactly like
   * adding a picture: the catalogue the model would be shown is a different one,
   * and the flat film on the panel answers the previous question. Nothing else
   * on screen could say so — the summary counts shots and seconds, and a
   * `solidScene` is neither.
   */
  it('notices the 3D button moving under a film that was composed without it', () => {
    const flat = withFilm(SLIDESHOW)
    expect(proposalStale(flat)).toBe(false)
    expect(proposalStale(setForceThreeD(flat, true))).toBe(true)
    // And back again: it compares what was asked for, not how many times the
    // button was pressed.
    expect(proposalStale(setForceThreeD(setForceThreeD(flat, true), false))).toBe(false)
  })
})

describe('forcedThreeD', () => {
  /**
   * The permission wins over the button, and it is decided here rather than at
   * the call site so that a stale draft cannot spend a round trip learning it.
   *
   * `undefined` is a NO. A server predating the field says nothing at all, and
   * "said nothing" is not "yes" — a permission is the one place a missing value
   * has to fail shut.
   */
  it.each([
    [true, true, true],
    [true, false, false],
    [true, undefined, false],
    [false, true, false],
  ])('button %s + permission %s = %s', (button, allowed, expected) => {
    expect(forcedThreeD(setForceThreeD(emptyDraft(), button), allowed)).toBe(expected)
  })
})

describe('toRenderInput', () => {
  it('answers nothing at all when nothing has been proposed', () => {
    // Never the film that would have passed: assembling one is the repair this
    // feature refuses everywhere, and here it would hand back a film nobody
    // composed and report it as the one that was asked for.
    expect(toRenderInput(emptyDraft())).toBeNull()
  })

  it('drops the theme, which is the server’s key and not the panel’s', () => {
    const out = toRenderInput(withFilm(SLIDESHOW)) as Record<string, unknown>
    expect(out).not.toHaveProperty('theme')
    // And the proof that it matters: `VideoTimelineSchema` is `.strict()`, so a
    // document still carrying one is refused whole — a 400 on a film that was
    // perfectly good, arriving after the click.
    expect(VideoTimelineSchema.safeParse({ ...out, theme: { radiusPx: 4 } }).success).toBe(false)
  })

  it.each([
    ['slideshow', SLIDESHOW],
    ['composed', COMPOSED],
    ['titles', TITLES],
  ])('hands back a %s document the schema accepts', (_name, doc) => {
    const parsed = VideoTimelineSchema.safeParse(toRenderInput(withFilm(doc)))
    expect(parsed.success).toBe(true)
  })

  /**
   * The composed film is the case this whole rewrite is for.
   *
   * The panel used to refuse it: the editor had five row shapes and a stack of
   * typed blocks fitted none of them, so a proposal that came back `composed`
   * was a model call spent on something the form threw away. Nothing is being
   * edited now, so there is nothing left for it to be incompatible with.
   */
  it('renders a stack of blocks, layers and all', () => {
    const out = VideoTimelineSchema.parse(toRenderInput(withFilm(COMPOSED)))
    expect(out.template).toBe('composed')
    expect(out.scenes).toHaveLength(2)
  })

  it('applies the panel’s own output settings over the ones the model defaulted to', () => {
    // The composer is never told about the frame — `/compose` carries a brief,
    // pictures and a theme — so a ratio in its answer is a default rather than
    // an intention, and a selector that lost to a default would be decoration.
    let draft = withFilm(SLIDESHOW)
    draft = setAspectRatio(draft, '1:1')
    draft = setOutputFormat(draft, 'webm')
    const out = VideoTimelineSchema.parse(toRenderInput(draft))
    expect(out.aspectRatio).toBe('1:1')
    expect(out.outputFormat).toBe('webm')
  })

  /**
   * The one film whose ratio is not the selector's to set.
   *
   * `VerticalTimelineSchema` types `aspectRatio` as the literal `9:16`, so
   * forcing 16:9 onto a vertical cut does not widen it — it produces a refused
   * document and an error banner over a proposal that was fine.
   */
  it('leaves a vertical cut at 9:16, and says the selector did not apply', () => {
    const draft = setAspectRatio(withFilm(VERTICAL), '16:9')
    expect(effectiveAspectRatio(draft)).toBe('9:16')
    expect(aspectRatioOverridden(draft)).toBe(true)
    const out = VideoTimelineSchema.parse(toRenderInput(draft))
    expect(out.aspectRatio).toBe('9:16')
  })

  it('reports no override when the selector and the film agree', () => {
    expect(aspectRatioOverridden(setAspectRatio(withFilm(VERTICAL), '9:16'))).toBe(false)
    expect(aspectRatioOverridden(withFilm(SLIDESHOW))).toBe(false)
    // Nothing proposed is not an override either — there is no film to disagree
    // with, and a warning about one would be a sentence about nothing.
    expect(aspectRatioOverridden(emptyDraft())).toBe(false)
    expect(effectiveAspectRatio(emptyDraft())).toBeNull()
  })
})

describe('filmSummary', () => {
  it('says nothing before there is a film', () => {
    expect(filmSummary(emptyDraft())).toBeNull()
  })

  it('counts the shots and adds up the durations', () => {
    expect(filmSummary(withFilm(SLIDESHOW))).toEqual({ scenes: 2, durationMs: 7000, aspectRatio: '16:9' })
  })

  it('quotes the ratio the film will really be rendered at', () => {
    // The effective one, not the selector's: a summary that read 16:9 over a
    // vertical cut would be the panel describing a film it is not about to make.
    expect(filmSummary(setAspectRatio(withFilm(VERTICAL), '16:9'))?.aspectRatio).toBe('9:16')
  })

  it('counts a composed film the same way', () => {
    expect(filmSummary(withFilm(COMPOSED))).toEqual({ scenes: 2, durationMs: 7500, aspectRatio: '16:9' })
  })
})

describe('filmDurationMs', () => {
  /**
   * The case the poll deadline exists for: a panel reopened on a render started
   * before it was closed. There is no proposal in this browser then — only the
   * job's own timeline, out of the queue's journal — and answering 0 would give
   * the shortest possible deadline to the longest film somebody has, and declare
   * a healthy render dead.
   */
  it('reads a document this panel never composed', () => {
    const fromJournal: VideoTimeline = VideoTimelineSchema.parse({
      template: 'slideshow',
      scenes: [
        { imageId: IMG, durationMs: 9000 },
        { imageId: IMG2, durationMs: 6000 },
      ],
    })
    expect(filmDurationMs(fromJournal)).toBe(15000)
  })

  it('answers zero for nothing at all, rather than throwing', () => {
    expect(filmDurationMs(null)).toBe(0)
    expect(filmDurationMs(undefined)).toBe(0)
  })

  /**
   * A document from before the catalogue existed — no `template` at all, which
   * saved drafts and the queue's journal are full of.
   *
   * The schema reads it as a slideshow, and the two readers this panel keeps
   * have to go on working on it. A film somebody can no longer open is silent
   * lost work, and that is the whole reason the reading half of this module
   * survived the scene editor.
   */
  it('reads a document that never named its template', () => {
    const old = VideoTimelineSchema.parse({ scenes: [{ imageId: IMG, durationMs: 5000 }] })
    expect(filmDurationMs(old)).toBe(5000)
    expect(pictureScenes(old)).toEqual([{ imageId: IMG, kenBurns: 'zoom-in' }])
  })
})

describe('pictureScenes', () => {
  it('reads a picture and its camera move off each scene', () => {
    const film = proposalOf(SLIDESHOW)
    expect(pictureScenes(film)).toEqual([
      { imageId: IMG, kenBurns: 'zoom-in' },
      { imageId: IMG2, kenBurns: 'pan-left' },
    ])
  })

  it('leaves a title card with no picture, which is the honest answer', () => {
    // `undersizedScenes` skips an empty id. A scene that paints no photograph
    // cannot enlarge one, and inventing a worst case for it would put a warning
    // on a film that has nothing to be soft.
    expect(pictureScenes(proposalOf(TITLES))).toEqual([{ imageId: '', kenBurns: 'static' }])
  })

  /**
   * The composed scene, and the loop that would have missed it.
   *
   * Its photographs are not on the scene at all: one is the ground, two more are
   * inside a gallery block. A hand-written walk over `scene.imageId` would have
   * reported a film of three enlarged pictures as a film with nothing to say
   * about — which is why this reads `timelineImageIds`, the same walk `/render`
   * and the worker's own client use.
   */
  it('finds the pictures a composed scene keeps in its ground and its blocks', () => {
    expect(pictureScenes(proposalOf(COMPOSED))).toEqual([
      { imageId: IMG, kenBurns: 'static' },
      { imageId: IMG2, kenBurns: 'static' },
      { imageId: IMG3, kenBurns: 'static' },
    ])
  })
})

describe('formatSeconds', () => {
  it('writes the separator the reader uses', () => {
    // A hard-coded dot in a French panel is the kind of detail that makes a
    // whole interface feel translated rather than written.
    expect(formatSeconds(4500, 'fr')).toBe('4,5')
    expect(formatSeconds(4500, 'en')).toBe('4.5')
  })

  it('always shows one decimal, so a duration does not jump a character wide', () => {
    expect(formatSeconds(4000, 'en')).toBe('4.0')
  })
})
