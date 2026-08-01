import type { Capability } from './types'
import { ChartsSource, CHARTS_EXPORTS } from './snippets/Charts'
import { IconsSource, ICONS_EXPORTS } from './snippets/Icons'
import { MotionSource, MOTION_EXPORTS } from './snippets/Motion'
import { ScrollVideoSource, SCROLLVIDEO_EXPORTS } from './snippets/ScrollVideo'
import { AnimateSource, ANIMATE_EXPORTS } from './snippets/Animate'

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
      { name: 'Icon', signature: '<Icon.Home className="w-5 h-5" strokeWidth={1.5} />', description: 'Icon is a PRE-DEFINED global namespace. Interface icons: Home, Search, Bell, User, Settings, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check, Trash, Edit, Download, Upload, Calendar, Clock, Mail, Filter, Menu, MoreHorizontal, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, TrendingUp, TrendingDown, DollarSign, Eye, EyeOff, Lock, Heart, Star. Social/brand + contact (for footers & landing pages): Twitter, Github, Linkedin, Facebook, Instagram, Youtube, Globe, Phone, MapPin. Usage: <Icon.Search />, <Icon.Twitter />, etc. Accepts className, size, strokeWidth props. ONLY these names exist — any other name (e.g. Icon.Dribbble, Icon.Slack) is undefined and crashes with React #130, so use the closest listed icon or Icon.Globe instead. NEVER declare your own `const Icon`/`var Icon` — it already exists and redeclaring it is a fatal error. For a DYNAMIC icon (e.g. from a list item), assign it to a Capitalized variable first — const Ico = Icon[item.icon] || Icon.MoreHorizontal; <Ico className="w-6 h-6" /> — never <Icon[item.icon] /> (that is invalid JSX).', tags: ['icon', 'svg'] },
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
     * The closed animation vocabulary. Six presets, one component, and no way
     * for the model to reach Motion's own API — see snippets/Animate.ts.
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
        signature: '<Animated preset="fade-up" delay={0.1} as="section" className="…">{children}</Animated>',
        description:
          'Wraps any block to animate it. `preset` is REQUIRED and must be exactly one of: "fade-in" (opacity), "fade-up" (opacity + rise), "scale-in" (spring pop), "stagger-list" (children appear one after another — put it on the LIST, not on each item), "hover-lift" (lifts under the cursor, no entrance), "exit-slide" (slides in, and out when removed). `delay` is in seconds, 0–2. `as` picks the tag, default "div". Any other preset name renders a plain, unanimated element — never invent one.',
        tags: ['animation', 'motion', 'entrance', 'hover', 'stagger', 'reveal'],
      },
    ],
  },
  {
    // Never selected by keywords, and that is deliberate: the component is
    // useless without a `base` and a `frames` count, which only exist once Muse
    // has actually paid for a clip. It is force-added at generation time when
    // one was produced (see ProjectView), never guessed from the prompt — a
    // screen offered <ScrollSequence> with nothing to show would render a black
    // box the size of three viewports.
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