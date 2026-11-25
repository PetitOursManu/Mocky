import type { Capability } from './types'
import { ChartsSource, CHARTS_EXPORTS } from './snippets/Charts'
import { IconsSource, ICONS_EXPORTS } from './snippets/Icons'
import { MotionSource, MOTION_EXPORTS } from './snippets/Motion'
import { ScrollVideoSource, SCROLLVIDEO_EXPORTS } from './snippets/ScrollVideo'
import { MotionFilmSource, MOTIONFILM_EXPORTS } from './snippets/MotionFilm'
import { AnimateSource, ANIMATE_EXPORTS } from './snippets/Animate'
import { FX_ATTENTION, FX_ENTRANCES, FX_HOVER, FX_LOOPS, FX_SCROLL } from './snippets/AnimateFx'
import { Scene3DSource, SCENE3D_EXPORTS, SCENE3D_PRESETS } from './snippets/Scene3D'
import { UltraSource, ULTRA_EXPORTS, ULTRA_CLASSES, BACKDROP_PRESETS } from './snippets/Ultra'
import { DocumentSource, DOCUMENT_EXPORTS } from './snippets/Document'
import { FOLD_IDS } from '../folds'
import { ShapeFrameSource, SHAPEFRAME_EXPORTS } from './snippets/ShapeFrame'
import { FlowSource, FLOW_EXPORTS } from './snippets/Flow'
import { InteractSource, INTERACT_EXPORTS } from './snippets/Interact'
import { Interact3DSource, INTERACT3D_EXPORTS } from './snippets/Interact3D'
import { FRAME_FAMILIES, FRAME_SHAPES } from '../frameShapes'
import { OrnamentSource, ORNAMENT_EXPORTS } from './snippets/Ornament'
import { ORNAMENTS, ORNAMENT_OUTLINE_IDS } from '../ornaments'
import { FIELD_TYPES, PAGE_FORMAT_IDS } from '../pageFormats'
import { VisualSource, VISUAL_EXPORTS } from './snippets/Visual'
import { FAMILY_USE, VISUAL_BOUNDS, VISUAL_DETAIL_WORDS, VISUAL_FAMILIES, VISUAL_LABEL_WORDS, VISUALS_CAP } from '../visuals/families'

const quoted = (names: readonly string[]) => names.map((n) => `"${n}"`).join(', ')

// --- Validate at module load: every component name must be in its snippet's exports ---
function validatePack(id: string, components: { name: string }[], snippets: { exports: string[] }[]) {
  const allExports = new Set(snippets.flatMap((s) => s.exports))
  for (const comp of components) {
    if (!allExports.has(comp.name)) {
      throw new Error(`Registry mismatch: capability "${id}" has component "${comp.name}" but no snippet exports it`)
    }
  }
  for (const name of allExports) {
    if (!components.some((c) => c.name === name)) {
      throw new Error(`Registry mismatch: snippet for "${id}" exports "${name}" but no component metadata exists for it`)
    }
  }
}

