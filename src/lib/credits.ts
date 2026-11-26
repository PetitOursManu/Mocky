/**
 * The projects Mocky is built on, as the Settings page thanks them.
 *
 * Shown to the people who USE an instance, who never see the repository: the
 * licence notices themselves live in `NOTICE`, in `public/vendor/VENDOR.md` and
 * beside each vendored file, and this list is the readable side of them. The
 * documentation's page (`docs/credits.md`, and its French mirror) says the same
 * thing at length, and `credits.test.ts` holds the two together: a project
 * thanked here and missing there, or the reverse, fails the suite.
 *
 * What a project is FOR is a translation (`credits.use.<id>`); the name, the
 * address and the licence are not, because they are the project's own.
 */

export type CreditGroup = 'app' | 'video' | 'services'

export interface Credit {
  id: string
  name: string
  url: string
  /** As the project states it; `null` for a service, which is not software Mocky ships. */
  licence: string | null
  group: CreditGroup
}

export const CREDIT_GROUPS: CreditGroup[] = ['app', 'video', 'services']

export const CREDITS: Credit[] = [
  { id: 'react', name: 'React', url: 'https://react.dev', licence: 'MIT', group: 'app' },
  { id: 'babel', name: 'Babel', url: 'https://babeljs.io', licence: 'MIT', group: 'app' },
  { id: 'tailwind', name: 'Tailwind CSS', url: 'https://tailwindcss.com', licence: 'MIT', group: 'app' },
  { id: 'daisyui', name: 'daisyUI', url: 'https://daisyui.com', licence: 'MIT', group: 'app' },
  { id: 'motion', name: 'Motion', url: 'https://motion.dev', licence: 'MIT', group: 'app' },
  { id: 'three', name: 'three.js', url: 'https://threejs.org', licence: 'MIT', group: 'app' },
  { id: 'html2canvas', name: 'html2canvas', url: 'https://html2canvas.hertzen.com', licence: 'MIT', group: 'app' },
  { id: 'tegaki', name: 'Tegaki', url: 'https://github.com/gkurt/tegaki', licence: 'MIT', group: 'app' },
  { id: 'impeccable', name: 'impeccable', url: 'https://github.com/pbakaus/impeccable', licence: 'Apache-2.0', group: 'app' },
  { id: 'pdfjs', name: 'PDF.js', url: 'https://mozilla.github.io/pdf.js/', licence: 'Apache-2.0', group: 'app' },
  { id: 'pdflib', name: 'pdf-lib', url: 'https://pdf-lib.js.org', licence: 'MIT', group: 'app' },
  { id: 'agpsd', name: 'ag-psd', url: 'https://github.com/Agamnentzar/ag-psd', licence: 'MIT', group: 'app' },
  { id: 'fontsource', name: 'Fontsource', url: 'https://fontsource.org', licence: 'OFL-1.1 · Apache-2.0 · UFL-1.0', group: 'app' },
  { id: 'magicui', name: 'Magic UI', url: 'https://magicui.design', licence: 'MIT', group: 'app' },
  { id: 'feather', name: 'Feather', url: 'https://feathericons.com', licence: 'MIT', group: 'app' },
  { id: 'express', name: 'Express', url: 'https://expressjs.com', licence: 'MIT', group: 'app' },
  { id: 'mcp', name: 'Model Context Protocol SDK', url: 'https://modelcontextprotocol.io', licence: 'MIT', group: 'app' },
  { id: 'playwright', name: 'Playwright', url: 'https://playwright.dev', licence: 'Apache-2.0', group: 'app' },
  { id: 'zod', name: 'Zod', url: 'https://zod.dev', licence: 'MIT', group: 'app' },
  { id: 'lumy', name: 'Lumy', url: 'https://github.com/PetitOursManu/Lumy', licence: 'MIT', group: 'app' },

  { id: 'hyperframes', name: 'HyperFrames', url: 'https://github.com/heygen-com/hyperframes', licence: 'Apache-2.0', group: 'video' },
  { id: 'remotion', name: 'Remotion', url: 'https://www.remotion.dev', licence: 'Remotion', group: 'video' },
  { id: 'r3f', name: 'React Three Fiber', url: 'https://github.com/pmndrs/react-three-fiber', licence: 'MIT', group: 'video' },
  { id: 'lottie', name: 'lottie-web', url: 'https://github.com/airbnb/lottie-web', licence: 'MIT', group: 'video' },
  { id: 'useanimations', name: 'useAnimations', url: 'https://useanimations.com', licence: 'MIT', group: 'video' },
  { id: 'esbuild', name: 'esbuild', url: 'https://esbuild.github.io', licence: 'MIT', group: 'video' },
  { id: 'ffmpeg', name: 'FFmpeg', url: 'https://ffmpeg.org', licence: 'LGPL-2.1+', group: 'video' },
  { id: 'chromium', name: 'Chromium', url: 'https://www.chromium.org', licence: 'BSD-3-Clause', group: 'video' },

  { id: 'pexels', name: 'Pexels', url: 'https://www.pexels.com', licence: null, group: 'services' },
  { id: 'pixabay', name: 'Pixabay', url: 'https://pixabay.com', licence: null, group: 'services' },
]
