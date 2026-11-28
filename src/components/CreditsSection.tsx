import { CREDITS, CREDIT_GROUPS } from '../lib/credits'
import { docsPage } from '../lib/docsUrl'
import { useLang, useT, type TranslationKey } from '../i18n'

/**
 * The thanks at the foot of the Settings page: every project Mocky is built on,
 * what it is for, and its licence, with the documentation's longer page one
 * click away.
 *
 * On Settings rather than behind an "About" route, because Settings is the one
 * page every account can open, and a list nobody can reach thanks nobody.
 */
export default function CreditsSection() {
  const t = useT()
  const [lang] = useLang()
  return (
    <section className="mt-8 border-t border-line pt-8" aria-labelledby="credits-title">
      <div className="section-head">
        <span id="credits-title" className="kicker">
          {t('credits.title')}
        </span>
      </div>
      <p className="measure mb-4 text-body text-ink-muted">
        {t('credits.intro')}{' '}
        <a
          href={docsPage('credits', lang)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          {t('credits.more')}
        </a>
      </p>
      <div className="grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-3">
        {CREDIT_GROUPS.map((group) => (
          <div key={group}>
            <h3 className="mb-2 text-body font-medium text-ink">{t(`credits.group.${group}` as TranslationKey)}</h3>
            <ul className="space-y-1.5">
              {CREDITS.filter((c) => c.group === group).map((credit) => (
                <li key={credit.id} className="text-body-sm">
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {credit.name}
                  </a>
                  <span className="text-ink-muted"> — {t(`credits.use.${credit.id}` as TranslationKey)}</span>
                  {credit.licence && (
                    <span className="text-ink-faint"> · {t('credits.licence', { licence: credit.licence })}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
