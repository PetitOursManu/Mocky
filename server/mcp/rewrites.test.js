import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildMcpServer, fieldsOf, screenSummary, TRANSLATE_LANGS, FILL_ROWS_MAX } from './tools.js'
import { cleanCheck, cleanFill, cleanPack, cleanTranslate } from './runner.js'
import { TRANSLATE_LANGS as BROWSER_LANGS } from '../../src/lib/translate.ts'
import { SERIES_MAX } from '../../src/lib/fillSeries.ts'

/**
 * The four tools that rewrite without laying out again — translate_screen,
 * fill_fields, write_publication_pack — and the check that writes nothing,
 * check_document. Through the SDK's own client, against a runner that answers
 * like the real one: what is checked is what an assistant reads.
 */

const HASH = 'a'.repeat(64)
const FOREIGN = 'b'.repeat(64)

const project = {
  id: 'p1',
  name: 'Fête',
  campaign: { brief: 'La fête du quartier, samedi 14 juin', facts: [], formats: ['instagram'] },
  screens: [
    {
      id: 's1',
      name: 'Menu',
      prompt: 'Le menu de la semaine',
      code: 'export default function App(){return <p>Lundi : soupe</p>}',
      page: 'a4',
      fill: [
        { id: 'f1', label: 'Plat du lundi', kind: 'text', value: 'soupe', nth: 0 },
        { id: 'f2', label: 'Photo', kind: 'image', value: HASH, nth: 0 },
      ],
      userNotes: [{ text: 'PRIVATE' }],
    },
    { id: 's2', name: 'Accueil', prompt: 'Une page d’accueil', code: 'export default function App(){return null}', campaign: { format: 'instagram', facts: {} } },
  ],
}

function fakeDeps({ result, check } = {}) {
  const runner = {
    enqueue: vi.fn((_u, request) => ({ job: { id: 'j1', request }, existing: false })),
    wait: vi.fn(async () => ({ id: 'j1', status: 'done', lang: 'fr', kind: result?.kind, result })),
    availability: () => ({ available: true }),
    countToday: () => 0,
    isBusy: () => false,
    readShot: () => null,
    checkCode: vi.fn(async () => check),
  }
  return {
    runner,
    deps: {
      user: { id: 'u1', username: 'helper' },
      readProjects: () => JSON.stringify([project]),
      linkFor: (p, s) => `https://m.example/p/${p}${s ? `?screen=${s}` : ''}`,
      runner,
      maintenance: () => false,
      dailyQuota: () => null,
      engines: () => ({ mocky: true, client: false }),
      hasTextProvider: () => true,
      usesOwnText: () => false,
      shotLink: (h) => `https://m.example/mcp-shot/${h}.jpg`,
      origin: 'https://m.example',
      pictures: { owns: (_u, h) => h === HASH },
      level: 'write',
    },
  }
}

async function call(deps, name, args) {
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([buildMcpServer(deps).connect(a), client.connect(b)])
  try {
    return await client.callTool({ name, arguments: args })
  } finally {
    await client.close()
  }
}

const textOf = (out) => out.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')

describe('the mirrors these tools are built on', () => {
  it('offer the languages "Traduire…" offers, and the rows a series takes', () => {
    expect(TRANSLATE_LANGS).toEqual([...BROWSER_LANGS])
    expect(FILL_ROWS_MAX).toBe(SERIES_MAX)
  })
})

describe('what an assistant sees of a screen to fill', () => {
  it('its fields — name, kind, the value there now — and nothing private', () => {
    const s = screenSummary(project.screens[0], 'p1', (p, id) => `${p}/${id}`)
    expect(s.fields).toEqual([
      { id: 'f1', label: 'Plat du lundi', kind: 'text', value: 'soupe' },
      { id: 'f2', label: 'Photo', kind: 'image', value: HASH },
    ])
    expect(s.page).toBe('a4')
    expect(JSON.stringify(s)).not.toMatch(/PRIVATE|export default/)
    expect(fieldsOf({ fill: [{ id: 'x', label: 'y', kind: 'video', value: 'z' }] })).toEqual([])
  })
})

