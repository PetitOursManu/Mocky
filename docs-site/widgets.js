/*
 * Mocky's own blocks in the documentation, registered with Lumy.
 *
 * A page writes `:::widget presets` or `:::widget rules`; Lumy renders the
 * block's text as the fallback (what search indexes and what a reader without
 * JavaScript sees) and calls the function below to replace it.
 *
 * ── The data is generated, never hand-copied ────────────────────────────────
 *
 * `data/*.json` is written by `scripts/build-docs-data.mjs` from the real
 * sources — `src/lib/styles.ts`, the `impeccable` registry, and the quality
 * policy — and `npm run check:docs-data` fails the build when the two diverge.
 * Lumy copies the folder into the site as it is (`public` in lumy.config.json).
 */
;(() => {
  const L = {
    en: {
      swatches: 'Palette',
      filterAll: 'All',
      deterministic: 'Detected',
      judged: 'Judged',
      hasDirection: 'This project has an art direction',
      hasDirectionHint:
        'Nine rules judge taste in colour or type. With a direction in force the model was told to obey it, so they become advice.',
      enforce: 'corrected',
      advise: 'reported',
      ignore: 'not asked',
      failed: 'Could not load the data for this section.',
      rules: 'rules',
      rule: 'Rule',
      what: 'What it catches',
      outcome: 'Outcome',
    },
    fr: {
      swatches: 'Palette',
      filterAll: 'Toutes',
      deterministic: 'Détectées',
      judged: 'Jugées',
      hasDirection: 'Ce projet a une direction artistique',
      hasDirectionHint:
        'Neuf règles jugent le goût en couleur ou en typographie. Avec une direction en vigueur, le modèle a reçu l’ordre de la suivre : elles passent en simple avis.',
      enforce: 'corrigée',
      advise: 'signalée',
      ignore: 'pas posée',
      failed: 'Impossible de charger les données de cette section.',
      rules: 'règles',
      rule: 'Règle',
      what: 'Ce qu’elle repère',
      outcome: 'Issue',
    },
  }

  const cache = {}
  const load = (base, name) =>
    (cache[name] ||= fetch(`${base}data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(r.status)
      return r.json()
    }))

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  /* ── The DESIGN.md preset gallery ──────────────────────────────────────
   * Each card renders from the preset's own preview tokens — background,
   * surface, border, accent, radius — so the card IS a small instance of the
   * system it names, rather than a picture of one.
   */
  function presets(node, { lang, base }) {
    const t = L[lang] || L.en
    load(base, 'style-presets').then(
      (list) => {
        const grid = el('div', 'mk-grid')
        list.forEach((p, i) => {
          const card = el('article', 'mk-card')
          card.style.setProperty('--i', i)
          // `preview.bg` is sometimes a gradient, so it is set as `background`.
          const demo = el('div', 'mk-demo')
          demo.style.background = p.preview.bg
          const panel = el('div', 'mk-panel')
          panel.style.background = p.preview.cardBg
          panel.style.borderColor = p.preview.cardBorder
          panel.style.borderRadius = p.preview.radius
          const head = el('div', 'mk-line')
          head.style.background = p.preview.text
          const sub = el('div', 'mk-line mk-line--short')
          sub.style.background = p.preview.mutedText
          const btn = el('span', 'mk-btn', 'Action')
          btn.style.background = p.preview.accent
          btn.style.color = p.preview.accentText
          btn.style.borderRadius = p.preview.radius
          panel.append(head, sub, btn)
          demo.append(panel)

          const body = el('div', 'mk-body')
          body.append(el('h4', 'mk-name', p.name), el('p', 'mk-desc', p.description))
          const sw = el('div', 'mk-swatches')
          sw.setAttribute('aria-label', t.swatches)
          for (const hex of p.swatches) {
            const s = el('span', 'mk-swatch')
            s.style.background = hex
            s.title = hex
            sw.append(s)
          }
          body.append(sw, el('p', 'mk-sections', p.sections.join(' · ')))
          card.append(demo, body)
          grid.append(card)
        })
        node.replaceChildren(grid)
      },
      () => node.prepend(el('p', 'mk-failed', t.failed)),
    )
  }

  /* ── The quality-rule browser ──────────────────────────────────────────
   * Invariant Q2 is the hardest thing in the project to explain in prose: some
   * rules are enforced, some only reported, some never asked — and which is
   * which depends on whether the project has an art direction. The switch
   * re-runs that decision on screen: nine rules move from corrected to
   * reported when it is on.
   */
  function rules(node, { lang, base }) {
    const t = L[lang] || L.en
    load(base, 'quality-rules').then(
      (list) => {
        const state = { kind: 'all', direction: false }
        // The five lines of dispositionFor that matter, ported deliberately.
        const resolved = (r) => (r.disposition === 'direction' ? (state.direction ? 'advise' : 'enforce') : r.disposition)

        const bar = el('div', 'mk-bar')
        const chips = el('div', 'mk-chips')
        chips.setAttribute('role', 'group')
        const count = el('span', 'mk-count')
        for (const [kind, label] of [['all', t.filterAll], ['deterministic', t.deterministic], ['judged', t.judged]]) {
          const c = el('button', 'mk-chip', label)
          c.type = 'button'
          c.setAttribute('aria-pressed', String(kind === 'all'))
          c.addEventListener('click', () => {
            state.kind = kind
            for (const o of chips.children) o.setAttribute('aria-pressed', String(o === c))
            draw()
          })
          chips.append(c)
        }
        bar.append(chips, count)

        const toggle = el('label', 'mk-toggle')
        const box = el('input')
        box.type = 'checkbox'
        box.addEventListener('change', () => {
          state.direction = box.checked
          draw()
        })
        toggle.append(box, el('span', 'mk-toggle-track'), el('span', null, t.hasDirection))

        const wrap = el('div', 'lm-table')
        const table = el('table', 'mk-table')
        const thead = el('thead')
        const tr = el('tr')
        for (const h of [t.rule, t.what, t.outcome]) tr.append(el('th', null, h))
        thead.append(tr)
        const tbody = el('tbody')
        table.append(thead, tbody)
        wrap.append(table)

        function draw() {
          const shown = list.filter((r) => state.kind === 'all' || r.kind === state.kind)
          count.textContent = `${shown.length} ${t.rules}`
          tbody.replaceChildren(
            ...shown.map((r) => {
              const row = el('tr')
              const id = el('td')
              id.append(el('code', null, r.id))
              const name = el('td', null, r.name)
              // Printed, not only offered on hover: a title never shows on a phone.
              if (r.reason) name.append(el('small', 'mk-why', r.reason))
              const outcome = el('td')
              const d = resolved(r)
              outcome.append(el('span', `mk-pill mk-pill--${d}`, t[d]))
              row.append(id, name, outcome)
              return row
            }),
          )
        }

        node.replaceChildren(bar, toggle, el('p', 'mk-hint', t.hasDirectionHint), wrap)
        draw()
      },
      () => node.prepend(el('p', 'mk-failed', t.failed)),
    )
  }

  Lumy.widget('presets', presets)
  Lumy.widget('rules', rules)
})()
