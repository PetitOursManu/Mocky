/**
 * What a new screen's visuals are checked for before the person sees them:
 * figures the request never gave (`numbers.ts`), taken out of the code.
 *
 * No model, no retry: the item keeps its words and loses only the number, and
 * the notice names what went. A family that NEEDS a value on every item (a
 * chart) then draws a bar of nothing for it, which is the honest picture of a
 * text that did not say — and the dialog offers the families that need none.
 */
import { findScreenVisuals, dropVisualValues, VISUAL_COMPONENT } from './read'
import { inventedValues } from './numbers'

export interface DroppedFigure {
  label: string
  value: number
  unit?: string
}

export async function checkVisualFigures(code: string, text: string): Promise<{ code: string; dropped: DroppedFigure[] }> {
  if (!code.includes(`<${VISUAL_COMPONENT}`)) return { code, dropped: [] }
  let out = code
  const dropped: DroppedFigure[] = []
  const visuals = await findScreenVisuals(code)
  // From the last visual back, so a removal never moves an earlier one; each
  // rewrite is parsed again, since offsets move with every edit.
  for (const v of [...visuals].reverse()) {
    const bad = inventedValues(v.doc, text)
    if (!bad.length) continue
    const next = await dropVisualValues(out, v.index, bad)
    if (next == null) continue
    out = next
    // Walking backwards, so each visual's figures go in front of the later ones'.
    dropped.unshift(
      ...bad.map((i) => {
        const it = v.doc!.items[i]
        return { label: it.label, value: it.value as number, ...(it.unit ? { unit: it.unit } : {}) }
      }),
    )
  }
  return { code: out, dropped }
}