describe('translate_screen', () => {
  it('asks the runner for a copy in that language, and says the original is unchanged', async () => {
    const { deps, runner } = fakeDeps({ result: { kind: 'translate', changed: true, projectId: 'p1', screenId: 'c1', translate: { lang: 'en', total: 12, written: 11, kept: 1 }, notices: [] } })
    const out = await call(deps, 'translate_screen', { project_id: 'p1', screen_id: 's1', language: 'en' })
    expect(runner.enqueue.mock.calls[0][1]).toMatchObject({ kind: 'translate', projectId: 'p1', screenId: 's1', toLang: 'en' })
    const said = textOf(out)
    expect(said).toMatch(/Copie traduite \(EN\).*n’a pas changé : 11 texte\(s\) sur 12/)
    expect(said).toMatch(/1 texte\(s\) gardé/)
    // A copy is undone by deleting it, not by "Revert".
    expect(said).not.toMatch(/Revenir à la version précédente/)
  })

  it('refuses a language Mocky does not translate into', async () => {
    const { deps, runner } = fakeDeps()
    const out = await call(deps, 'translate_screen', { project_id: 'p1', screen_id: 's1', language: 'ja' })
    expect(out.isError).toBe(true)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })
})

describe('fill_fields', () => {
  it('passes the rows by field name, and reports a series as one copy per row', async () => {
    const { deps, runner } = fakeDeps({
      result: {
        kind: 'fill',
        changed: true,
        projectId: 'p1',
        screenId: 'c1',
        fill: { into: 'copy', written: ['Plat du lundi'], refused: [], unknown: ['Dessert'] },
        collection: 'series',
        screens: [
          { screenId: 'c1', name: 'Menu · S12', role: 'copy' },
          { screenId: 'c2', name: 'Menu · S13', role: 'copy' },
        ],
        notices: [],
      },
    })
    const out = await call(deps, 'fill_fields', {
      project_id: 'p1',
      screen_id: 's1',
      rows: [
        { label: 'S12', values: { 'Plat du lundi': 'Gratin', Dessert: 'Flan' } },
        { label: 'S13', values: { 'plat du lundi': 'Lentilles', Photo: HASH } },
      ],
      into: 'here',
    })
    const req = runner.enqueue.mock.calls[0][1]
    // Several rows never write into the screen itself.
    expect(req).toMatchObject({ kind: 'fill', fill: { into: 'copy' } })
    expect(req.fill.rows).toHaveLength(2)
    const said = textOf(out)
    expect(said).toMatch(/Série : 2 copies remplies/)
    expect(said).toContain('https://m.example/p/p1?screen=c2')
    expect(said).toMatch(/Champs inconnus de cet écran \(ignorés\) : Dessert/)
  })

  it('refuses a picture that is not the account’s, and a screen with no fields, before any work', async () => {
    const { deps, runner } = fakeDeps()
    const foreign = await call(deps, 'fill_fields', { project_id: 'p1', screen_id: 's1', rows: [{ values: { Photo: FOREIGN } }] })
    expect(foreign.isError).toBe(true)
    expect(textOf(foreign)).toMatch(/add_image/)
    const none = await call(deps, 'fill_fields', { project_id: 'p1', screen_id: 's2', rows: [{ values: { Titre: 'x' } }] })
    expect(none.isError).toBe(true)
    expect(textOf(none)).toMatch(/Remplir…/)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })

  it('needs no text model: it is not refused for want of one', async () => {
    const { deps, runner } = fakeDeps({ result: { kind: 'fill', changed: true, projectId: 'p1', screenId: 's1', fill: { into: 'here', written: ['Plat du lundi'], refused: [], unknown: [] }, notices: [] } })
    deps.hasTextProvider = () => false
    const out = await call(deps, 'fill_fields', { project_id: 'p1', screen_id: 's1', rows: [{ values: { 'Plat du lundi': 'Gratin' } }], into: 'here' })
    expect(runner.enqueue.mock.calls[0][1].fill.into).toBe('here')
    expect(textOf(out)).toMatch(/Écran rempli \(Plat du lundi\)/)
    // Written into the screen itself: that one is revertible.
    expect(textOf(out)).toMatch(/Revenir à la version précédente/)
  })
})

