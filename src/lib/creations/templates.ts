import type { Keyframe } from './check'

/**
 * The code around a creation that is only data.
 *
 * Written here, once, so the three things a hand-written animation forgets are
 * always done: it holds still under `prefers-reduced-motion`, on a screen with
 * "Sans animation", and in the capture shell (`__mockyStill`, U2). Each input has
 * been through `check.ts`, whose value grammar has no quote, brace or semicolon,
 * so nothing here can close the rule it is written into.
 */

const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

const toCss = (style: Record<string, string>) =>
  Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')

const classOf = (name: string) => `mk-${name.toLowerCase()}`

export function frameSource(name: string, path: string, ratio: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}"/></svg>`
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return `function ${name}({ src, alt = '', className = '', style, focus = 'center', children }) {
  const mask = ${JSON.stringify(mask)};
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', aspectRatio: ${JSON.stringify(String(ratio))}, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', ...style }}>
      {src ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus, display: 'block' }} /> : children}
    </div>
  );
}`
}

export const frameUsage = (name: string) => `<${name} src="${TRANSPARENT}" alt="" className="w-48" />`

export function animationSource(
  name: string,
  steps: Keyframe[],
  duration: number,
  easing: string,
  iterations: number | 'infinite',
): string {
  const cls = classOf(name)
  const frames = steps.map((s) => `${s.at}%{${toCss(s.style)}}`).join('')
  const css = `@keyframes ${cls}{${frames}}.${cls}{animation:${cls} ${duration}ms ${easing} ${iterations} both}@media (prefers-reduced-motion: reduce){.${cls}{animation:none}}`
  return `function ${name}({ children, className = '', style, delay = 0, as: Tag = 'div' }) {
  const still = window.__mockyAnimations === false || window.__mockyStill;
  return (
    <Tag className={(still ? '' : ${JSON.stringify(`${cls} `)}) + className} style={still ? style : { animationDelay: delay + 'ms', ...style }}>
      {!still && <style>{${JSON.stringify(css)}}</style>}
      {children}
    </Tag>
  );
}`
}

export function transitionSource(
  name: string,
  rest: Record<string, string>,
  active: Record<string, string>,
  duration: number,
  easing: string,
): string {
  const cls = classOf(name)
  const props = [...new Set([...Object.keys(rest), ...Object.keys(active)])]
  const timing = props.map((p) => `${p} ${duration}ms ${easing}`).join(',')
  const css = `.${cls}{${toCss(rest)};transition:${timing}}.${cls}:hover,.${cls}:focus-visible{${toCss(active)}}@media (prefers-reduced-motion: reduce){.${cls}{transition:none}}`
  return `function ${name}({ children, className = '', style, as: Tag = 'div', ...rest }) {
  const still = window.__mockyAnimations === false || window.__mockyStill;
  return (
    <Tag className={(still ? '' : ${JSON.stringify(`${cls} `)}) + className} style={style} {...rest}>
      {!still && <style>{${JSON.stringify(css)}}</style>}
      {children}
    </Tag>
  );
}`
}

export const wrapperUsage = (name: string) => `<${name}>Aperçu</${name}>`
