/**
 * `codeBlock` - code on a panel, arriving line by line or typed out.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       THIS block's own box in pixels, off `composedLayout`. The panel
 *             fills it: see `codeMetrics`.
 *   unit      the type unit its stack agreed on. The listing takes the `body`
 *             step of it, capped by the measure - which is how the type comes
 *             down as the number of lines goes up.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the panel - `palette.panel`, with `palette.panelText`, `palette.panelAccent` and `palette.panelBody` for the three roles, and `palette.panelAccent` for the tab and the caret.
 *
 * LEGIBILITY: A panel is opaque `theme.surface`, so a glyph on it lands on a known colour whatever the ground behind is - which is the whole reason a wall of small monospace goes on a panel rather than on a photograph. What the floor is depends on the ROLE and never on the surface, and this block is where that stopped being free: `plain` is the MAJORITY of a listing - running text, at the `body` step, 21 px on an ordinary stack - and it was mapped to `panelDisplay`, whose floor is 3:1 and whose worst case across the sweep was 3.19:1. The audit licenses 3:1 for type past 24 px, or 18.66 px bold, and a wall of monospace is neither. Raising the type is not the way out either: 64 characters - the schema's own ceiling for a line - at 24 px are 921 px across a 906 px safe measure in 9:16, and a line of code that wraps is a different program on the screen. So `panelText` was added to the palette instead, running text at full strength and 4.5:1, and it is what `plain` reads.
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** A hex
 *      value in this file is a colour nobody measured; a curve is a sixth notion
 *      of how things move. Both arrive as props, out of `composition.js`, where
 *      a test can reach them.
 *   2. **No `remotion` import, ever.** Nothing here needs a frame hook - the
 *      frame arrives as `progress` and `life` - and staying free of it is what
 *      lets `blocks.test.js` load the whole registry inside Mocky's own suite,
 *      where Remotion is not installed.
 *
 * -- Why there is no highlighter, when one costs 2 MB ------------------------
 *
 * `shiki` was measured at 14.6 MB installed and `prismjs` at 2.1 MB, and neither
 * is refused on weight - 2 MB against a 1.57 GB image is nothing. What a
 * highlighter produces is a THEME: twenty to forty hex values, one per token
 * type, none of them measured against the surface this film paints them on.
 * `composedPalette` offers four measured runs on a panel. So a highlighter's
 * thirty colours have exactly two places to go - into this file as hex nobody
 * measured, which is the defect that shipped a dark green headline on a
 * near-black frame and which `blocks.test.js` refuses outright, or collapsed
 * onto measured runs, at which point the highlighter did nothing a role does
 * not. The count moving from three to four changes nothing about that argument,
 * which is the point of it: thirty unmeasured values against any number of
 * measured ones is the same trade.
 *
 * The roles are therefore the schema's, and no language is inferred from a
 * string. That also removes a regex engine running on model-written text inside
 * a render under a deadline, which is a cost nobody would have measured until an
 * export timed out.
 *
 * The type is monospace and the family is NOT written here for the same reason
 * no other family is: `theme.monoFont` is a stack `composition.js` builds, ending
 * in the generic `monospace`, because the container installs one family and a
 * name it does not have renders as hollow boxes burnt into an mp4.
 */
import { CODE_CARET, codeCaret, codeMetrics, codeReveal, panelRadius } from './setPiece.js'

/*
 * A role, and the measured run it reads. See LEGIBILITY above for why `plain` is
 * not `panelDisplay`: it is the majority of the panel and it is running text, so
 * it takes the 4.5:1 floor its size actually earns rather than the display floor
 * the panel happened to have a run at.
 */
const RUNS = {
  plain: 'panelText',
  accent: 'panelAccent',
  muted: 'panelBody',
}

