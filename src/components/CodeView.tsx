import { useState } from 'react'
import { Icon } from '../ui'
import { useT } from '../i18n'

export default function CodeView({ code }: { code: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-sunken">
      <button
        type="button"
        onClick={copy}
        className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border bg-raised px-2.5 py-1 text-body-sm font-medium transition ${
          copied
            ? 'border-accent text-accent-ink'
            : 'border-line-soft text-ink hover:border-accent hover:text-accent-ink'
        }`}
      >
        <Icon name={copied ? 'check' : 'copy'} size={15} />
        {copied ? t('common.copied') : t('common.copy')}
      </button>
      <pre className="min-h-full p-4 text-body-sm leading-relaxed text-ink">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
