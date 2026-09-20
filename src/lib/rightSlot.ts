/**
 * Who owns the canvas' right-hand slot.
 *
 * There is exactly one place at `absolute right-4 top-11` and three things want
 * it: the Design System inspector, the SEO/accessibility panel, and the Links
 * list that Link mode opens. They were three independent booleans, and each
 * toolbar button turned off the ones its author happened to remember — Audit
 * cleared System, System cleared Audit, and neither cleared Link mode. So Audit
 * and Links painted over each other, to the pixel, with no z-index deciding
 * which won, and the buttons underneath became unreachable.
 *
 * That is the accident `src/ui/Panel.tsx` and `Segmented` in `src/ui/Chip.tsx`
 * both already describe, and it came back for the same reason it happened the
 * first time: exclusivity written as "remember to turn the others off" is
 * exclusivity that holds only until someone adds a fourth panel.
 *
 * So it is one value. Two occupants is not a bug that can be reintroduced here;
 * it is a state the type cannot express.
 *
 * Deliberately NOT in this union: Modify and Annotate. They are canvas picking
 * modes with no panel in this slot, so folding them in would have made opening
 * the Design System inspector silently leave Modify mode — exclusivity where
 * none was asked for is its own defect.
 */
export type RightSlot = 'system' | 'audit' | 'links' | null

/** What a toolbar button does: open this one, or close it if it is already open. */
export function toggleSlot(current: RightSlot, want: NonNullable<RightSlot>): RightSlot {
  return current === want ? null : want
}

/**
 * What a panel's own close button does.
 *
 * Guarded on `which` rather than blanket-clearing, because these handlers
 * outlive their panel by a render: a "Done" in the Links list that fired
 * `setSlot(null)` unconditionally would close whatever had replaced it.
 */
export function closeSlot(current: RightSlot, which: NonNullable<RightSlot>): RightSlot {
  return current === which ? null : current
}