/**
 * The run a line's role takes, and `plain` for anything else.
 *
 * `Object.hasOwn` and not `RUNS[role] ?? RUNS.plain`, for the reason
 * `blockComponent` spells out one directory up: a plain lookup answers for the
 * prototype chain, so `role: "constructor"` hands back a FUNCTION - truthy, so
 * the fallback never fires - and `palette[function]` is `undefined`, whose
 * `.color` throws inside a render half a minute in. The validator refused that
 * value long before a frame; this is the line that makes "read the props as
 * hostile" actually true.
 */
const runFor = (palette, role) => palette[typeof role === 'string' && Object.hasOwn(RUNS, role) ? RUNS[role] : RUNS.plain]

export const CodeBlock = ({ block, palette, theme, box, unit, progress }) => {
  const panel = codeMetrics(block, box, unit)
  const shown = codeReveal(block.lines, block.reveal, progress)
  const typing = codeCaret(block.lines, block.reveal, progress)

  return (
    <div
      style={{
        backgroundColor: palette.panel.color,
        // The project's radius, bounded by the panel it rounds - see
        // `panelRadius`. Written raw it was the one corner in the catalogue with
        // no ceiling on it, and a stated 40 px drew a three-line snippet as a
        // lozenge.
        borderRadius: panelRadius(theme.radiusPx, panel),
        paddingLeft: panel.pad,
        paddingRight: panel.pad,
        paddingTop: panel.padY,
        paddingBottom: panel.padY,
        // The panel is as wide as its own measure plus its padding, which is the
        // BOX whenever the measure is what capped the type - `border-box` so the
        // number `codeMetrics` computed is the number the frame draws. It used to
        // be `maxWidth: 100%` around a size read off the frame, which is how a
        // three-line snippet came out as a small grey card in the middle of a
        // zone it had been given all of.
        width: panel.width,
        boxSizing: 'border-box',
        textAlign: 'left',
        // The panel itself arrives, so a stack of ten lines does not appear as a
        // rectangle with nothing in it while the first line is still typing.
        opacity: Math.min(1, Math.max(0, progress) * 4),
      }}
    >
      {block.caption ? (
        <div
          style={{
            fontFamily: theme.bodyFont,
            // The `caption` step of the shared scale, not a fraction of the code's
            // own size: a tab set at 0.82 of the listing is a fifth size in a film
            // that has five.
            fontSize: panel.captionSize,
            lineHeight: panel.captionLeading,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: palette.panelAccent.color,
            marginBottom: panel.captionGap,
          }}
        >
          {/* Model-written text as a React child: escaped here and nowhere else. */}
          {block.caption}
        </div>
      ) : null}

      {block.lines.map((entry, index) => {
        const run = runFor(palette, entry.role)
        const reveal = shown[index] ?? { chars: entry.text.length, opacity: 1 }
        return (
          <div
            key={index}
            style={{
              fontFamily: theme.monoFont,
              fontSize: panel.size,
              // A string with its unit, because React leaves `lineHeight` alone:
              // a bare 34 is thirty-four TIMES the type size, which is a panel of
              // ten lines a hundred frames tall.
              lineHeight: `${panel.lineHeight}px`,
              color: run.color,
              opacity: reveal.opacity,
              // Never wrapped. A line the panel cannot hold is one `codeMetrics`
              // has already shrunk the type for, and a wrap here would put half a
              // statement on an unnumbered second line - which reads as a
              // different line of code rather than as the same one continued.
              whiteSpace: 'pre',
            }}
          >
            {/* Model-written text as a React child: escaped here and nowhere else. */}
            {entry.text.slice(0, reveal.chars)}
            {typing === index ? (
              <span
                style={{
                  display: 'inline-block',
                  width: Math.max(2, Math.round(panel.size * CODE_CARET * 0.5)),
                  height: Math.round(panel.size * CODE_CARET),
                  marginLeft: Math.round(panel.size * 0.08),
                  backgroundColor: palette.panelAccent.color,
                  verticalAlign: 'baseline',
                }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
