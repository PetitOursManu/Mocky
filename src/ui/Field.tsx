import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

/**
 * Form controls, with the label wired to the input by construction.
 *
 * Labels in the app were plain `<label>` elements with no `htmlFor`, sitting
 * next to inputs with no `id` — so clicking a label did nothing and a screen
 * reader announced the field as unnamed. Field generates the id and passes it
 * down, which makes the correct thing the only thing.
 */

// The focus ring is spelled out for the same reason as in `.input`:
// `outline-none` compiles to a transparent 2px outline at class specificity,
// which silently beats the zero-specificity `:where()` rule in @layer base. A
// control that opts out of the default ring has to bring its own back.
const CONTROL =
  'w-full border border-line-soft bg-surface px-3 py-2 text-body text-ink ' +
  'placeholder:text-ink-faint outline-none transition hover:border-line focus:border-accent ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  /** Receives the generated id — spread it onto the control. */
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-body-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, 'aria-describedby': hintId, 'aria-invalid': error ? true : undefined })}
      {(hint || error) && (
        <p id={hintId} className={`mt-1.5 text-caption ${error ? 'text-danger' : 'text-ink-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} resize-none ${className}`} {...rest} />
}

export function Select({
  className = '',
  children,
  ...rest
}: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={`${CONTROL} ${className}`} {...rest}>
      {children}
    </select>
  )
}
