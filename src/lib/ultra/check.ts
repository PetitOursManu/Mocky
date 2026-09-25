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
