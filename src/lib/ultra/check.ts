/**
 * What a Motion Ultra screen must still hold, checked on the code.
 *
 * Two moments, one question. After GENERATION: the pictures of the series were
 * paid for one by one, and a page that quietly leaves two of them out has spent
 * money on nothing — the user deserves to hear it. After an EDIT: "change the
 * title" is a request about one line, and a model that answers it by rewriting
 * the screen can drop the frosted surfaces and the pictures with it. Nothing in
 * the edit path would notice, and "Revert" is only useful to someone who knows
 * there is something to revert.
 *
 * Deliberately a report, never a correction. Putting a picture back or
 * restoring a treatment is a generation, with a model call and a new chance to
 * break something; the user decides, with Revert one click away.
 */
import { capabilitiesUsedBy } from '../capabilities/select'
import type { ScreenUltra } from '../project'

/** The generated pictures a screen's code no longer references. */
export function missingUltraImages(code: string, record: Pick<ScreenUltra, 'images'>): string[] {
  return (record.images || []).filter((hash) => !code.includes(hash))
}

/**
 * How much of the page is moving at once, counted on the code.
 *
 * The kit makes motion cheap to write, and a page where every card floats and
 * every heading shines is the "effect on every block" the storyboard prompt
 * warns against — and a real cost: each `<Backdrop>` is blurred layers
 * animating for as long as the page is open, several screens are live on the
 * canvas at once, and the preview is the product. The rule in the prompt says
 * two backdrops; this is where it is checked rather than hoped for.
 *
 * Counted as `className` tokens and `<Backdrop` tags, which is what the kit is
 * written in. Reveals are not counted: they run once, as the section arrives.
 */
export const ULTRA_BUDGET = { backdrops: 2, loops: 6 }

/** Classes that animate for as long as the page is open. */
const LOOPING = ['u-float', 'u-spin-slow', 'u-kenburns', 'u-text-shine', 'u-sheen', 'u-border-beam']

export interface UltraMotionCount {
  backdrops: number
  loops: number
  over: boolean
}

export function ultraMotionCount(code: string): UltraMotionCount {
  const backdrops = (code.match(/<Backdrop\b/g) || []).length
  // Whole tokens only, so `u-sheen` is not counted inside some `menu-sheen`.
  const loops = code.split(/[\s"'`{}]+/).filter((tok) => LOOPING.includes(tok)).length
  return { backdrops, loops, over: backdrops > ULTRA_BUDGET.backdrops || loops > ULTRA_BUDGET.loops }
}

/** Whether the code still uses the Ultra kit at all — a class or <Backdrop>. */
export function usesUltraKit(code: string): boolean {
  return capabilitiesUsedBy(code).includes('ultra')
}

export interface UltraLoss {
  /** Pictures the code referenced before and does not any more. */
  images: string[]
  /** The kit was in use before and is not after. */
  kit: boolean
}

/** What an edit took away from a Motion Ultra screen, or null when nothing. */
export function ultraLoss(before: string, after: string, record: Pick<ScreenUltra, 'images'>): UltraLoss | null {
  const had = (record.images || []).filter((hash) => before.includes(hash))
  const images = had.filter((hash) => !after.includes(hash))
  const kit = usesUltraKit(before) && !usesUltraKit(after)
  return images.length || kit ? { images, kit } : null
}
