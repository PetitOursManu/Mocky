import { useState } from 'react'
import { Button, Checkbox, Modal, Textarea } from '../ui'
import { useT } from '../i18n'
import { RULES_MAX, ruleList } from '../lib/rules'

const OFFER_OFF_KEY = 'mocky.ruleOffer.off'

/** Whether Mocky offers to keep a correction as a rule (per browser, like the canvas's own preferences). */
export function ruleOfferOn(): boolean {
  try {
    return localStorage.getItem(OFFER_OFF_KEY) !== '1'
  } catch {
    return true
  }
}

export function setRuleOfferOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OFFER_OFF_KEY)
    else localStorage.setItem(OFFER_OFF_KEY, '1')
  } catch {
    /* a blocked storage keeps the default: offered */
  }
}

/**
 * The project's rules (lib/rules.ts), from the composer's "Règles" row: the
 * project's own, editable here, and the brand's beside them, read-only —
 * a brand's rules are edited in Settings, where they hold for every project.
 */
export default function RulesDialog({
  rules,
  brandName,
  brandRules,
  onSave,
  onClose,
}: {
  rules: string | undefined
  brandName?: string
  brandRules?: string
  onSave: (rules: string | undefined) => void
  onClose: () => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(rules ?? '')
  const [offer, setOffer] = useState(ruleOfferOn)
  const fromBrand = ruleList(brandRules)
  return (
    <Modal
      title={t('rules.title')}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setRuleOfferOn(offer)
              onSave(draft.trim() ? draft : undefined)
              onClose()
            }}
          >
            {t('rules.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-body-sm text-ink-muted">{t('rules.help')}</p>
      <label className="kicker mb-1 block" htmlFor="mocky-project-rules">
        {t('rules.project')}
      </label>
      <Textarea
        id="mocky-project-rules"
        rows={6}
        maxLength={RULES_MAX}
        className="w-full"
        value={draft}
        placeholder={t('rules.placeholder')}
        onChange={(e) => setDraft(e.target.value)}
      />
      {brandName && (
        <div className="mt-4">
          <span className="kicker mb-1 block">{t('rules.brand', { name: brandName })}</span>
          {fromBrand.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-body-sm text-ink">
              {fromBrand.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ink-faint">{t('rules.brandNone')}</p>
          )}
          <p className="mt-1 text-caption text-ink-faint">{t('rules.brandWhere')}</p>
        </div>
      )}
      <div className="mt-4">
        <Checkbox checked={offer} onChange={setOffer}>
          {t('rules.offerToggle')}
        </Checkbox>
      </div>
    </Modal>
  )
}
