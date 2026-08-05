/*
 * Interactive parts of the documentation.
 *
 * Everything here is hand-written vanilla ES and plain CSS classes, for the
 * same reason nothing under docs-site/vendor/ comes from a CDN: a documentation
 * page should not depend on a third party being up, and this site has no build
 * step to bundle one anyway. That rules out React, Alpine, htmx and every npm
 * widget library, and it is not a hardship — the three things below are a
 * button, a grid and a filter.
 *
 * ── How a widget gets on a page ─────────────────────────────────────────────
 *
 * A Markdown file writes a placeholder:
 *
 *     <div data-mocky-widget="presets"></div>
 *
 * and `hydrate()` fills it after Docsify renders. `<script>` blocks in Markdown
 * are NOT an option: Docsify executes only the first direct child of
 * `.markdown-section` and ignores `src`, so a page with two of them silently
 * runs one.
 *
 * ── The data is generated, never hand-copied ────────────────────────────────
 *
 * `data/*.json` is written by `scripts/build-docs-data.mjs` from the real
 * sources — `src/lib/styles.ts`, the `impeccable` registry, and the quality
 * policy — and `npm run check:docs-data` fails the build when the two diverge.
 * Reading a JSON here is therefore reading Mocky's own data one remove away,
 * not a transcription somebody has to remember to update.
 *
 * ── Search ─────────────────────────────────────────────────────────────────
 *
 * docsify-search indexes MARKDOWN, not the rendered DOM, so nothing rendered
 * here is findable through the site's own search. Every page carrying a widget
 * keeps a plain Markdown table beside it. That table is not redundancy; it is
 * the searchable copy, and it is also what a reader with JavaScript off sees.
 */
