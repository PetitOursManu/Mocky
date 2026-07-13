import type { Capability } from './types'
import { MarqueeSource, MARQUEE_EXPORTS } from './snippets/Marquee'
import { ShimmerButtonSource, SHIMMER_BUTTON_EXPORTS } from './snippets/ShimmerButton'
import { BentoGridSource, BENTO_GRID_EXPORTS } from './snippets/BentoGrid'
import { AnimatedBeamSource, ANIMATED_BEAM_EXPORTS } from './snippets/AnimatedBeam'
import { NumberTickerSource, NUMBER_TICKER_EXPORTS } from './snippets/NumberTicker'
import { BorderBeamSource, BORDER_BEAM_EXPORTS } from './snippets/BorderBeam'
import { TextRevealSource, TEXT_REVEAL_EXPORTS } from './snippets/TextReveal'
import { MeteorsSource, METEORS_EXPORTS } from './snippets/Meteors'
import { ChartsSource, CHARTS_EXPORTS } from './snippets/Charts'
import { IconsSource, ICONS_EXPORTS } from './snippets/Icons'

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
      { name: 'Icon', signature: '<Icon.Home className="w-5 h-5" strokeWidth={1.5} />', description: 'Icon namespace with 26 icons: Home, Search, Bell, User, Settings, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check, Trash, Edit, Download, Upload, Calendar, Clock, Mail, Filter, Menu, MoreHorizontal, ArrowUp, ArrowDown, TrendingUp, TrendingDown, DollarSign. Usage: Icon.Search, Icon.Bell, etc. Accepts className, size, strokeWidth props.', tags: ['icon', 'svg'] },
    ],
  },
  {
    id: 'daisyui',
    kind: 'cdn-css',
    cdn: { url: 'https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.css' },
    triggers: {
      keywords: ['daisy', 'daisyui', 'semantic', 'btn', 'card component', 'modal component'],
      intents: ['semantic classes', 'component library'],
    },
  },
  {
    id: 'motion',
    kind: 'cdn-script',
    cdn: { url: 'https://unpkg.com/framer-motion@11.11.17/dist/framer-motion.js', global: 'Motion' },
    globals: ['motion', 'AnimatePresence', 'useAnimation', 'useMotionValue', 'useTransform', 'useInView'],
    triggers: {
      keywords: ['animate', 'animation', 'motion', 'framer', 'transition', 'spring', 'animatepresence'],
      intents: ['animation', 'interactive', 'playful', 'dynamic'],
    },
  },
  {
    id: 'lucide',
    kind: 'cdn-script',
    cdn: { url: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', global: 'lucide' },
    globals: ['lucide', 'createIcons'],
    triggers: {
      keywords: ['icon', 'icons', 'lucide', 'pictogram'],
      intents: ['icons'],
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
    id: 'magicui',
    kind: 'snippet-pack',
    requires: ['motion'],
    triggers: {
      keywords: ['marquee', 'shimmer', 'bento grid', 'animated beam', 'number ticker', 'border beam', 'text reveal', 'meteors', 'magic ui', 'magicui'],
      intents: ['animation', 'playful', 'dynamic', 'showcase', 'landing page', 'hero'],
    },
    snippets: [
      { source: MarqueeSource, exports: [...MARQUEE_EXPORTS] },
      { source: ShimmerButtonSource, exports: [...SHIMMER_BUTTON_EXPORTS] },
      { source: BentoGridSource, exports: [...BENTO_GRID_EXPORTS] },
      { source: AnimatedBeamSource, exports: [...ANIMATED_BEAM_EXPORTS] },
      { source: NumberTickerSource, exports: [...NUMBER_TICKER_EXPORTS] },
      { source: BorderBeamSource, exports: [...BORDER_BEAM_EXPORTS] },
      { source: TextRevealSource, exports: [...TEXT_REVEAL_EXPORTS] },
      { source: MeteorsSource, exports: [...METEORS_EXPORTS] },
    ],
    components: [
      { name: 'Marquee', signature: '<Marquee pauseOnHover reverse repeat={4}>{children}</Marquee>', description: 'A scrolling marquee that infinitely loops content horizontally.', tags: ['scroll', 'loop', 'carousel'] },
      { name: 'ShimmerButton', signature: '<ShimmerButton shimmerColor="#ffffff" shimmerDuration="3s">{children}</ShimmerButton>', description: 'A button with a shimmering light effect sweeping across it.', tags: ['button', 'cta', 'shine', 'glow'] },
      { name: 'BentoGrid', signature: '<BentoGrid><BentoCard name="..." description="..." /></BentoGrid>', description: 'A modular bento-style grid layout with cards.', tags: ['grid', 'bento', 'layout', 'cards'] },
      { name: 'BentoCard', signature: '<BentoCard name="..." description="..." />', description: 'A card component for use inside BentoGrid.', tags: ['card', 'bento'] },
      { name: 'AnimatedBeam', signature: '<AnimatedBeam className="..." />', description: 'An SVG beam with an animated particle travelling along a path.', tags: ['beam', 'svg', 'connection', 'flow'] },
      { name: 'NumberTicker', signature: '<NumberTicker value={1000} />', description: 'Animates a number counting up when scrolled into view.', tags: ['counter', 'number', 'stat', 'count'] },
      { name: 'BorderBeam', signature: '<BorderBeam size={200} duration={15} colorFrom="#ff0028" colorTo="#ffaa00" />', description: 'A rotating gradient beam travelling along the border of a container.', tags: ['border', 'beam', 'glow', 'accent'] },
      { name: 'TextReveal', signature: '<TextReveal text="Your text here" />', description: 'Reveals words one by one when scrolled into view.', tags: ['text', 'reveal', 'animation', 'scroll'] },
      { name: 'Meteors', signature: '<Meteors number={20} />', description: 'Animated meteor shower effect for dark backgrounds.', tags: ['meteors', 'stars', 'dark', 'background'] },
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