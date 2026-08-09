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
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the panel - `palette.panel`, with `palette.panelDisplay`, `palette.panelBody` and `palette.panelAccent`.
 *
 * LEGIBILITY: A panel is opaque `theme.surface`, so a glyph on it lands on a known colour whatever the ground behind is - which is the whole reason a wall of small monospace goes on a panel rather than on a photograph. The three roles are exactly the three runs that surface carries, and that is not a coincidence: it is why there is no syntax highlighter here.
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
 * `composedPalette` offers three measured runs on a panel. So a highlighter's
 * thirty colours have exactly two places to go - into this file as hex nobody
 * measured, which is the defect that shipped a dark green headline on a
 * near-black frame and which `blocks.test.js` refuses outright, or collapsed
 * onto three runs, at which point the highlighter did nothing a role does not.
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
import { codeCaret, codeReveal, codeSize } from './setPiece.js'

/** The panel's padding and the tab's height, as shares of the type size. */
const PAD = 1.1
const TAB = 2.2
const CARET = 0.55

const RUNS = {
  plain: 'panelDisplay',
  accent: 'panelAccent',
  muted: 'panelBody',
}

export const CodeBlock = ({ block, palette, theme, base, progress }) => {
  const size = codeSize(block.lines, base)
  const shown = codeReveal(block.lines, block.reveal, progress)
  const typing = codeCaret(block.lines, block.reveal, progress)
  const pad = Math.round(size * PAD)

  return (
    <div
      style={{
        backgroundColor: palette.panel.color,
        borderRadius: theme.radiusPx,
        padding: pad,
        maxWidth: '100%',
        minWidth: 0,
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
            fontSize: Math.round(size * 0.82),
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: palette.panelAccent.color,
            height: Math.round(size * TAB) / 2,
            marginBottom: Math.round(size * 0.6),
          }}
        >
          {/* Model-written text as a React child: escaped here and nowhere else. */}
          {block.caption}
        </div>
      ) : null}

      {block.lines.map((entry, index) => {
        const run = palette[RUNS[entry.role] ?? RUNS.plain]
        const reveal = shown[index] ?? { chars: entry.text.length, opacity: 1 }
        return (
          <div
            key={index}
            style={{
              fontFamily: theme.monoFont,
              fontSize: size,
              lineHeight: 1.55,
              color: run.color,
              opacity: reveal.opacity,
              // Never wrapped. A line the panel cannot hold is one `codeSize` has
              // already shrunk the type for, and a wrap here would put half a
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
                  width: Math.max(2, Math.round(size * CARET * 0.5)),
                  height: Math.round(size * CARET),
                  marginLeft: Math.round(size * 0.08),
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
