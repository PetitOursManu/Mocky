/**
 * How long a text model THINKS before it answers: `auto` (the model's own
 * default, and Mocky's guard against thinking without end — server/text/
 * dialect.js, THINKING_EFFORT) or a level chosen in Settings or Admin.
 *
 * Who chooses is server/own-text.js's rule, read the same way here: on the
 * instance's model, the administrator's level for that profile; on a person's
 * own key, the person's (`Settings.reasoning`, sent as `x-mocky-reasoning`).
 *
 * Mirrored by REASONING_LEVELS in server/text/dialect.js — the server reads the
 * header strictly, so a level only one side knows is `auto`, never an error.
 */
export const REASONING_LEVELS = ['auto', 'off', 'low', 'medium', 'high'] as const
export type ReasoningLevel = (typeof REASONING_LEVELS)[number]

export function readReasoning(v: unknown): ReasoningLevel {
  return (REASONING_LEVELS as readonly string[]).includes(String(v)) ? (v as ReasoningLevel) : 'auto'
}
