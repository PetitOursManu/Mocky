import { useCallback, useEffect, useRef, useState } from 'react'
import { EnhanceEmptyError, enhancePrompt, type EnhanceContext } from './enhancePrompt'
import { loadSettings } from './settings'
import { useT } from '../i18n'

export interface PromptEnhancer {
  /** A rewrite is streaming into the field. */
  running: boolean
  /** The field still holds exactly what the rewrite produced, so Undo means something. */
  canUndo: boolean
  /** Why the last attempt left the field as it was, if it did. */
  notice: string | null
  start: (ctx: EnhanceContext) => void
  stop: () => void
  undo: () => void
  dismissNotice: () => void
}

/**
 * State for the "improve my prompt" button, shared by both composers.
 *
 * One hook in ProjectView rather than one per button, because the two
 * composers (Welcome on an empty project, the floating bar after) edit the SAME
 * `prompt` state — an Undo offered in one must survive the switch to the other
 * that the first generation causes.
 *
 * Three promises, and each is the reason for a piece of state:
 * - the person's text is never lost: a failure or a Stop puts it back exactly,
 *   and a success keeps it for Undo (`original`);
 * - Undo exists only while the field still holds the rewrite untouched — once
 *   the person edits it, the edit is theirs and "undo" would silently discard
 *   it, so the comparison with `result` is what makes the button disappear;
 * - nothing here blocks generating: an error is a soft notice (the house rule,
 *   Q1), never the generation's error banner.
 */
export function usePromptEnhancer(prompt: string, setPrompt: (v: string) => void): PromptEnhancer {
  const t = useT()
  const [running, setRunning] = useState(false)
  const [snapshot, setSnapshot] = useState<{ original: string; result: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const acRef = useRef<AbortController | null>(null)

  // A composer that unmounts mid-rewrite (the project closed) stops paying for it.
  useEffect(() => () => acRef.current?.abort(), [])

  const start = useCallback(
    (ctx: EnhanceContext) => {
      const original = prompt
      if (!original.trim() || acRef.current) return
      const settings = loadSettings()
      if (!settings.model.trim()) {
        setNotice(t('project.noModel'))
        return
      }
      const ac = new AbortController()
      acRef.current = ac
      setRunning(true)
      setNotice(null)
      setSnapshot(null)
      enhancePrompt(settings, original, ctx, {
        signal: ac.signal,
        onPartial: (partial) => {
          if (!ac.signal.aborted) setPrompt(partial)
        },
      })
        .then((result) => {
          if (ac.signal.aborted) return
          setPrompt(result)
          setSnapshot({ original, result })
        })
        .catch((err: unknown) => {
          // Back to exactly what was typed — a half-streamed brief ending
          // mid-sentence is nobody's request.
          setPrompt(original)
          if (err instanceof Error && err.name === 'AbortError') return
          const detail =
            err instanceof EnhanceEmptyError
              ? t('composer.enhanceEmpty')
              : err instanceof Error
                ? err.message
                : String(err)
          setNotice(t('composer.enhanceFailed', { detail }))
        })
        .finally(() => {
          if (acRef.current === ac) acRef.current = null
          setRunning(false)
        })
    },
    [prompt, setPrompt, t],
  )

  const stop = useCallback(() => acRef.current?.abort(), [])

  const undo = useCallback(() => {
    if (!snapshot) return
    setPrompt(snapshot.original)
    setSnapshot(null)
  }, [snapshot, setPrompt])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return {
    running,
    canUndo: !!snapshot && !running && prompt === snapshot.result,
    notice,
    start,
    stop,
    undo,
    dismissNotice,
  }
}
