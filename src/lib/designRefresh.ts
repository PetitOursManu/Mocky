import { hashCode } from './codeHash'

/**
 * Bringing a project's direction up to date from one of its screens.
 *
 * "Make this screen my DESIGN.md" replaces the document, and what it writes has
 * five sections: a Muse dossier handed to it lost its concept and its forbidden
 * list, which are the two things no screen can be read for. A refresh keeps the
 * document and corrects what the screen contradicts. The model is told so, and
 * `restoreLostSections` is what makes it true when the model is careless: an
 * instruction is not a guarantee.
 */

const headingOf = (line: string) => line.replace(/^##\s+/, '').trim().toLowerCase()

/** Cuts a document into its `## ` sections; what precedes the first is not one. */
function sectionsOf(markdown: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = []
  let current: { heading: string; lines: string[] } | null = null
  for (const line of markdown.split('\n')) {
    if (/^##\s+\S/.test(line)) {
      if (current) out.push({ heading: current.heading, text: current.lines.join('\n').trimEnd() })
      current = { heading: headingOf(line), lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) out.push({ heading: current.heading, text: current.lines.join('\n').trimEnd() })
  return out
}

/** `after`, with every section of `before` it dropped put back at the end. */
export function restoreLostSections(before: string, after: string): string {
  const kept = new Set(sectionsOf(after).map((s) => s.heading))
  const lost = sectionsOf(before).filter((s) => !kept.has(s.heading))
  if (lost.length === 0) return after
  return [after.trimEnd(), ...lost.map((s) => s.text)].join('\n\n')
}

/**
 * What a refresh remembers, on the project. The button is not there to be
 * pressed every time: the same screen against the same document has nothing new
 * to say, so the model is not asked twice for one answer.
 */
export interface DesignSync {
  screenId: string
  codeHash: string
  designHash: string
}

export function designSyncOf(screen: { id: string; code: string }, markdown: string): DesignSync {
  return { screenId: screen.id, codeHash: hashCode(screen.code), designHash: hashCode(markdown.trim()) }
}

/** The direction already says what this screen shows, as of the last refresh. */
export function isDesignFresh(sync: DesignSync | undefined, screen: { id: string; code: string }, markdown: string | undefined): boolean {
  if (!sync || !markdown?.trim()) return false
  return sync.screenId === screen.id && sync.codeHash === hashCode(screen.code) && sync.designHash === hashCode(markdown.trim())
}
