import { useState } from 'react'
import { Button, Modal } from '../ui'
import { useT } from '../i18n'
import { FLOW_COUNT_MAX, MAX_COMPANIONS } from '../lib/flows'

/**
 * How many screens "Générer le parcours…" makes — asked BEFORE anything is
 * spent, since every screen is a full generation with the person's model. The
 * composer's own bound (`MAX_COMPANIONS`) is the default, so a person who just
 * presses Enter gets what Parcours has always made.
 */
export default function FlowCountDialog({
  screenName,
  onGenerate,
  onClose,
}: {
  screenName: string
  onGenerate: (count: number) => void
  onClose: () => void
}) {
  const t = useT()
  const [count, setCount] = useState(MAX_COMPANIONS)
  const counts = Array.from({ length: FLOW_COUNT_MAX }, (_, i) => i + 1)

  return (
    <Modal
      title={t('flows.countTitle', { name: screenName })}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onGenerate(count)}>
            {t('flows.countGo', { count })}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-body-sm text-ink-muted">{t('flows.countIntro')}</p>
      <div role="radiogroup" aria-label={t('flows.countLabel')} className="grid grid-cols-8 gap-1.5">
        {counts.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === count}
            onClick={() => setCount(n)}
            onDoubleClick={() => onGenerate(n)}
            className={`h-9 rounded-md border text-body-sm font-medium transition ${
              n === count ? 'border-accent bg-accent/15 text-ink' : 'border-line-soft text-ink-muted hover:border-accent hover:text-ink'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-3 text-caption text-ink-faint">{t('flows.countCost', { count })}</p>
    </Modal>
  )
}