export const CAPABILITIES: Capability[] = [
  {
    id: 'icons',
    kind: 'snippet-pack',
    baseline: true,
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: IconsSource, exports: [...ICONS_EXPORTS] }],
    components: [
      { name: 'Icon', signature: '<Icon.Home className="w-5 h-5" strokeWidth={1.5} />', description: 'Icon is a PRE-DEFINED global namespace. Interface icons: Home, Search, Bell, User, Settings, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check, Trash, Edit, Download, Upload, Calendar, Clock, Mail, Filter, Menu, MoreHorizontal, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, TrendingUp, TrendingDown, DollarSign, Eye, EyeOff, Lock, Heart, Star. Social/brand + contact (for footers & landing pages): Twitter, Github, Linkedin, Facebook, Instagram, Youtube, Globe, Phone, MapPin. Media, mood and everyday: Play, Pause, Volume2, Music, Headphones, Moon, Sun, Coffee, Book, BookOpen, Video, Camera, Image, Cloud, Zap, Info, Send, Share, Bookmark, Gift, Shield, Users, Smile, MessageCircle, ShoppingCart, Award, Feather. Usage: <Icon.Search />, <Icon.Twitter />, etc. Accepts className, size, strokeWidth props. ONLY these names are drawn — any other name (e.g. Icon.Dribbble, Icon.Slack) renders as a plain dot, so use the closest listed icon instead. NEVER declare your own `const Icon`/`var Icon` — it already exists and redeclaring it is a fatal error. For a DYNAMIC icon (e.g. from a list item), assign it to a Capitalized variable first — const Ico = Icon[item.icon] || Icon.MoreHorizontal; <Ico className="w-6 h-6" /> — never <Icon[item.icon] /> (that is invalid JSX).', tags: ['icon', 'svg'] },
    ],
  },
  {
    id: 'daisyui',
    kind: 'cdn-css',
    cdn: { url: '/vendor/daisyui.min.css' },
    triggers: {
      keywords: ['daisy', 'daisyui', 'semantic', 'btn', 'card component', 'modal component'],
      intents: ['semantic classes', 'component library'],
    },
  },
  {
    id: 'charts',
    kind: 'snippet-pack',
    triggers: {
      keywords: ['chart', 'recharts', 'graph', 'bar chart', 'line chart', 'pie chart', 'donut chart', 'area chart', 'data visualization', 'sparkline', 'progress ring'],
      intents: ['chart', 'dashboard', 'analytics', 'graph', 'data'],
    },
    snippets: [{ source: ChartsSource, exports: [...CHARTS_EXPORTS] }],
    components: [
      { name: 'BarChart', signature: '<BarChart data={[{label:"Jan", value:42}]} colors={["#4f46e5"]} height={200} />', description: 'A bar chart rendered with inline SVG. Accepts data array of {label, value} and optional colors.', tags: ['bar', 'chart', 'svg'] },
      { name: 'LineChart', signature: '<LineChart data={[{label:"Jan", value:30}]} colors={["#06b6d4"]} height={200} />', description: 'A line chart with points, rendered with inline SVG. Accepts data array of {label, value}.', tags: ['line', 'chart', 'svg'] },
      { name: 'DonutChart', signature: '<DonutChart data={[{label:"A", value:42, color:"#4f46e5"}]} size={160} thickness={18} />', description: 'A donut/pie chart with legend. Accepts data array of {label, value, color}.', tags: ['donut', 'pie', 'chart', 'svg'] },
      { name: 'Sparkline', signature: '<Sparkline data={[3, 5, 2, 8, 4, 9]} colors={["#10b981"]} height={40} width={120} />', description: 'A small inline sparkline. Accepts a plain array of numbers.', tags: ['sparkline', 'mini', 'chart'] },
      { name: 'ProgressRing', signature: '<ProgressRing value={75} colors={["#f59e0b"]} size={120} thickness={8} />', description: 'A circular progress ring showing a percentage (0-100).', tags: ['progress', 'ring', 'circle'] },
    ],
  },
  {
    /**
     * RETIRED — kept resolvable, never offered.
     *
     * `<Animated>` replaced this as the way to animate a screen. Deleting the
     * pack outright was the obvious move and would have been a bug: capability
     * ids are PERSISTED on every screen (`Screen.caps`), so a screen generated
     * last week still asks for 'motion' at render time. Remove it from the
     * registry and its prelude stops being injected — `FadeIn`, `Marquee`,
     * `BentoGrid` become undefined and every one of those screens throws.
     *
     * So: no triggers (the shortlist can never pick it), and `retired` keeps it
     * out of the capability documentation the model reads. Old screens keep
     * rendering exactly as they did; new ones only ever see `<Animated>`.
     */
    id: 'motion',
    kind: 'snippet-pack',
    retired: true,
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: MotionSource, exports: [...MOTION_EXPORTS] }],
    components: [
      { name: 'FadeIn', signature: '<FadeIn delay={0} y={16}>{children}</FadeIn>', description: 'Fade in + slide up on scroll into view. Accepts delay (ms) and y (px).', tags: ['fade', 'scroll', 'entrance'] },
      { name: 'Stagger', signature: '<Stagger delay={80}>{children}</Stagger>', description: 'Stagger entrance of children with incremental delay.', tags: ['stagger', 'list', 'entrance'] },
      { name: 'Marquee', signature: '<Marquee pauseOnHover reverse speed={20}>{children}</Marquee>', description: 'Infinite horizontal scroll. Duplicated track + CSS keyframes.', tags: ['marquee', 'scroll', 'loop'] },
      { name: 'Counter', signature: '<Counter to={1234} duration={1200} prefix="" suffix="" />', description: 'Animated number counter on scroll. Uses requestAnimationFrame easing.', tags: ['counter', 'number', 'stat'] },
      { name: 'Reveal', signature: '<Reveal direction="up|left|right">{children}</Reveal>', description: 'Reveal content from a direction on scroll into view.', tags: ['reveal', 'scroll', 'direction'] },
      { name: 'ShimmerButton', signature: '<ShimmerButton shimmerColor="#ffffff" shimmerDuration="3s">{children}</ShimmerButton>', description: 'A button with a shimmering light effect sweeping across it.', tags: ['button', 'cta', 'shine', 'glow'] },
      { name: 'BentoGrid', signature: '<BentoGrid><BentoCard name="..." description="..." /></BentoGrid>', description: 'A modular bento-style grid layout with cards.', tags: ['grid', 'bento', 'layout', 'cards'] },
      { name: 'BentoCard', signature: '<BentoCard name="..." description="..." />', description: 'A card component for use inside BentoGrid.', tags: ['card', 'bento'] },
      { name: 'BorderBeam', signature: '<BorderBeam size={200} duration={15} colorFrom="#ff0028" colorTo="#ffaa00" />', description: 'A rotating gradient beam travelling along the border of a container.', tags: ['border', 'beam', 'glow', 'accent'] },
      { name: 'TextReveal', signature: '<TextReveal text="Your text here" />', description: 'Reveals words one by one when scrolled into view.', tags: ['text', 'reveal', 'animation', 'scroll'] },
      { name: 'Meteors', signature: '<Meteors number={20} />', description: 'Animated meteor shower effect for dark backgrounds.', tags: ['meteors', 'stars', 'dark', 'background'] },
      { name: 'AnimatedBeam', signature: '<AnimatedBeam className="..." />', description: 'An SVG beam with an animated particle travelling along a path.', tags: ['beam', 'svg', 'connection', 'flow'] },
    ],
  },
  {
    /**
     * Motion itself, vendored — never selected on its own, only pulled in by
     * `animate` through `requires`.
     *
     * The url is a path on Mocky's own origin, not a CDN. That distinction is
     * the whole of invariant I3: the rule exists so a preview never depends on
     * a third-party fetch, and `/vendor/motion.js` is served by the same server
     * as the page. Motion publishes no browser build, so this file is produced
     * by `scripts/build-vendor-motion.mjs` and hash-pinned like every other
     * bundle in public/vendor.
     */
    id: 'motion-lib',
    kind: 'cdn-script',
    cdn: { url: '/vendor/motion.js', global: 'Motion' },
    globals: ['Motion'],
    triggers: { keywords: [], intents: [] },
  },
  {
    /**
     * The closed animation vocabulary: names and triggers, and no way for the
     * model to reach Motion's own API — see snippets/Animate.ts and AnimateFx.ts.
     *
     * The card is printed from the same lists the engine is tested against, and
     * it is grouped by what a family is FOR, because a catalogue of a hundred and
     * fifty names with only the upsides is how a page ends up using all of them.
     */
    id: 'animate',
    kind: 'snippet-pack',
    requires: ['motion-lib'],
    triggers: {
      keywords: ['animation', 'animate', 'animated', 'animé', 'motion', 'reveal', 'fade', 'stagger', 'transition', 'hover', 'entrance', 'landing', 'hero', 'parallax'],
      intents: ['animation', 'interactive', 'playful', 'dynamic'],
    },
    snippets: [{ source: AnimateSource, exports: [...ANIMATE_EXPORTS] }],
    components: [
      {
        name: 'Animated',
        signature: '<Animated preset="fade-up" trigger="view" delay={0.1} stagger={0.08} speed="slow" repeat on={value} as="section" className="…">{children}</Animated>',
        description:
          'Animates any block. With a `trigger`, every other prop (id, onClick, href, aria-*) reaches the element. `preset` is REQUIRED and must be EXACTLY one of the names below; any other name renders a plain, unanimated element, so never invent one. ' +
          '`trigger` says WHEN, and you should always write it: "view" (when it scrolls into view, once; add `repeat` to replay each time), "load" (at page load, for what the first screen shows), "scroll" (an entrance tied to the scroll position, undone by scrolling back), "hover", "click" (replays on each click; a button inside keeps its own onClick), "change" with on={value} (replays when value changes: the content of a tab, a filtered list). ' +
          '`delay` is seconds, 0–2. `speed` is "fast" or "slow". `stagger` is seconds between the block\'s direct CHILDREN (0.04–0.2), with any entrance: they animate instead of the block, so put it on the list and not on each item. `as` picks the tag, default "div". ' +
          `ENTRANCES take any trigger. Soft, the everyday ones: ${quoted(FX_ENTRANCES.soft)}. Depth and focus: ${quoted(FX_ENTRANCES.depth)}. Turning in 3D, which replaces the CSS transform for its length, so never on an element placed with a translate class: ${quoted(FX_ENTRANCES.turn)}. Curtains, where the block is uncovered and nothing moves, for pictures and coloured bands: ${quoted(FX_ENTRANCES.curtain)}. Springy, for a badge, a price, a button and never a paragraph: ${quoted(FX_ENTRANCES.spring)}. Stylised, at most one on a screen: ${quoted(FX_ENTRANCES.styled)}. Also "stagger-list" (the children of a list, one after another, on the LIST) and "exit-slide" (slides in, and out when removed). ` +
          `ONE-SHOTS, click by default, feedback and never decoration: ${quoted(FX_ATTENTION)}. ` +
          `STATES, under the cursor and undone when it leaves; trigger="click" makes a toggle: ${quoted(FX_HOVER)}. ` +
          `LOOPS forever, so ONE small decorative thing per section and never text to read; trigger="hover" runs one only under the cursor: ${quoted(FX_LOOPS)}. ` +
          `SCROLL-LINKED, driven by the block's whole passage across the screen, for pictures, bands and backgrounds and never body text: ${quoted(FX_SCROLL)}. ` +
          '"tilt-3d" (turns towards the cursor inside its own perspective, for a card or a picture; depth with no 3D renderer, so it may be used on many elements), "tilt-glare" (the same with a sheen), "magnetic" (a button that leans towards the cursor), "spotlight" (a light follows the cursor over a card), "cursor-parallax" (a decoration that drifts against the cursor), "hover-shine" (a sweep of light), "hover-zoom" (the picture inside a frame grows). ' +
          '"ripple" (a ring from the point clicked, for a button), "burst" (confetti from the point clicked, for a real success such as a like or a purchase; colors={["#…"]} optional).',
        tags: ['animation', 'motion', 'entrance', 'hover', 'stagger', 'reveal', 'parallax', 'blur', 'scroll', 'click', 'trigger'],
      },
      {
        name: 'Ticker',
        signature: '<Ticker speed={24} reverse pauseOnHover>{items}</Ticker>',
        description:
          'A row that scrolls forever — logo strips, testimonials, tags. The track is duplicated automatically, so pass the items ONCE. `speed` is the seconds per full pass (higher is slower, 4–120). `reverse` runs it right-to-left. `pauseOnHover` is on by default.',
        tags: ['marquee', 'ticker', 'logos', 'loop', 'scroll'],
      },
      {
        name: 'CountUp',
        signature: '<CountUp to={1284} duration={1200} prefix="" suffix="+" decimals={0} className="…" />',
        description:
          'A number that counts up when it scrolls into view — for statistics and KPIs. `to` is the final value and is REQUIRED. Renders as an inline <span>, so wrap it in your own heading or paragraph for styling. Thousands are spaced automatically.',
        tags: ['counter', 'number', 'stat', 'kpi', 'metric'],
      },
      {
        name: 'AnimatedText',
        signature: '<AnimatedText as="h1" preset="up" trigger="view" by="word" stagger={0.06} delay={0} className="…">The words of the headline</AnimatedText>',
        description:
          'A line of text whose words (or letters) arrive one after another — for a hero headline or one key sentence, at most two per screen. Its children must be PLAIN TEXT (a string, no tags inside). `as` is the tag, usually a heading ("h1", "h2", "p"; default "span"), and it takes your classes like that tag would. `preset` is "up" (each word rises — the default), "down", "fade", "blur" (each word comes into focus), "mask" (each word slides up from behind a line, the editorial reveal), "scale", "rotate", "flip", "slide-left", "slide-right", "skew", "glow", "elastic" (overshoots), "scramble" (random characters resolve into the text, for a short technical line), "typewriter" (typed out with a caret) or "scroll-fill" (the words go from faint to full ink as the page scrolls, for one large paragraph or manifesto line). `trigger` is "view" (when it scrolls into view, the default) or "load" (at page load, for a hero). `by` is "word" (default) or "letter" (only for a few large words). `stagger` is the seconds between two pieces (default 0.06 by word, 0.025 by letter), `delay` the seconds before the first. Screen readers hear the whole sentence, and with animations off it is the plain text.',
        tags: ['text', 'headline', 'reveal', 'typography', 'animation', 'split', 'words', 'letters', 'scramble', 'typewriter'],
      },
      {
        name: 'AnimatedWord',
        signature: '<AnimatedWord words={["designers", "founders", "teams"]} preset="up" interval={2.4} className="…" />',
        description:
          'One word of a headline that keeps changing, inside a sentence: <h1>Built for <AnimatedWord words={[…]} /></h1>. Its box is as wide as the longest word, so the sentence never jumps. `preset` is "up", "fade", "blur" or "flip". `interval` is the seconds per word (1–10). With animations off it is the first word.',
        tags: ['text', 'rotate', 'word', 'headline', 'loop'],
      },
      {
        name: 'AnimatedScrollText',
        signature: '<AnimatedScrollText speed={0.6} reverse className="text-8xl font-bold">Words in a giant band</AnimatedScrollText>',
        description:
          'A giant line of text that slides sideways as the page scrolls, for a band between two sections; at most one or two per screen. Children are PLAIN TEXT, written once. `speed` is 0.1–3, `reverse` slides the other way. Give it the type size through className.',
        tags: ['text', 'scroll', 'band', 'marquee', 'giant'],
      },
      {
        name: 'AnimatedProgress',
        signature: '<AnimatedProgress color="#6366f1" height={3} position="top" />',
        description:
          'A thin bar fixed to the edge of the window that fills as the reader moves down the page, for articles and long landing pages. Render it once, anywhere. `color` defaults to the text colour, `height` is in pixels, `position` is "top" or "bottom".',
        tags: ['scroll', 'progress', 'reading', 'bar'],
      },
      {
        name: 'AnimatedCollapse',
        signature: '<AnimatedCollapse open={isOpen}>{children}</AnimatedCollapse>',
        description:
          'A block that opens and closes smoothly to its own height, driven by your state: accordions, FAQ answers, "show more". `open` is a boolean you hold with useState; the button that changes it is yours. Never animate a height any other way.',
        tags: ['accordion', 'collapse', 'faq', 'expand', 'click', 'height'],
      },
      {
        name: 'AnimatedFlip',
        signature: '<AnimatedFlip trigger="hover" front={<div>…</div>} back={<div>…</div>} className="h-72" />',
        description:
          'A card with two faces that turns over in 3D, sized by its taller face or by your className: team members, pricing details, a question and its answer. `trigger` is "hover" (default; a tap also turns it on a phone) or "click". Each face is complete: give both their own background and padding.',
        tags: ['card', 'flip', 'click', 'hover', '3d', 'two sides'],
      },
      {
        name: 'AnimatedCursorGlow',
        signature: '<AnimatedCursorGlow color="#7c5cff" size={420} opacity={0.28} />',
        description:
          'A soft light that trails the pointer across the whole page, behind the content, for a dark, expressive page; render it once, and give the content above it a positive z-index. `color` defaults to the text colour. Nothing is drawn on a touch screen.',
        tags: ['cursor', 'pointer', 'glow', 'background', 'light'],
      },
    ],
  },
  {
    /**
     * three.js, as a browser global, from Mocky's own origin.
     *
     * Same argument as `motion-lib` one entry up, and invariant I3: a preview
     * never depends on a third-party fetch. The file is built by
     * `scripts/build-vendor-three.mjs` from a hand-written entry point that
     * re-exports only what the scene catalogue draws with — 522 KB raw, 133 KB
     * gzipped — and hash-pinned in `public/vendor/VENDOR.md`.
     *
     * It is loaded by a screen that asked for a scene and by no other, which is
     * the whole reason a capability is a capability.
     */
    id: 'three-lib',
    kind: 'cdn-script',
    cdn: { url: '/vendor/three.js', global: 'THREE' },
    globals: ['THREE'],
    /* The scene IS the picture — see the field. Without this, a screen with a
       <Scene3D> was thumbnailed as an empty gradient. */
    drawsContent: true,
    triggers: { keywords: [], intents: [] },
  },
  {
    /**
     * The closed 3D vocabulary. Six scenes, one component, and no way for the
     * model to reach three's own API — see snippets/Scene3D.ts, which also
     * carries the context-budget argument.
     */
    id: 'scene3d',
    kind: 'snippet-pack',
    requires: ['three-lib'],
    triggers: {
      keywords: [
        '3d', 'three', 'threejs', 'webgl', 'volume', 'relief', 'sphère', 'sphere', 'orbe', 'orb',
        'objet 3d', 'rendu 3d', 'particules', 'particles', 'immersif', 'immersive', 'depth', 'profondeur',
      ],
      intents: ['3d', 'immersive', 'playful', 'futuristic'],
    },
    snippets: [{ source: Scene3DSource, exports: [...SCENE3D_EXPORTS] }],
    components: [
      {
        name: 'Scene3D',
        signature: '<Scene3D preset="orb" color="#6366f1" speed="slow" className="h-72 w-full rounded-2xl" />',
        description:
          `A real 3D object, drawn with WebGL, as a decoration inside a section. \`preset\` is REQUIRED and must be EXACTLY one of these ten: ${SCENE3D_PRESETS.map((p) => `"${p}"`).join(', ')} — "orb" is a lit sphere, "solid" a turning knot, "crystal" a faceted rock, "ring" a torus, "globe" a sphere of dots with an orbit ring, "stack" three cards floating in depth, "bubbles" a cluster of spheres, "particles" a slow field of points, "grid" a tunnel of points travelling towards the viewer, "wave" a rippling surface. \`color\` is a hex from your own palette; anything else falls back to the house ink. \`accent\` is an OPTIONAL second hex, used by the scenes made of several parts — the globe's ring, one card in two, half the bubbles, the tunnel's ceiling. Give it your palette's second colour when you have one; leave it out and the scene is painted in \`color\` alone. \`speed\` is "slow" (the default and almost always right), "medium" or "fast". Give it a SIZE with Tailwind — it fills the box you put it in. Two shapes work: a sized box beside your text (\`h-72 w-full\`), or a full-bleed backdrop — \`className="absolute inset-0"\` as the FIRST child of a \`relative\` section, with the text after it in a \`relative\` wrapper of its own so it sits above. As a backdrop it draws itself quieter on its own, because nothing in a page measures the contrast of a moving pixel — so you do not need a veil, and a dark \`color\` is still the safer choice under pale text. It turns towards the cursor and with the scroll by itself; do not try to animate it. At most ONE per screen, and it is ENFORCED rather than requested: only one \`<Scene3D>\` on a screen MOVES at a time — the one the visitor is looking at — and any other is shown as a still picture of itself, because a browser grants about sixteen WebGL contexts for the whole canvas and one screen may hold one. A second scene is therefore never worth writing for its motion. For depth elsewhere on the page use \`<Animated preset="tilt-3d">\`, which costs no context at all. It is decorative, so it carries no text and no meaning a reader needs.`,
        tags: ['3d', 'webgl', 'three', 'volume', 'sphere', 'particles', 'hero', 'immersive'],
      },
    ],
  },
  {
    /**
     * A picture cut into a shape — see snippets/ShapeFrame.ts and the closed
     * catalogue in lib/frameShapes.ts. Offered on the words that ask for it, and
     * force-offered on a SOCIAL page format (lib/documentMode.ts), the posts it
     * was made for. Offered is not imposed: the card says when it is worth it.
     */
    id: 'frames',
    kind: 'snippet-pack',
    triggers: {
      // Phrases, not words: the text searched includes the DESIGN.md, and "forme",
      // "shape" or "frame" alone are in half of them ("plateforme", "framework").
      keywords: [
        'cadre photo', 'cadres photo', 'dans un cadre', 'en forme de', 'image dans une forme', 'photo dans une forme',
        'masque d', 'écrêtage', 'ecretage', 'clipping mask', 'photo frame', 'picture frame', 'shaped photo', 'shaped image',
        'photo découpée', 'image découpée', 'blob', 'polaroid', 'collage', 'scrapbook', 'moodboard',
        'post instagram', 'publication instagram', 'carrousel instagram', 'réseaux sociaux', 'social media post',
      ],
      intents: [],
    },
    snippets: [{ source: ShapeFrameSource, exports: [...SHAPEFRAME_EXPORTS] }],
    components: [
      {
        name: 'ShapeFrame',
        signature: '<ShapeFrame shape="blob-3" src="…" alt="…" focus="center" className="w-[420px]" />',
        description: `A picture cut into a SHAPE, like a clipping mask in an image editor — for social posts, flyers, collages and editorial layouts where a plain rectangle would be dull. \`shape\` is REQUIRED and must be EXACTLY one of: ${FRAME_FAMILIES.map(
          (f) => `${{ geometric: 'geometric', organic: 'organic', wave: 'waves and edges', photo: 'photo frames' }[f]} — ${FRAME_SHAPES.filter((s) => s.family === f)
            .map((s) => `"${s.id}"`)
            .join(', ')}`,
        ).join('; ')}. The photo frames carry their own paper: "polaroid" a white card with a deep caption margin, "stamp" a perforated stamp, "film" a strip of film, "ticket" notched corners, "bubble" a speech bubble, "tape" two strips of tape on the corners, "deckle" a torn-edged print, "mat" an oval window in a mount, "browser" a browser window with its title bar (for a screenshot of a site), "phone" a phone's bezel and notch (for a screenshot of an app — tall, so give it a narrow width), "slide" a 35 mm slide in its card mount, "gilt" a dark wooden frame with a gilt fillet. \`src\` is a picture you were GIVEN (the same address you would put in an <img>), never an invented one; without \`src\` the shape is drawn in quiet grey as a placeholder. \`alt\` describes the picture, in the page's language. Give it a WIDTH with Tailwind (\`w-full\`, \`w-[420px]\`): it keeps the proportions the shape was drawn for — unless you also give it a height or an aspect class, and then it is stretched to your box, a circle becoming an oval. Optional: \`focus\` keeps a part of the picture in view ("center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right" — "top" for a face), \`zoom\` 1 to 2, \`rotate\` −30 to 30 degrees for a hand-placed look, \`stroke\` a hex outline with \`strokeWidth\` in px, \`paper\` a hex for a photo frame's card, \`shadow\` for a soft drop shadow that follows the shape. It is a box like an image: place it with your own layout classes, overlap two for a collage, put type beside or over it. Use it where the shape MEANS something — one or two per page, not on every picture — and never draw a shape of your own with an inline <svg> path.`,
        tags: ['image', 'photo', 'frame', 'mask', 'clip', 'shape', 'blob', 'polaroid', 'collage', 'social'],
      },
    ],
  },
  {
    /**
     * Decorative shapes — see snippets/Ornament.ts and the closed catalogue in
     * lib/ornaments.ts. Force-offered to every DOCUMENT (lib/documentMode.ts),
     * whose briefs all ask for shapes, and offered elsewhere on the words that
     * ask for decoration.
     */
    id: 'ornaments',
    kind: 'snippet-pack',
    triggers: {
      // Phrases, for `frames`' reason: the text searched includes the DESIGN.md.
      keywords: [
        'formes décoratives', 'forme décorative', 'éléments décoratifs', 'élément décoratif', 'décoratif', 'décorative',
        'gribouillis', 'griffonnage', 'dessiné à la main', 'dessinée à la main', 'fait main', 'confettis', 'motif géométrique',
        'ludique', 'stickers', 'squiggle', 'doodle', 'hand-drawn', 'hand drawn', 'decorative shapes', 'decorative shape',
        'ornament', 'ornement', 'playful', 'confetti', 'memphis', 'pattern background', 'fond à motif',
      ],
      intents: [],
    },
    snippets: [{ source: OrnamentSource, exports: [...ORNAMENT_EXPORTS] }],
    components: [
      {
        name: 'Ornament',
        signature: '<Ornament shape="squiggle" color="#e11d48" className="absolute -bottom-4 left-0 w-48" />',
        description: `A decorative shape drawn for you — a blob behind a picture, a squiggle under a word, a circle scribbled round a price, a dotted texture in a corner. \`shape\` is REQUIRED and must be EXACTLY one of: solid shapes — ${ORNAMENTS.filter((o) => o.kind === 'fill')
          .map((o) => `"${o.id}"`)
          .join(', ')}; two-colour fluid shapes (a blob with a ribbon or a ring in \`accent\`) — ${ORNAMENTS.filter((o) => o.kind === 'fluid')
          .map((o) => `"${o.id}"`)
          .join(', ')}; hand-drawn strokes and decorative frames to lay over a picture or a block — ${ORNAMENTS.filter((o) => o.kind === 'line' && !ORNAMENT_OUTLINE_IDS.includes(o.id))
          .map((o) => `"${o.id}"`)
          .join(', ')}; compositions of many blobs, pebbles and abstract shapes drawn as contours only — ${ORNAMENT_OUTLINE_IDS.map((id) => `"${id}"`).join(', ')}; textures — ${ORNAMENTS.filter((o) => o.kind === 'pattern')
          .map((o) => `"${o.id}"`)
          .join(', ')}; moving signs (loaders, a beat; they hold still in a document, with reduced motion and with animations off) — ${ORNAMENTS.filter((o) => o.kind === 'motion')
          .map((o) => `"${o.id}"`)
          .join(', ')}. Any other name draws nothing. \`color\` is a hex from your palette; without it the shape takes the text colour, so a \`text-*\` class colours it too. Size it like an image: a WIDTH (\`w-40\`) keeps the proportions it was drawn for, a width AND a height stretch it; a texture needs both (\`w-64 h-40\`, or \`absolute inset-0\` to fill a block) and \`density\` (3–40) sets how many dots, lines or squares run across it. A stroke takes \`weight\` in px (default 3) and keeps it whatever the size; "scribble-circle", "underline" and "squiggle" are made to sit around or under a word — put them in a \`relative\` wrapper with the word, absolutely positioned. \`accent\` is a second hex for the fluid shapes, the moving signs and the two-tone textures ("checker", "confetti", "harlequin", "pinwheels", "cubes"…); without it they use \`color\` at half strength. The abstract solids ("arc-band", "rainbow", "half-circles", "target", "cog", "wave-band"…) are the vocabulary of a Bauhaus, Swiss or Memphis poster: big, flat, overlapping, bleeding off the edges. \`outline\` draws any solid or fluid shape as its contour only, a stroke of \`weight\` px like the strokes (\`<Ornament shape="blob-3" outline color="#0f766e" />\`) — for a line-drawn, airy look; several outlined blobs overlapping make a composition of your own. Optional: \`rotate\` in degrees, \`flip\` ("x" or "y"), \`opacity\` 0–1, and \`draw\` (with \`delay\` in seconds) on a stroke to trace it when it scrolls into view — never on a printed document. Place it with your own classes, most often \`absolute\` inside a \`relative\` block and behind the content (\`-z-0\`, or before it in the markup), several bleeding off an edge. It is decorative: it is hidden from screen readers and carries no text. Never write your own <svg> path for a shape this list has.`,
        tags: ['shape', 'decoration', 'ornament', 'blob', 'squiggle', 'doodle', 'pattern', 'texture', 'arrow', 'confetti'],
      },
    ],
  },
  {
    /**
     * A text's ideas drawn as a process, a cycle, a comparison, a chart… out
     * of the closed catalogue of `lib/visuals/families.ts` (user doc
     * `docs/visuals.md`). Force-added by the "Visual" screen type and kept by
     * `Screen.caps` for every later pass; `forcedOnly` because `Visual` is a
     * word a model gives its own components, and inferred from an unrelated
     * screen's code the pack's `function Visual` would collide with it.
     */
    id: VISUALS_CAP,
    kind: 'snippet-pack',
    forcedOnly: true,
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: VisualSource, exports: [...VISUAL_EXPORTS] }],
    components: [
      {
        name: 'Visual',
        signature: '<Visual family="steps" variant="soft" alternatives={["timeline", "cycle"]} colors={["#0f766e", "#f59e0b"]} ink="#111827" ground="#ffffff" doc={{ title: "…", subtitle: "…", items: [{ label: "…", detail: "…", icon: "Users" }] }} className="w-full h-full" />',
        description: `A text's ideas laid out for you — never draw a diagram or an infographic yourself with boxes, SVG or CSS: write its CONTENT in \`doc\` and name a \`family\`, and the layout, the type sizes, the connectors and the contrast are computed. \`family\` is EXACTLY one of: ${VISUAL_FAMILIES.map((f) => {
          const b = VISUAL_BOUNDS[f]
          const count = b.exact ? `exactly ${b.min} items` : `${b.min}–${b.max} items`
          const needs = [b.values ? 'every item has a value' : '', b.children ? 'every item has children' : ''].filter(Boolean).join(', ')
          return `"${f}" (${FAMILY_USE[f]}; ${count}${needs ? `; ${needs}` : ''})`
        }).join('; ')}. Pick the family the text's STRUCTURE calls for, not the prettiest. \`doc\` is plain data, written inline: \`title\` (the visual's headline, a few words), \`subtitle\` (one sentence), \`items\` — each \`{ label, detail?, icon?, value?, unit?, children?, emphasis? }\`: \`label\` at most ${VISUAL_LABEL_WORDS} words, \`detail\` at most ${VISUAL_DETAIL_WORDS} words, \`icon\` a name of the Icon namespace, \`value\` a NUMBER (not a string) only when the text states that figure — never invent, round or compute one — with its \`unit\` ("%", "€", "k"), \`children\` an array of short strings, \`emphasis\` true on at most one item; \`relations\` (flow only) \`[{ from, to, label? }]\` by item index from 0; \`axes\` (matrix only) \`{ x, y }\`; \`source\` a short "Source: …" line when the text names one. Write the words in the language of the request. \`alternatives\` lists two or three OTHER families that would also suit this content, best first — the person can switch to them without a new generation, so only name families whose item count and requirements this \`doc\` meets. \`variant\` is "soft" (tinted boxes, the default), "solid" (filled boxes) or "outline". \`colors\` are one to four hexes of YOUR palette, in order of importance; \`ink\` and \`ground\` are the hexes of the text and of the background the visual sits on — every text is then measured and kept readable. Size it with its parent: give it a box with a height (\`className="w-full h-full"\` inside a flex-1 area); with no height it takes 16:9 of its width.`,
        tags: ['visual', 'infographic', 'diagram', 'process', 'timeline', 'cycle', 'comparison', 'chart', 'mind map', 'flowchart'],
      },
    ],
  },
  {
    /**
     * Motion Ultra's kit: the `u-*` stylesheet and `<Backdrop>`.
     *
     * Force-added, never keyword-triggered. The kit is only worth its prompt
     * space on a screen that was storyboarded for it; offered on a guess, a
     * "landing" prompt would get display type and an aurora whether or not the
     * project asked for Motion Ultra — and Motion Ultra OFF must leave the
     * generation path exactly as it was. Once a screen has it, `Screen.caps`
     * keeps it, so an edit, a repair or a polish of that screen sees the same
     * kit the generation did (see `buildCapabilitiesPrompt`).
     */
    id: 'ultra',
    kind: 'snippet-pack',
    requires: ['animate'],
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: UltraSource, exports: [...ULTRA_EXPORTS] }],
    classes: Object.keys(ULTRA_CLASSES),
    components: [
      {
        name: 'Backdrop',
        signature: '<Backdrop preset="aurora" colors={["#7c5cff", "#22d3ee", "#f472b6"]} image="…" tone="dark" veil={0.35} />',
        description:
          `A living background for ONE section, drawn in CSS — no WebGL, so it costs nothing a browser rations. \`preset\` is exactly one of ${BACKDROP_PRESETS.map((p) => `"${p}"`).join(', ')}: "aurora" is three blurred colour masses drifting, "mesh" a slow gradient mesh, "spotlight" a light that follows the cursor (dark grounds only), "beams" rays turning very slowly from above, "grid" a perspective floor of lines with a glow on the horizon, "horizon" the lit edge of a planet at the foot of the section under a field of stars (dark grounds). \`colors\` are up to three hexes from YOUR palette (they also set --u-a/--u-b/--u-c for the section's u-* classes). \`image\` is an optional generated picture, drawn underneath and slowly zoomed — use it only with a URL you were given. \`tone\` is "dark" (default) or "light", for the ground it sits on. \`veil\` (0–0.9) lays the ground colour over it so text stays readable; default 0.35 with an image, 0 without. It is absolutely positioned: make it the FIRST child of a \`relative overflow-hidden\` section and put the content after it in a \`relative z-10\` wrapper. At most two per screen. Decorative: it carries no text.`,
        tags: ['background', 'aurora', 'gradient', 'mesh', 'spotlight', 'beams', 'grid', 'hero', 'ultra'],
      },
    ],
  },
  {
    // Never selected by keywords, and that is deliberate: the component is
    // useless without a `base` and a `frames` count, which only exist once Muse
    // has actually paid for a clip. It is force-added at generation time when
    // one was produced (see ProjectView), never guessed from the prompt — a
    // screen offered <ScrollSequence> with nothing to show would render a black
    // box the size of three viewports. <PointerSequence> lives in the same pack
    // for the same reason: it draws the same cut frames, only steered otherwise.
    id: 'scrollvideo',
    kind: 'snippet-pack',
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: ScrollVideoSource, exports: [...SCROLLVIDEO_EXPORTS] }],
    components: [
      {
        name: 'ScrollSequence',
        signature: '<ScrollSequence base="/api/videos/<hash>" frames={60} height={300}>{overlay}</ScrollSequence>',
        description:
          'A generated clip that advances frame by frame as the visitor scrolls, pinned full-height while it plays out. `base` and `frames` are provided by Muse; `height` is the scroll travel in viewport-heights. Children are overlaid on top, centred.',
        tags: ['video', 'scroll', 'scrub', 'hero', 'pinned', 'cinematic'],
      },
      {
        name: 'PointerSequence',
        signature:
          '<PointerSequence base="/api/videos/<hash>" frames={60} axis="x" className="min-h-[420px]">{content}</PointerSequence>',
        description:
          'The same kind of clip, steered by the CURSOR instead of the scroll: moving the pointer across the page moves through the clip, easing towards it — a face whose eyes follow the mouse, an object that turns as the pointer crosses. `base` and `frames` are provided — never invent them, never change them. It is a BOX, not a section: put it where the brief places it (a footer, a hero, a card) and size it with `className` (`min-h-[420px]`, `h-full` inside a sized parent); with children and no height it is as tall as its content. Children are laid ON the clip and stay clickable, so the footer\'s or section\'s own content goes inside it. `axis` is "x" (default: left edge = first frame, right edge = last) or "y"; `reverse` flips it. `map` is optional: a grid of frame numbers (1 to `frames`), rows top to bottom and cells left to right, e.g. map={[[12,6,1],[18,30,24],[42,36,48]]} — the cell under the pointer picks the frame; use it when the brief gives a gaze or frame table, and write the table inline, never as an import. `track` is "window" (default: the pointer anywhere on the page) or "self" (only over the box). `rest` is "center" (default), "start" or "end": the frame shown before the first move and when the pointer leaves. `fit` is "cover" (default) or "contain". Never add a <video> or an <img> for the clip — the component draws the frames itself.',
        tags: ['video', 'pointer', 'mouse', 'cursor', 'gaze', 'follow', 'scrub', 'interactive', 'footer', 'hero'],
      },
    ],
  },
  {
    // Force-added, never keyword-triggered, for exactly the reason scrollvideo
    // is: the component needs a `src` that only exists once Motion has actually
    // composed and RENDERED a film, which costs a model call and minutes of a
    // worker. Offered on a guess it would render an empty rectangle where a hero
    // was promised — which is the defect this capability was written to fix, so
    // reintroducing it through the trigger list would be a poor joke.
    id: 'motionfilm',
    kind: 'snippet-pack',
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: MotionFilmSource, exports: [...MOTIONFILM_EXPORTS] }],
    components: [
      {
        name: 'MotionFilm',
        signature: '<MotionFilm src="/api/video/<hash>" fit="cover" radius={0} loop>{overlay}</MotionFilm>',
        description:
          'A rendered Motion film, playing muted and looping. `src` is provided — never invent one. It fills whatever box you put it in, so it is a hero background at full width AND a product card, a banner strip or a section background at any smaller size; give the parent a height. `fit` is "cover" (default, fills and crops) or "contain" (whole frame, letterboxed). Pass children to lay content OVER the film — use that for a hero rather than positioning your own overlay. They are a THIN layer: type, buttons, a badge. Never pass a picture of your own — no `<img>`, no `<Scene3D>`, no `bg-[url(…)]` — and never wrap a section, a column or a grid of the page in it: it is not a container, and two pictures in one box hide one another. There is no sound and no controls.',
        tags: ['video', 'film', 'motion', 'hero', 'background', 'banner', 'loop', 'showreel'],
      },
    ],
  },
  {
    /**
     * Working prototypes: shared state between screens and navigation by route
     * (snippets/Flow.ts, lib/flows.ts). Never chosen by keywords — force-added
     * when the composer's "Parcours" switch is on, then persisted on the
     * screen, so every later edit of it keeps the vocabulary. Its names are
     * distinctive enough to be inferred from code, which is what lets an edit
     * that adds a cart to a screen load the kit with no switch at all.
     */
    id: 'flow',
    kind: 'snippet-pack',
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: FlowSource, exports: [...FLOW_EXPORTS] }],
    components: [
      {
        name: 'useFlowState',
        signature: 'const [cart, setCart] = useFlowState("cart", [])',
        description:
          'Like useState, but SHARED by every screen of the prototype and kept while the visitor moves from one screen to another in the demo. Use it for what another screen must see: the signed-in user, the cart, favourites, a submitted form, the chosen filters. Plain JSON values only.',
        tags: ['state', 'cart', 'login', 'form', 'flow'],
      },
      {
        name: 'MockyFlow',
        signature: 'MockyFlow.go("cart")',
        description:
          'Opens another screen of the prototype by its ROUTE — a short lowercase name of the page. Call it after the action that leads there: a successful sign-in, "View cart", a submitted form. MockyFlow.reset() empties the shared data (a "Sign out" that starts over).',
        tags: ['navigation', 'route', 'flow', 'link'],
      },
      {
        name: 'FlowLink',
        signature: '<FlowLink to="cart" className="…">Panier</FlowLink>',
        description: 'A link to another screen of the prototype, by route — an <a> that calls MockyFlow.go(to). Accepts className and the usual attributes.',
        tags: ['link', 'navigation', 'flow'],
      },
    ],
  },
  {
    /**
     * The page kit of DOCUMENT screens — see snippets/Document.ts and
     * lib/documentMode.ts.
     *
     * Force-added to a screen created with a page format, and to no other:
     * no keyword can make an app screen a document, and `forcedOnly` keeps
     * `capabilitiesUsedBy` from inferring it off a screen that merely defines
     * its own `Field`. Persisted in `Screen.caps` like `ultra`, which is what
     * makes every later pass — edit, repair, polish, audit fix — print
     * DOCUMENT_RULES after the app-oriented base rules.
     */
    id: 'document',
    kind: 'snippet-pack',
    forcedOnly: true,
    triggers: { keywords: [], intents: [] },
    snippets: [{ source: DocumentSource, exports: [...DOCUMENT_EXPORTS] }],
    components: [
      {
        name: 'Doc',
        signature: '<Doc format="a4">{pages}</Doc>',
        description: `The root of the document — the one element App returns. \`format\` is exactly the one named in FORMAT (${PAGE_FORMAT_IDS.map((id) => `"${id}"`).join(', ')}). Its children are <Page> elements and nothing else. It stacks the pages for the canvas and tells the exporter where each one is; it takes no className — style the pages, not the document. A folded leaflet adds \`fold\` (${FOLD_IDS.map((id) => `"${id}"`).join(', ')}) only when FOLDED LEAFLET names one.`,
        tags: ['document', 'print', 'pdf', 'flyer'],
      },
      {
        name: 'Page',
        // No colour and no language in the examples: the only Page a model is
        // shown is the one it copies, and a literal yellow here made every flyer
        // without a direction the same yellow.
        signature: '<Page className="relative p-[40px] flex flex-col">…</Page>',
        description:
          'One page, EXACTLY the format\'s size, with overflow hidden: absolutely positioned shapes may bleed off its edges and are cut at the trim like a printed sheet. Style it freely with className — a background in the palette of the direction, padding, flex or grid layout — but never give it a width, a height, a min-h-screen or a margin: the kit sets them and ignores yours. Words taller than the page are CLIPPED on paper and reported as an overflow: cut copy or add a <Page>.',
        tags: ['page', 'document', 'print', 'sheet', 'slide'],
      },
      {
        name: 'Panel',
        signature: '<Panel className="p-[32px] flex flex-col">…</Panel>',
        description:
          'One panel of a FOLDED leaflet, used only when FOLDED LEAFLET says so: a direct child of a <Page>, in the order the list gives. The kit sizes it to its exact width between two folds and the full height of the sheet, with overflow hidden; style it freely with className but never give it a width, a height or a margin. Words that run past a fold are reported as an overflow, like words past the page edge.',
        tags: ['panel', 'fold', 'leaflet', 'brochure', 'trifold'],
      },
      {
        name: 'Field',
        signature: '<Field name="email" type="email" label="…" />',
        description: `A blank to fill in, which becomes a REAL form field in the exported PDF. \`name\` is unique in the document. \`type\` is exactly one of ${FIELD_TYPES.map((t) => `"${t}"`).join(', ')} (default "text"). \`label\` is printed above it (beside it for a checkbox), in the document's language, like an optional \`placeholder\`. \`options\` is an array of strings for "select"; \`rows\` sets the height of a "multiline". Without className it has a neutral bordered look; a className REPLACES that look entirely, so give it its own border or background and padding. It fills the width of its parent — size it with the parent.`,
        tags: ['form', 'field', 'input', 'coupon', 'pdf'],
      },
    ],
  },
  {
    /**
     * Interactive sites — see snippets/Interact.ts and plans/sites-interactifs.md.
     * Offered on the words of a page the visitor HANDLES (drag, a shelf, a
     * sprite sheet with crop boxes, a custom cursor, a card that opens into a
     * page) and inferred from code like the others. The arithmetic a model
     * rewrites wrongly every time is in the pack; the page composes it.
     */
    id: 'interact',
    kind: 'snippet-pack',
    triggers: {
      // Phrases where a word alone is in half the briefs ("ink" is inside
      // "pink" and "link", "mask" inside every SVG prompt).
      keywords: [
        'drag', 'glisser', 'faire glisser', 'swipe', 'flick', 'carousel', 'carrousel', 'shelf', 'étagère', 'etagere',
        'sprite', 'sprite sheet', 'planche', 'crop box', 'crop boxes', 'découpe', 'decoupe', 'background-position',
        'custom cursor', 'curseur personnalisé', 'curseur personnalise', 'ring cursor', 'ink blot', 'ink reveal', "taches d'encre", 'encre',
        'mask slide', 'slides up through a mask', 'through a mask', 'par un masque', 'colour reveal', 'color reveal',
        'snap to', 'snaps to', 'inertia', 'inertie', 'mouse wheel', 'scroll, drag', 'molette', 'scrub', 'requestanimationframe', 'web animations',
        'grows out of', 'fly to', 'flies into', 'shared element',
      ],
      intents: [],
    },
    snippets: [
      { source: InteractSource, exports: [...INTERACT_EXPORTS] },
      { source: Interact3DSource, exports: [...INTERACT3D_EXPORTS] },
    ],
    components: [
      {
        name: 'SheetCrop',
        signature: '<SheetCrop sheet={SHEETS.covers} box={[497, 72, 344, 659]} name="cover-valley" alt="…" className="w-40" />',
        description:
          'One rectangle cut out of a picture SHEET (a sprite sheet, a contact sheet, a grid of prints), stretched to fill its box exactly. Write the sheets ONCE as data — const SHEETS = { covers: { src: "URL", w: 1744, h: 2336 } } with the size the brief gives in SOURCE pixels — and every crop as [x, y, w, h] in those same source pixels: the crop stays right whatever size the sheet is served at, so never convert the numbers. Without a height or an aspect class it keeps the box\'s own proportions. `name` labels it for diagnostics; `alt` makes it an image for screen readers (omit it on a decorative copy). Children are laid over it. A box outside the sheet draws a striped placeholder and names the problem in the console — never "fix" a box by guessing. Use it for EVERY crop the brief names, in HTML; never slice the sheet into separate files and never use <img> for a crop.',
        tags: ['sprite', 'sheet', 'crop', 'image', 'cover', 'thumbnail'],
      },
      {
        name: 'sheetCropSvg',
        signature: '<image {...sheetCropSvg(SHEETS.covers, [497, 72, 344, 659], 474, 900)} />',
        description:
          'The same crop as the attributes of an SVG <image> inside a viewBox of the given width × height — for a crop that must live in an SVG (a clip, a mask, a filter). Spread it on <image>; the box then fills the whole viewBox.',
        tags: ['sprite', 'svg', 'crop', 'mask'],
      },
      {
        name: 'sheetCropMask',
        signature: 'overlayMask={sheetCropMask(SHEET, box)}',
        description:
          "The same crop as a CSS mask style object — for a layer that must stop at the picture's own transparent outline. Pass it to Box3D's `overlayMask` when a face is a cut-out (a wrapper, a bottle), so its shade and sheen follow the silhouette instead of drawing a rectangle around it.",
        tags: ['sprite', 'mask', 'crop', 'silhouette'],
      },
      {
        name: 'useGlideTrack',
        signature: 'const t = useGlideTrack({ count: films.length, initial: 5, loop: true, unit: 64, wheel: true, keys: true, onChange: (i, dir) => {} })',
        description:
          'ONE continuous position shared by everything that moves together: a shelf, a carousel, an arc of products, a walk along a corridor. `t.pos` is a FLOAT (2.5 = halfway between item 2 and item 3) that eases towards `t.target` every frame; derive every transform, angle, scale and opacity from `t.offset(i)` (how many steps item i stands from the centre, wrapped on a loop) so that dragging halfway puts EVERY item halfway at once. Spread `{...t.bind}` on the element the gestures are read on: a drag follows the pointer (`unit` = pixels per step, a number or a function for a size measured at run time), a flick carries up to two more steps, release snaps to the nearest item, and the click a drag ends on is swallowed. `wheel: true` steps with the wheel (and stops the page scrolling over it — leave it off on a section of a long page), `keys: true` uses the arrow keys (`axis: "y"` for up/down), `enabled: false` freezes it while a detail view is open. `t.go(i)` glides to item i the short way round, `t.step(±1)` moves one; `t.index` is the item at the centre now, `t.selected` the one it is going to, `t.dir` the direction (+1/−1), `t.settled` true at rest. `onChange(i, dir)` fires as each item passes the centre — drive captions from `t.index`, never from a separate state. `stiffness` (default 5.2) and `dragStiffness` (18) tune the glide. It renders every frame while moving: keep the items it maps cheap, and render each copy of a looping list from one data array.',
        tags: ['drag', 'swipe', 'carousel', 'shelf', 'wheel', 'snap', 'inertia', 'progress', 'gesture'],
      },
      {
        name: 'MaskSwap',
        signature: '<MaskSwap value={film.title} dir={t.dir} className="text-3xl" />',
        description:
          'Text that changes by sliding through a mask: when `value` changes, the old text leaves one way and the new one comes in from the other, and if it changes again mid-way every intermediate value passes through in turn. `dir` +1 brings the new text up from below, −1 down from above — pass the track\'s `dir`. `by="letter"` staggers per letter (words never break), `fade` adds an opacity fade to the slide, `duration` (650 ms), `easing`, `as` (default "div"), `appear` also animates the first value. Plain text only. Use it for every caption, title, counter or label that follows a selection.',
        tags: ['text', 'mask', 'caption', 'title', 'swap', 'reveal'],
      },
      {
        name: 'InkReveal',
        signature: '<InkReveal sheet={SHEETS.covers} box={[74, 72, 347, 659]} width={474} height={900} play={open} delay={520} alt="…" className="h-full" />',
        description:
          'A picture that arrives like ink spreading on paper: a few ragged blots grow and merge until the whole picture shows. Give it a crop (`sheet` + `box`) or a plain `src`; `width`/`height` set its proportions. It plays when `play` becomes true and is blank while false — tie it to the open state of the view it is in. `delay`, `duration` (1250 ms), `blobs` (7), `seed`, `roughness` (120). Under reduced motion the picture is simply there.',
        tags: ['ink', 'reveal', 'mask', 'poster', 'image', 'blot'],
      },
      {
        name: 'ColorReveal',
        signature: '<ColorReveal color={flavour.color} origin={[50, 41]} className="absolute inset-0" />',
        description:
          'A background layer whose colour changes by a feathered circle growing out of `origin` (percent of its box) until it covers the old colour. Put it first in a section, behind the content; it takes no clicks. `duration` (420 ms), `onDone(color)`. Use it when a selection recolours a section, instead of a cross-fade.',
        tags: ['color', 'background', 'reveal', 'transition', 'theme'],
      },
      {
        name: 'PointerRing',
        signature: '<PointerRing color="#141414" states={{ spine: { scale: 0.72 }, link: { scale: 0.55, dot: false }, open: { scale: 1.75, fill: "#1F3FB0", dot: false, label: "OPEN" } }} />',
        description:
          'A custom cursor: a ring and a dot that follow the mouse smoothly and hide the system cursor — on mouse and trackpad only, never on touch. Its state is the `data-cursor` attribute of the element under the pointer (data-cursor="open" on the active cover, data-cursor="spine" on the others); `link` applies over any link or button. Each state sets `scale`, `fill`, `border`, `dot` (false hides it) and a short `label` shown inside. `size` (58), `follow` (16). Render it ONCE, at the end of the page.',
        tags: ['cursor', 'pointer', 'hover'],
      },
      {
        name: 'MockyMorph',
        signature: 'MockyMorph.grow(dialogEl, coverEl, { rotate: -4.5 }) · MockyMorph.grow(dialogEl, coverEl, { rotate: -4.5, reverse: true }) · MockyMorph.fly(cardImgEl, pageImgEl)',
        description:
          'Moves between two REAL places on the page, measured when called. `grow(el, from, o)` makes `el` (a detail view already rendered and visible) grow out of `from` — an element or a rect — straightening `o.rotate` degrees on the way (1050 ms); with `reverse: true` it shrinks back onto `from` (850 ms), and called while still growing it turns back from where it is. `fly(from, to, o)` flies a copy of `from` onto `to` while the real `to` stays hidden, so there is never two of it (300 ms; `lift` arcs it, `rotate`, `endOpacity`, `delay`). Both return a promise. Call them in the event handler AFTER the target is rendered (in a useLayoutEffect on the open state, or after a setState with requestAnimationFrame), with refs to the elements — never with selectors guessed from text. Always measure `from` again on the way back: the shelf may have moved.',
        tags: ['transition', 'flip', 'morph', 'shared element', 'open', 'detail', 'fly'],
      },
      {
        name: 'Box3D',
        signature: '<Box3D w={36} h={210} d={110} rotateY={-90 * open} rotateZ={-4.5 * open} front={<SheetCrop … />} right={<SheetCrop … />} gloss={0.3} />',
        description:
          'A real box in CSS 3D, in pixels: `w` × `h` × `d`, and any of six faces — `front`, `back`, `left`, `right`, `top`, `bottom` — each a node that fills its face (usually a <SheetCrop>). `rotateX/Y/Z` in degrees (applied Z, then X, then Y), `x/y/z` in px. Each face darkens by how far it is turned from the light (`shade` 0–1, default .55; `light` = [x, y, z], y down), so a spine turning into a cover reads as a lit object — never add your own shading. `gloss` 0–1 slides a sheen across front and back as it turns; for a cut-out face pass `overlayMask={sheetCropMask(sheet, box)}` so shade and sheen stop at its outline. The PARENT needs a CSS `perspective` (e.g. style={{ perspective: 2200 }}) or a <Space3D>. Use it for every object that has a thickness: a VHS case or a book on a shelf (spine = front, cover = right, rotateY −90 shows the cover), a product box, a card with an edge. A flat product seen front and back (a wrapper, a bottle label) is a Box3D with a small `d`, `front` = the picture and `back` = a <SheetCrop mask flip> of the SAME crop holding the printed back in HTML. Children are laid in the box\'s own space. Event handlers and data-* attributes pass through; with an onClick it is also a keyboard button (Tab, Enter, Space) — give it an aria-label naming what it opens.',
        tags: ['3d', 'box', 'cuboid', 'product', 'flip', 'vhs', 'book', 'package'],
      },
      {
        name: 'MaskRise',
        signature: '<MaskRise play={open} delay={620} stagger={75}><p>…</p><h2>…</h2><p>…</p></MaskRise>',
        description:
          'Each child is a line that rises out of its own mask when `play` becomes true, one after the other (`delay` before the first, `stagger` between them, `duration` 900 ms, `from` 110 %), and is hidden again when `play` is false — tie it to the open state of a view so every opening replays it. Use it for the text of a page that opens, a headline revealed line by line, a caption block. Never fade text in instead.',
        tags: ['text', 'reveal', 'mask', 'stagger', 'lines'],
      },
      {
        name: 'useTweened',
        signature: 'const pose = useTweened(focused ? FOCUS : WALK, { duration: 950, easing: { th: "quartOut", yaw: "quadOut", r: "cubicOut" } })',
        description:
          'A number, or an object of numbers, that TRAVELS to its target whenever the target changes: returns the in-between value every frame. `duration` in ms; `easing` a name ("linear", "quadOut", "cubicOut", "quartOut", "expoOut", "sineInOut", "cubicInOut"), a cubic-bezier as [x1, y1, x2, y2], or an object giving each key its own (so a camera\'s travel can lead and its turn lag). Retargeted mid-way, it starts from where it is. `onDone(value)`. Reduced motion arrives at once. Use it for a camera glide, a flip to a given angle, a pose between two states — not for a value the visitor drags (that is useGlideTrack).',
        tags: ['tween', 'animation', 'easing', 'camera', 'pose'],
      },
      {
        name: 'useViewportSize',
        signature: 'const { w, h } = useViewportSize()',
        description: 'The window\'s size in px, updated on resize — for geometry derived from the screen (const H = Math.min(h * 0.46, w * 0.31)).',
        tags: ['viewport', 'resize', 'responsive'],
      },
      {
        name: 'Space3D',
        signature: '<Space3D camera={{ x, y, z, yaw, pitch }} fov={56} scale={100} fog={[10, 46]} className="fixed inset-0" style={{ background: "#FFF9EC" }}>…</Space3D>',
        description:
          'A 3D WORLD drawn in CSS, seen through a camera: for a gallery to walk through, a room, a passage, things placed in space. World units with y UP (metres, as a three.js brief writes them), `scale` px per unit. `camera`: position x/y/z and `yaw` (radians; 0 looks towards −z, positive turns left) and `pitch` (positive looks up) — drive it from useGlideTrack (walking) and useTweened (gliding to a focus). `fov` vertical, in degrees. `fog` [near, far] fades things by distance into the Space3D\'s own background, so give it the fog colour (a vertical gradient from wall to floor colour reads as a floor). `overlay` is laid over the world, not in it. Everything is ordinary DOM: a click on a print IS that print (both walls, no ray casting), and MockyMorph.fly/grow from it starts at its projected rectangle. Fill it with <Place3D> and <Ring3D>.',
        tags: ['3d', 'gallery', 'camera', 'room', 'walk', 'space', 'museum'],
      },
      {
        name: 'Place3D',
        signature: '<Place3D at={[x, y, z]} yaw={MockySpace.facing(at, [0, y, 0])} onClick={…}><SheetCrop … /></Place3D>',
        description:
          'Puts its children at a point of the <Space3D> world, centred, facing +z when `yaw` is 0 (`yaw`, `pitch`, `roll` in radians). The child\'s size is in px (world size × the Space3D\'s scale). Things behind the camera are not drawn (`radius`, in units, keeps a large thing until it is wholly behind; `cull={false}` never hides) and fog fades them (`fog={false}` exempts one). Events and data-* attributes pass through; with an onClick it is also a keyboard button (Tab, Enter, Space) — give it an aria-label.',
        tags: ['3d', 'place', 'position', 'gallery'],
      },
      {
        name: 'Ring3D',
        signature: '<Ring3D radius={18} height={6.2} segments={48} background="linear-gradient(#F5EBD8,#FBF3E3 20%,#FBF3E3 60%,#EFDFC4)" />',
        description:
          'The walls of a round room or of a curved passage: a ring of `segments` panels of `height` units around the vertical axis, facing the centre (`inside`, default) or away from it (`inside={false}`, the inner wall of a ring-shaped corridor). Two rings make a corridor; the prints go on <Place3D> just in front of each.',
        tags: ['3d', 'wall', 'ring', 'corridor', 'room'],
      },
      {
        name: 'useScrollProgress',
        signature: 'const p = useScrollProgress(sectionRef, { start: 1, end: 0 })',
        description:
          'How far an element has come up the screen, 0 to 1: 0 while its top is at `start` viewport-heights from the top (1 = the bottom edge), 1 once it reaches `end`. For the steps of a pinned section (a 500vh section with a sticky inside: steps = Math.floor(p * n)), a fade tied to a section arriving, a storm that plays as the visitor scrolls.',
        tags: ['scroll', 'progress', 'pinned', 'sticky', 'steps'],
      },
      {
        name: 'AnchorTravel',
        signature: '<AnchorTravel stops={[{ anchor: heroSlotRef }, { anchor: insideBoxRef, rotateZ: 14, rotateY: flip }, { anchor: cardRefs[sel], when: shopRef, start: 1, end: 0.3 }]}>{(pose) => <Box3D w={pose.w} h={pose.h} d={6} rotateY={pose.rotateY} rotateZ={pose.rotateZ} front={…} back={…} />}</AnchorTravel>',
        description:
          'ONE object that travels down the page from place to place — the product picked in the hero that flies into the next section, turns there, and lands exactly on its own card in the shop. Each stop is an `anchor` (a ref to an empty placeholder element sized and placed where the object should stand: the centre slot of a carousel, a box in a pinned section, the picture spot of a card) plus a pose (`rotateX/Y/Z` in degrees, `z`, `opacity`). The object stands at the first stop; each later stop takes over as ITS section scrolls up the screen — `when` (default its anchor) from `start` to `end` viewport-heights (defaults 1 → 0), eased (`easing`, default "sineInOut"). Re-measured every frame, so it follows a card\'s hover tilt, a resize and the way back up. The child is a function of the pose {x, y, w, h, rotateX, rotateY, rotateZ, z, opacity, stop, t} — draw the object to fill w × h. Never draw a second copy at a stop: hide the flat picture at the stop it occupies (e.g. the selected card shows an empty slot). It takes no clicks unless `interactive`; `zIndex` (30), `perspective` (1200).',
        tags: ['travel', 'scroll', 'product', 'hero', 'card', 'anchor', 'journey'],
      },
      {
        name: 'MockySpace',
        signature: 'MockySpace.ring(angle, radius, y) · MockySpace.facing(from, to) · MockySpace.look(from, to)',
        description:
          'The arithmetic of a walk-through, in radians and world units: `ring` gives the point at an angle on a circle of the x–z plane (angle 0 is +x), `facing` the yaw that turns an object at `from` towards `to`, `look` the camera yaw that looks from `from` to `to`. Place every print with them instead of rewriting the trigonometry.',
        tags: ['3d', 'math', 'ring', 'camera'],
      },
    ],
  },
]

// Validate all snippet-packs at module load
for (const cap of CAPABILITIES) {
  if (cap.kind === 'snippet-pack' && cap.components && cap.snippets) {
    validatePack(cap.id, cap.components, cap.snippets)
  }
}

export const CAPABILITY_MAP: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
)