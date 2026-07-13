import type { Capability } from './types'
import { MarqueeSource } from './snippets/Marquee'
import { ShimmerButtonSource } from './snippets/ShimmerButton'
import { BentoGridSource } from './snippets/BentoGrid'
import { AnimatedBeamSource } from './snippets/AnimatedBeam'
import { NumberTickerSource } from './snippets/NumberTicker'
import { BorderBeamSource } from './snippets/BorderBeam'
import { TextRevealSource } from './snippets/TextReveal'
import { MeteorsSource } from './snippets/Meteors'

export const CAPABILITIES: Capability[] = [
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
    globals: ['motion', 'AnimatePresence', 'useAnimation', 'useMotionValue', 'useTransform', 'useInView', 'AnimatePresence'],
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
    id: 'recharts',
    kind: 'cdn-script',
    cdn: { url: 'https://unpkg.com/recharts@2.13.3/dist/Recharts.min.js', global: 'Recharts' },
    globals: ['ResponsiveContainer', 'PieChart', 'Pie', 'Cell', 'BarChart', 'Bar', 'LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend', 'AreaChart', 'Area', 'RadialBarChart', 'RadialBar', 'ComposedChart', 'ScatterChart', 'Scatter'],
    triggers: {
      keywords: ['chart', 'recharts', 'graph', 'bar chart', 'line chart', 'pie chart', 'area chart', 'data visualization'],
      intents: ['chart', 'dashboard', 'analytics', 'graph', 'data'],
    },
  },
  {
    id: 'magicui',
    kind: 'snippet-pack',
    requires: ['motion'],
    triggers: {
      keywords: ['marquee', 'shimmer', 'bento grid', 'animated beam', 'number ticker', 'border beam', 'text reveal', 'meteors', 'magic ui', 'magicui'],
      intents: ['animation', 'playful', 'dynamic', 'showcase', 'landing page', 'hero'],
    },
    components: [
      {
        name: 'Marquee',
        signature: '<Marquee pauseOnHover reverse repeat={4}>{children}</Marquee>',
        description: 'A scrolling marquee that infinitely loops content horizontally.',
        tags: ['scroll', 'loop', 'carousel'],
        source: MarqueeSource,
      },
      {
        name: 'ShimmerButton',
        signature: '<ShimmerButton shimmerColor="#ffffff" shimmerDuration="3s">{children}</ShimmerButton>',
        description: 'A button with a shimmering light effect sweeping across it.',
        tags: ['button', 'cta', 'shine', 'glow'],
        source: ShimmerButtonSource,
      },
      {
        name: 'BentoGrid',
        signature: '<BentoGrid><BentoCard name="..." description="..." /></BentoGrid>',
        description: 'A modular bento-style grid layout with cards.',
        tags: ['grid', 'bento', 'layout', 'cards'],
        source: BentoGridSource,
      },
      {
        name: 'AnimatedBeam',
        signature: '<AnimatedBeam className="..." />',
        description: 'An SVG beam with an animated particle travelling along a path.',
        tags: ['beam', 'svg', 'connection', 'flow'],
        source: AnimatedBeamSource,
      },
      {
        name: 'NumberTicker',
        signature: '<NumberTicker value={1000} />',
        description: 'Animates a number counting up when scrolled into view.',
        tags: ['counter', 'number', 'stat', 'count'],
        source: NumberTickerSource,
      },
      {
        name: 'BorderBeam',
        signature: '<BorderBeam size={200} duration={15} colorFrom="#ff0028" colorTo="#ffaa00" />',
        description: 'A rotating gradient beam travelling along the border of a container.',
        tags: ['border', 'beam', 'glow', 'accent'],
        source: BorderBeamSource,
      },
      {
        name: 'TextReveal',
        signature: '<TextReveal text="Your text here" />',
        description: 'Reveals words one by one when scrolled into view.',
        tags: ['text', 'reveal', 'animation', 'scroll'],
        source: TextRevealSource,
      },
      {
        name: 'Meteors',
        signature: '<Meteors number={20} />',
        description: 'Animated meteor shower effect for dark backgrounds.',
        tags: ['meteors', 'stars', 'dark', 'background'],
        source: MeteorsSource,
      },
    ],
  },
]

export const CAPABILITY_MAP: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
)