;(function () {
  var FR = function () {
    return /^#?\/fr(\/|$)/.test(location.hash)
  }

  var L = {
    en: {
      copy: 'Copy',
      copied: 'Copied',
      swatches: 'Palette',
      sections: 'Sections',
      filterAll: 'All',
      deterministic: 'Detected',
      judged: 'Judged',
      hasDirection: 'This project has an art direction',
      hasDirectionHint:
        'Nine rules judge taste in colour or type. With a direction in force the model was told to obey it, so they become advice.',
      enforce: 'corrected',
      advise: 'reported',
      ignore: 'not asked',
      loading: 'Loading…',
      failed: 'Could not load the data for this section.',
      rules: 'rules',
    },
    fr: {
      copy: 'Copier',
      copied: 'Copié',
      swatches: 'Palette',
      sections: 'Sections',
      filterAll: 'Toutes',
      deterministic: 'Détectées',
      judged: 'Jugées',
      hasDirection: 'Ce projet a une direction artistique',
      hasDirectionHint:
        'Neuf règles jugent le goût en couleur ou en typographie. Avec une direction en vigueur, le modèle a reçu l’ordre de la suivre : elles passent en simple avis.',
      enforce: 'corrigée',
      advise: 'signalée',
      ignore: 'pas posée',
      loading: 'Chargement…',
      failed: 'Impossible de charger les données de cette section.',
      rules: 'règles',
    },
  }
  var t = function (k) {
    return L[FR() ? 'fr' : 'en'][k]
  }

  var cache = {}
  function load(name) {
    if (cache[name]) return cache[name]
    cache[name] = fetch('data/' + name + '.json?v=4').then(function (r) {
      if (!r.ok) throw new Error(r.status)
      return r.json()
    })
    return cache[name]
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  /* ───────────────────────── 1. Copy buttons ─────────────────────────
   *
   * deployment.md is mostly shell blocks, and a documentation page whose
   * commands have to be selected by hand is a page that gets commands typed
   * wrong. Nothing to configure and nothing to drift.
   */
  function copyButtons() {
    var blocks = document.querySelectorAll('.markdown-section pre[data-lang]')
    Array.prototype.forEach.call(blocks, function (pre) {
      if (pre.querySelector('.mk-copy')) return
      var b = el('button', 'mk-copy', t('copy'))
      b.type = 'button'
      b.addEventListener('click', function () {
        var code = pre.querySelector('code')
        var text = code ? code.textContent : pre.textContent
        // The clipboard API needs a secure context; the fallback keeps the
        // button honest on plain http rather than failing silently.
        var done = function () {
          b.textContent = t('copied')
          b.classList.add('is-done')
          setTimeout(function () {
            b.textContent = t('copy')
            b.classList.remove('is-done')
          }, 1400)
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done)
          return
        }
        var ta = el('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          done()
        } catch (e) {
          /* nothing to do; the text is on screen and selectable */
        }
        document.body.removeChild(ta)
      })
      pre.appendChild(b)
    })
  }

  /* ─────────────────── 2. The DESIGN.md preset gallery ───────────────────
   *
   * The same presets the application offers on its Design page, shown here so
   * that "a DESIGN.md" stops being an abstraction. Each card renders from the
   * preset's own preview tokens — the background, the surface, the border, the
   * accent and the radius — so the card IS a small instance of the system it
   * names, rather than a picture of one.
   */
  function presets(node) {
    node.appendChild(el('p', 'mk-loading', t('loading')))
    load('style-presets').then(
      function (list) {
        node.innerHTML = ''
        var grid = el('div', 'mk-grid')
        list.forEach(function (p) {
          var card = el('article', 'mk-card')

          // The specimen. `preview.bg` is sometimes a gradient, so it is set as
          // `background` and never assumed to be a hex.
          var demo = el('div', 'mk-demo')
          demo.style.background = p.preview.bg
          var panel = el('div', 'mk-panel')
          panel.style.background = p.preview.cardBg
          panel.style.borderColor = p.preview.cardBorder
          panel.style.borderRadius = p.preview.radius
          var head = el('div', 'mk-line')
          head.style.background = p.preview.text
          var sub = el('div', 'mk-line mk-line--short')
          sub.style.background = p.preview.mutedText
          var btn = el('span', 'mk-btn', 'Action')
          btn.style.background = p.preview.accent
          btn.style.color = p.preview.accentText
          btn.style.borderRadius = p.preview.radius
          panel.appendChild(head)
          panel.appendChild(sub)
          panel.appendChild(btn)
          demo.appendChild(panel)
          card.appendChild(demo)

          var body = el('div', 'mk-body')
          body.appendChild(el('h4', 'mk-name', p.name))
          body.appendChild(el('p', 'mk-desc', p.description))

          var sw = el('div', 'mk-swatches')
          sw.setAttribute('aria-label', t('swatches'))
          p.swatches.forEach(function (hex) {
            var s = el('span', 'mk-swatch')
            s.style.background = hex
            s.title = hex
            sw.appendChild(s)
          })
          body.appendChild(sw)

          var secs = el('p', 'mk-sections')
          secs.textContent = p.sections.join(' · ')
          body.appendChild(secs)

          card.appendChild(body)
          grid.appendChild(card)
        })
        node.appendChild(grid)
      },
      function () {
        node.innerHTML = ''
        node.appendChild(el('p', 'mk-failed', t('failed')))
      },
    )
  }

  /* ──────────────────── 3. The quality-rule browser ────────────────────
   *
   * Invariant Q2 is the hardest thing in the project to explain in prose: some
   * rules are enforced, some only reported, some never asked — and which is
   * which depends on whether the project has an art direction, because the
   * generation prompt tells the model that a supplied direction overrides every
   * stylistic rule.
   *
   * The toggle re-runs that decision on screen. Nine rules move from corrected
   * to reported when you tick it, which is the whole argument made visible in
   * one click.
   */
  function rules(node) {
    node.appendChild(el('p', 'mk-loading', t('loading')))
    load('quality-rules').then(
      function (list) {
        node.innerHTML = ''
        var state = { kind: 'all', direction: false }

        var bar = el('div', 'mk-bar')
        var chips = el('div', 'mk-chips')
        var counts = el('span', 'mk-count')

        function resolved(r) {
          // The five lines of dispositionFor that matter, ported deliberately:
          // 'direction' is enforce with no art direction, advise with one.
          if (r.disposition === 'direction') return state.direction ? 'advise' : 'enforce'
          return r.disposition
        }

        function draw() {
          var shown = list.filter(function (r) {
            return state.kind === 'all' || r.kind === state.kind
          })
          counts.textContent = shown.length + ' ' + t('rules')
          table.innerHTML = ''
          shown.forEach(function (r) {
            var row = el('tr')
            var d = resolved(r)
            var id = el('td')
            id.appendChild(el('code', null, r.id))
            row.appendChild(id)
            row.appendChild(el('td', null, r.name))
            var badge = el('td')
            var b = el('span', 'mk-pill mk-pill--' + d, t(d))
            if (r.reason) b.title = r.reason
            badge.appendChild(b)
            row.appendChild(badge)
            table.appendChild(row)
          })
        }

        ;[
          ['all', t('filterAll')],
          ['deterministic', t('deterministic')],
          ['judged', t('judged')],
        ].forEach(function (pair) {
          var c = el('button', 'mk-chip', pair[1])
          c.type = 'button'
          if (pair[0] === 'all') c.classList.add('is-on')
          c.addEventListener('click', function () {
            state.kind = pair[0]
            Array.prototype.forEach.call(chips.children, function (o) {
              o.classList.remove('is-on')
            })
            c.classList.add('is-on')
            draw()
          })
          chips.appendChild(c)
        })

        var toggle = el('label', 'mk-toggle')
        var box = el('input')
        box.type = 'checkbox'
        box.addEventListener('change', function () {
          state.direction = box.checked
          draw()
        })
        toggle.appendChild(box)
        toggle.appendChild(el('span', null, t('hasDirection')))
        toggle.title = t('hasDirectionHint')

        bar.appendChild(chips)
        bar.appendChild(counts)
        node.appendChild(bar)
        node.appendChild(toggle)
        node.appendChild(el('p', 'mk-hint', t('hasDirectionHint')))

        var wrap = el('div', 'mk-tablewrap')
        var tbl = el('table', 'mk-table')
        var table = el('tbody')
        tbl.appendChild(table)
        wrap.appendChild(tbl)
        node.appendChild(wrap)
        draw()
      },
      function () {
        node.innerHTML = ''
        node.appendChild(el('p', 'mk-failed', t('failed')))
      },
    )
  }

  var WIDGETS = { presets: presets, rules: rules }

  function hydrate() {
    copyButtons()
    var nodes = document.querySelectorAll('.markdown-section [data-mocky-widget]')
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.dataset.mockyReady) return
      var fn = WIDGETS[n.getAttribute('data-mocky-widget')]
      if (!fn) return
      n.dataset.mockyReady = '1'
      fn(n)
    })
  }

  window.$docsify = window.$docsify || {}
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(function (hook) {
    hook.doneEach(hydrate)
  })
})()
