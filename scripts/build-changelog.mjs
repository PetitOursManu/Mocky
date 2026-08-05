#!/usr/bin/env node
/**
 * Writes docs/CHANGELOG.md and docs/fr/CHANGELOG.md from the git history.
 *
 * The documentation site has no build step — publishing means pushing a `.md`
 * file — so a changelog has to exist as committed Markdown rather than as
 * something assembled at request time. This generates it.
 *
 * ── What it does NOT do, and why ─────────────────────────────────────────────
 *
 * It does not translate. Commit subjects are written in French in this
 * repository, and both files reproduce them VERBATIM; only the headings, the
 * column names and the framing sentences differ between the two. A changelog
 * exists to get from "what changed" to "which commit", and a translated subject
 * sits beside a hash pointing at a commit whose text says something else — the
 * reader can then search for neither. Every subject stays inside a table cell so
 * that the quotation reads as a quotation.
 *
 * It does not emit commit BODIES. They are unfenced prose, and a body line
 * beginning with "# " would become a phantom heading in the rendered page.
 *
 * It groups by MONTH, not by release: there are no tags in this repository, so
 * there is no version axis to group on. Docsify lifts every `##` into the
 * sidebar table of contents (`subMaxLevel: 2`), which is exactly why one
 * heading per release across 170-odd commits would be unreadable.
 *
 * Run: npm run changelog
 * Also run by .github/workflows/changelog.yml after a push to main.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Scope spellings seen in the history, normalised.
 *
 * Both languages are live — `démo` and `demo`, `vidéo` and `video` — because
 * the scope is whatever the author typed. This is the one table a human edits
 * when a new spelling appears; everything else in this file is mechanical.
 */
const SCOPE_ALIASES = {
  démo: 'demo',
  vidéo: 'video',
  capacités: 'capabilities',
  conception: 'design',
  déploiement: 'deploy',
  sécurité: 'security',
}

/** Commit type → the group it lands in, per language. */
const GROUPS = {
  feat: { en: 'Features', fr: 'Fonctionnalités' },
  fix: { en: 'Fixes', fr: 'Correctifs' },
  docs: { en: 'Documentation', fr: 'Documentation' },
  other: { en: 'Maintenance', fr: 'Maintenance' },
}
const GROUP_ORDER = ['feat', 'fix', 'docs', 'other']

/** The unit separator keeps subjects containing anything at all intact. */
const SEP = ''

function log() {
  const out = execFileSync(
    'git',
    [
      'log',
      '--no-merges',
      // The generator's own commits are not news about the product.
      '--invert-grep',
      '--grep=^docs(changelog)',
      `--format=%h${SEP}%ad${SEP}%s`,
      '--date=short',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return out.split('\n').filter(Boolean).map((line) => {
    const [hash, date, subject] = line.split(SEP)
    return { hash, date, ...parseSubject(subject) }
  })
}

/** `feat(canvas): cinq retouches` → {type, scope, text}. */
function parseSubject(subject) {
  const m = /^([a-zA-ZÀ-ÿ]+)(?:\(([^)]*)\))?!?:\s*(.+)$/.exec(subject)
  // The three oldest commits predate the convention. They keep their subject
  // and land in Maintenance rather than having a type retro-fitted onto them.
  if (!m) return { type: 'other', scope: null, text: subject }
  const type = m[1].toLowerCase()
  const scope = m[2] ? (SCOPE_ALIASES[m[2].toLowerCase()] ?? m[2].toLowerCase()) : null
  return { type: type in GROUPS ? type : 'other', scope, text: m[3] }
}

/** Group commits by `YYYY-MM`, newest month first, preserving log order within. */
function byMonth(commits) {
  const months = new Map()
  for (const c of commits) {
    const key = c.date.slice(0, 7)
    if (!months.has(key)) months.set(key, [])
    months.get(key).push(c)
  }
  return [...months.entries()]
}

const MONTH_NAMES_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthTitle(key, lang) {
  const [y, m] = key.split('-')
  const names = lang === 'fr' ? MONTH_NAMES_FR : MONTH_NAMES_EN
  return `${names[Number(m) - 1]} ${y}`
}

/** Pipes would end a table cell; nothing else in a subject needs escaping. */
const cell = (s) => s.replace(/\|/g, '\\|')

function render(commits, lang) {
  const fr = lang === 'fr'
  const L = fr
    ? {
        h1: 'Journal des modifications',
        switch: '[English](../CHANGELOG.md) · **Français**',
        why: 'Pourquoi c’est ainsi',
        intro:
          'Cette page est produite à partir de l’historique Git par `npm run changelog`. Les messages de commit de ce dépôt sont écrits en français : ils sont reproduits **tels quels**, sans traduction, parce qu’un intitulé traduit posé à côté d’une empreinte renvoie vers un commit dont le texte dit autre chose — et le lecteur ne peut alors chercher ni l’un ni l’autre.',
        colScope: 'Portée',
        colWhat: 'Modification',
        colCommit: 'Commit',
        empty: 'Aucune entrée.',
      }
    : {
        h1: 'Changelog',
        switch: '**English** · [Français](fr/CHANGELOG.md)',
        why: 'Why it works this way',
        intro:
          'This page is generated from the Git history by `npm run changelog`. Commit messages in this repository are written in French, and are reproduced **verbatim** rather than translated: a translated subject sitting beside a hash points at a commit whose text says something else, and the reader can then search for neither.',
        colScope: 'Scope',
        colWhat: 'Change',
        colCommit: 'Commit',
        empty: 'No entries.',
      }

  const out = [`# ${L.h1}`, '', L.switch, '', `> **${L.why} —** ${L.intro}`, '']

  const months = byMonth(commits)
  if (!months.length) {
    out.push(L.empty, '')
    return out.join('\n')
  }

  for (const [key, list] of months) {
    out.push(`## ${monthTitle(key, lang)}`, '')
    for (const type of GROUP_ORDER) {
      const rows = list.filter((c) => c.type === type)
      if (!rows.length) continue
      out.push(`**${GROUPS[type][lang]}**`, '')
      out.push(`| ${L.colScope} | ${L.colWhat} | ${L.colCommit} |`)
      out.push('| --- | --- | --- |')
      for (const c of rows) {
        out.push(`| ${c.scope ? `\`${cell(c.scope)}\`` : '—'} | ${cell(c.text)} | \`${c.hash}\` |`)
      }
      out.push('')
    }
  }
  return out.join('\n')
}

const commits = log()
// Both files or neither: Docsify's `fallbackLanguages: ['fr']` silently serves
// the English page when the French twin is missing, so a half-written pair
// looks correct and is not.
fs.writeFileSync(path.join(root, 'docs', 'CHANGELOG.md'), render(commits, 'en'), 'utf8')
fs.writeFileSync(path.join(root, 'docs', 'fr', 'CHANGELOG.md'), render(commits, 'fr'), 'utf8')

const months = byMonth(commits).length
console.log(`changelog: ${commits.length} commit(s) across ${months} month(s) → docs/CHANGELOG.md + docs/fr/CHANGELOG.md`)