describe('write_publication_pack', () => {
  it('hands back the captions themselves, network by network', async () => {
    const { deps, runner } = fakeDeps({
      result: {
        kind: 'pack',
        changed: false,
        projectId: 'p1',
        screenId: 's2',
        pack: { captions: { instagram: { text: 'Samedi on fait la fête !', hashtags: ['#quartier', '#fete'] } }, alts: 1, pieces: 1 },
        notices: [],
      },
    })
    const out = await call(deps, 'write_publication_pack', { project_id: 'p1' })
    expect(runner.enqueue.mock.calls[0][1]).toMatchObject({ kind: 'pack', projectId: 'p1' })
    const said = textOf(out)
    expect(said).toMatch(/1 légende\(s\), 1 texte\(s\) alternatif\(s\) pour 1 création/)
    expect(said).toContain('## Instagram\nSamedi on fait la fête !\n\n#quartier #fete')
  })

  it('refuses a project that is not a campaign', async () => {
    const { deps, runner } = fakeDeps()
    deps.readProjects = () => JSON.stringify([{ ...project, campaign: undefined }])
    const out = await call(deps, 'write_publication_pack', { project_id: 'p1' })
    expect(out.isError).toBe(true)
    expect(runner.enqueue).not.toHaveBeenCalled()
  })
})

describe('check_document', () => {
  it('answers the worded report of a document, and refuses a web screen', async () => {
    const check = {
      pages: 1,
      checks: [
        { id: 'pictures', label: 'Images', status: 'warn', notes: ['Image trop peu définie : photo (120 dpi)'] },
        { id: 'bleed', label: 'Fond perdu', status: 'na', notes: [] },
      ],
    }
    const { deps, runner } = fakeDeps({ check })
    const out = await call(deps, 'check_document', { project_id: 'p1', screen_id: 's1' })
    expect(runner.checkCode.mock.calls[0][0].screen).not.toHaveProperty('userNotes')
    const said = textOf(out)
    expect(said).toMatch(/1 point\(s\) à revoir sur 1 page/)
    expect(said).toMatch(/- Images : à revoir\n {4}Image trop peu définie/)
    const web = await call(deps, 'check_document', { project_id: 'p1', screen_id: 's2' })
    expect(web.isError).toBe(true)
    expect(textOf(web)).toMatch(/audit_design/)
  })
})

describe('what a page reports, re-read as data', () => {
  it('keeps the shapes and drops the rest', () => {
    expect(cleanTranslate({ lang: 'en', total: '3', written: 2.7, kept: -1, code: 'x' })).toEqual({ lang: 'en', total: 3, written: 2, kept: 0 })
    expect(cleanFill({ into: 'nope', written: ['a'], refused: 'x' })).toEqual({ into: 'copy', written: ['a'], refused: [], unknown: [] })
    expect(cleanPack({ captions: { instagram: { text: 'hi', hashtags: ['#a'] }, tiktok: { text: 'no' } }, alts: 2 })).toEqual({
      captions: { instagram: { text: 'hi', hashtags: ['#a'] } },
      alts: 2,
      pieces: 0,
    })
    expect(cleanCheck({ pages: 2, checks: [{ id: 'qr', label: 'QR', status: 'boom', notes: ['n'] }] })).toEqual({
      pages: 2,
      checks: [{ id: 'qr', label: 'QR', status: 'info', notes: ['n'] }],
    })
  })
})
