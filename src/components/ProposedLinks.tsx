import { useState } from 'react'
import { headline, type Screen } from '../lib/project'
import type { LinkCandidate } from '../lib/autolink'
import { Button, Icon, Modal } from '../ui'
import { useT } from '../i18n'

/**
 * Review sheet for automatically-found links.
 *
 * Nothing has been written when this opens, and that is the design rather than
 * caution: `Hotspot` carries no provenance, so a machine-made link would be
 * indistinguishable from one the user drew — in a panel whose only affordance is
 * one delete button per row. A wrong hotspot also does not error; it sends the
 * demo to the wrong screen, in front of whoever is being shown it. So the user
 * confirms, and everything starts ticked because the list has already been
 * filtered down to what cleared the confidence floor.
 *
 * The reason for each guess is shown, not hidden behind a score. "Because the
 * link said /tarifs" is checkable at a glance; "0.9" is not.
 */
export default function ProposedLinks({
  items,
  screens,
  onApply,
  onClose,
}: {
  items: LinkCandidate[]
  screens: Screen[]
  onApply: (accepted: LinkCandidate[]) => void
  onClose: () => void
}) {
  const t = useT()
  const [dropped, setDropped] = useState<Set<string>>(new Set())

  const nameOf = (id: string) => {
    const s = screens.find((x) => x.id === id)
    return s ? headline(s.name) : id
  }

  const toggle = (selector: string) =>
    setDropped((prev) => {
      const next = new Set(prev)
      if (next.has(selector)) next.delete(selector)
      else next.add(selector)
      return next
    })

  const kept = items.filter((c) => !dropped.has(c.selector))

  return (
    <Modal
      title={t('project.autoLinkTitle')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={kept.length === 0} onClick={() => onApply(kept)}>
            {kept.length === 1
              ? t('project.autoLinkApplyOne')
              : t('project.autoLinkApply', { count: kept.length })}
          </Button>
        </>
      }
    >
      {items.length === 0 ? (
        <div>
          <p className="measure text-body text-ink">{t('project.autoLinkNone')}</p>
          {/* Saying WHY nothing was found is the difference between "the feature
              is broken" and "there was nothing to go on here". */}
          <p className="measure mt-2 text-body-sm text-ink-muted">{t('project.autoLinkNoneWhy')}</p>
        </div>
      ) : (
        <>
          <p className="measure text-body-sm text-ink-muted">{t('project.autoLinkBlurb')}</p>
          <ul className="mt-4 border border-line-soft">
            {items.map((c) => {
              const on = !dropped.has(c.selector)
              return (
                <li key={c.selector} className="border-b border-line-soft last:border-b-0">
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(c.selector)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
                        on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-transparent'
                      }`}
                    >
                      <Icon name="check" size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm text-ink">
                        <span className="font-medium">{c.label || t('project.autoLinkUnnamed')}</span>
                        <span className="text-ink-faint"> → </span>
                        <span className="font-medium">{nameOf(c.target)}</span>
                      </span>
                      <span className="mt-0.5 block font-mono text-caption text-ink-faint">
                        {t(
                          c.why === 'href'
                            ? 'project.autoLinkWhyHref'
                            : c.why === 'prompt'
                              ? 'project.autoLinkWhyPrompt'
                              : 'project.autoLinkWhyContent',
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Modal>
  )
}
