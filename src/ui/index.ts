/**
 * Mocky's UI primitives.
 *
 * Import from here, not from the individual files:
 *   import { Button, Modal, Field } from '../ui'
 *
 * The rule these exist to enforce: a component describes *what* a control is,
 * never what colour it is. Every colour lives in src/styles/tokens.css and is
 * reached through the semantic Tailwind names (`bg-surface`, `text-ink-muted`,
 * `border-line`). A raw palette class — `bg-slate-800`, `text-indigo-400` — is a
 * bug: it will not follow the theme, which is exactly how 83 of the app's 109
 * colour classes ended up unthemed.
 */
export { Icon } from './Icon'
export { MockyLoader } from './MockyLoader'
export type { IconName, IconProps } from './Icon'
export { Button, ButtonLink, IconButton } from './Button'
export type { ButtonProps, ButtonLinkProps, ButtonVariant, ButtonSize } from './Button'
export { Field, Input, Textarea, Select } from './Field'
export { Modal } from './Modal'
export { Banner, Spinner, Skeleton, ScreenSkeleton, EmptyState } from './Feedback'
export { Chip, Segmented } from './Chip'
export { Panel, PanelRow } from './Panel'
