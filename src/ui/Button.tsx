import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The one button.
 *
 * There were 107 `<button>` elements in the app; 14 used `.btn-primary`, 20
 * used `.btn-ghost`, and the remaining 73 wrote their own classes inline. That
 * is why hover states, heights, paddings and focus rings never agreed — and why
 * the active toolbar button ended up as white text on a background that becomes
 * pale in the light theme, at a contrast ratio of 1.2:1.
 *
 * Every variant here clears 4.5:1 in both themes, and every one is at least
 * 32px tall so it can actually be hit with a trackpad.
 *
 * A finger is not a trackpad, and 32px does not survive the trip: on a 390px
 * phone, 12 of the 14 focusable elements on the home route measured under 44px.
 * `tap-target` — the last block of index.css — lifts the floor to 44px when the
 * primary pointer is coarse, and does nothing otherwise. It is an addition to
 * the 32px rule rather than a replacement for it: the trackpad number still
 * governs every mouse, at every window width.
 */

export type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger' | 'toolbar'
export type ButtonSize = 'sm' | 'md'

// `tap-target` sits in BASE rather than in SIZES because the floor is not a
// size: `sm` and `md` still differ by 32 vs 36 on a mouse, and both land on the
// same 44 under a finger.
const BASE =
  'tap-target inline-flex items-center justify-center gap-1.5 font-medium transition select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  // The single signature flat. One per screen, on the action that matters.
  primary: 'border border-accent bg-accent text-on-accent hover:opacity-90',
  // The default: an outlined rule, which is the editorial device.
  ghost: 'border border-line-soft text-ink hover:border-line',
  // No rule at all — for tertiary actions that must not add to the grid.
  quiet: 'border border-transparent text-ink-muted hover:text-ink hover:border-line-soft',
  danger: 'border border-danger bg-danger text-on-danger hover:opacity-90',
  // Canvas toolbar. `active` inverts it rather than tinting it, so the state is
  // unmistakable in both themes.
  toolbar: 'border border-transparent text-ink-muted hover:text-ink hover:border-line-soft',
}

const ACTIVE: Record<ButtonVariant, string> = {
  primary: '',
  ghost: 'border-accent bg-ink text-surface hover:opacity-90',
  quiet: 'border-accent bg-ink text-surface',
  danger: '',
  toolbar: 'border-accent bg-ink text-surface hover:opacity-90',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 py-1 text-body-sm',
  md: 'min-h-9 px-4 py-1.5 text-body-sm',
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Renders the pressed/selected state and sets aria-pressed. */
  active?: boolean
  /** Escape hatch for layout only (width, margin, order) — never for colour. */
  className?: string
  children?: ReactNode
}

export function Button({
  variant = 'ghost',
  size = 'md',
  active = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const look = active && ACTIVE[variant] ? `${VARIANTS[variant]} ${ACTIVE[variant]}` : VARIANTS[variant]
  return (
    <button
      type={type}
      aria-pressed={active || undefined}
      className={`${BASE} ${look} ${SIZES[size]} ${className}`}
      {...rest}
    />
  )
}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  /** Escape hatch for layout only (width, margin, order) — never for colour. */
  className?: string
  children?: ReactNode
}

/**
 * A link that looks like a button.
 *
 * A real `<a>`, not a `<button>` with an `onClick` that calls `window.open`.
 * That distinction is not pedantry: a link can be middle-clicked, opened in a
 * background tab, copied, or dragged to the bookmarks bar, and a screen reader
 * announces it as a link rather than as a control that does something unstated.
 *
 * It shares the class composition above rather than restating it, so a change
 * to a variant reaches both.
 */
export function ButtonLink({
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />
  )
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  /**
   * Required. Six icon-only buttons in the app had no accessible name at all —
   * including "delete this image" and "delete this project", which a screen
   * reader announced as nothing but "button".
   */
  label: string
  children: ReactNode
  size?: ButtonSize
}

export function IconButton({ label, className = '', size = 'sm', ...rest }: IconButtonProps) {
  return (
    <Button
      {...rest}
      size={size}
      aria-label={label}
      title={rest.title ?? label}
      // Square, and never below the 32px touch target. `w-8` is a fixed width,
      // so the height floor in BASE cannot widen it on its own — an icon button
      // would end up 44 tall and 32 wide. `tap-target-square` supplies the
      // other axis, under a coarse pointer only.
      className={`tap-target-square w-8 shrink-0 !px-0 ${className}`}
    />
  )
}
