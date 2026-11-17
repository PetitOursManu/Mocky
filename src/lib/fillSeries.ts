/**
 * A SERIES from a table: one row of a CSV, one copy of a screen with fields to
 * fill (`fillFields.ts`). Product sheets, name cards, a month of menus — the
 * same design, the words and the picture of each row.
 *
 * Nothing here calls a model: each row is a fill, written at parser-vouched
 * offsets by `applyFill`, so a hundred copies cost nothing and every one of
 * them keeps the layout the person approved. That is the whole promise, and
 * why a series is built on fields rather than on a prompt per row.
 *
 * Three decisions, each about what a row MEANS:
 * - an EMPTY cell keeps the screen's value. A spreadsheet leaves a cell empty
 *   for "same as usual" far more often than for "remove these words", and
 *   `applyFill` refuses an empty field anyway;
 * - a picture cell names a picture ALREADY in the library — its hash, its
 *   address, or the file name it was imported under. Fetching an address from
 *   a cell would be a server-side download of whatever a spreadsheet says;
 * - a row that changes nothing makes no copy.
 */

import type { FillField } from './fillFields'

/** How many copies one series may make: past this, the canvas is the problem. */
export const SERIES_MAX = 50

export interface Table {
  headers: string[]
  rows: string[][]
}

const DELIMITERS = [';', ',', '\t'] as const

/** The delimiter of a table, read off its first line, outside quotes. */
function delimiterOf(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]))
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && counts.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  }
  let best = ';'
  let n = 0
  for (const [d, c] of counts) if (c > n) [best, n] = [d, c]
  return best
}

/**
 * A CSV (RFC 4180, quotes doubled inside quotes), or a block pasted from a
 * spreadsheet (tab-separated). Semicolon, comma or tab, whichever the first
 * line uses most — Excel in French writes `;`. Null when there is no header
 * line or no row under it.
 */
export function parseTable(input: string): Table | null {
  const text = input.replace(/^﻿/, '')
  const sep = delimiterOf(text)
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      records.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    records.push(row)
  }
  const lines = records.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean))
  if (lines.length < 2) return null
  const width = Math.max(...lines.map((r) => r.length))
  const headers = Array.from({ length: width }, (_, i) => lines[0][i] || `#${i + 1}`)
  const rows = lines.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
  return { headers, rows }
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Field id → column index, or -1 for "keep the screen's value". */
export type SeriesMapping = Record<string, number>

/**
 * Which column fills which field, guessed from the names: the same words
 * first, then a header that contains the field's name or the reverse. Each
 * column serves one field. The person can change any of it.
 */
export function guessMapping(fields: Pick<FillField, 'id' | 'label'>[], headers: string[]): SeriesMapping {
  const cols = headers.map(fold)
  const used = new Set<number>()
  const out: SeriesMapping = Object.fromEntries(fields.map((f) => [f.id, -1]))
  const pass = (match: (label: string, col: string) => boolean) => {
    for (const f of fields) {
      if (out[f.id] !== -1) continue
      const label = fold(f.label)
      if (!label) continue
      const i = cols.findIndex((c, j) => !used.has(j) && !!c && match(label, c))
      if (i >= 0) {
        out[f.id] = i
        used.add(i)
      }
    }
  }
  pass((l, c) => l === c)
  pass((l, c) => c.includes(l) || l.includes(c))
  return out
}

/** A library picture, as far as a series needs to know it. */
export interface SeriesPicture {
  hash: string
  /** What the library shows as its caption: an upload's file name. */
  prompt: string
  createdAt: number
}

const HASH_RE = /^[a-f0-9]{64}$/i
const URL_HASH_RE = /\/api\/images\/([a-f0-9]{64})(?:[?#]|$)/i

/**
 * The library picture a cell names: a hash, an address of Mocky's own
 * (`…/api/images/<hash>`), or an imported file's name, with or without its
 * extension and whatever its case. Two pictures imported under one name: the
 * most recent. Null when nothing in the library answers.
 */
export function resolvePicture(cell: string, library: SeriesPicture[]): string | null {
  const v = cell.trim()
  if (!v) return null
  if (HASH_RE.test(v)) return v.toLowerCase()
  const fromUrl = URL_HASH_RE.exec(v)
  if (fromUrl) return fromUrl[1].toLowerCase()
  const name = v.replace(/^.*[\\/]/, '')
  const bare = (s: string) => fold(s.replace(/\.[a-z0-9]{2,5}$/i, ''))
  const want = bare(name)
  if (!want) return null
  const hit = library
    .filter((p) => bare(p.prompt.replace(/^.*[\\/]/, '')) === want)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  return hit?.hash ?? null
}

export interface SeriesRow {
  /** 1-based, as a spreadsheet numbers it under its header line (so the first row is 2). */
  line: number
  values: Record<string, string>
  /** What names the copy: the chosen column's cell, else the first value written. */
  label: string
  /** Picture cells nothing in the library answers to. */
  unknownPictures: string[]
}

/**
 * The fill of every row: field id → the cell, a picture cell resolved to its
 * hash. Empty cells and unknown pictures write nothing (the screen's value
 * stays), and the second is reported by its cell.
 */
export function seriesRows(
  table: Table,
  fields: FillField[],
  mapping: SeriesMapping,
  library: SeriesPicture[],
  nameColumn = -1,
): SeriesRow[] {
  return table.rows.map((row, r) => {
    const values: Record<string, string> = {}
    const unknownPictures: string[] = []
    for (const f of fields) {
      const col = mapping[f.id] ?? -1
      if (col < 0) continue
      const cell = (row[col] ?? '').trim()
      if (!cell) continue
      if (f.kind === 'image') {
        const hash = resolvePicture(cell, library)
        if (hash) values[f.id] = hash
        else unknownPictures.push(cell)
      } else values[f.id] = cell
    }
    const firstText = fields.find((f) => f.kind === 'text' && values[f.id])
    const label = (nameColumn >= 0 ? row[nameColumn]?.trim() : '') || (firstText ? values[firstText.id] : '') || `${r + 2}`
    return { line: r + 2, values, label, unknownPictures }
  })
}

const csvCell = (v: string) => (/[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * The table to start from: one column per field, named after it, and one row
 * with what the screen says today — a picture by the hash the library knows it
 * by. Semicolons and a BOM, which is what Excel in French opens without asking.
 */
export function seriesTemplate(fields: Pick<FillField, 'label'>[], current: string[]): string {
  const lines = [fields.map((f) => csvCell(f.label)), current.map((v) => csvCell(v))]
  return `﻿${lines.map((l) => l.join(';')).join('\r\n')}\r\n`
}
