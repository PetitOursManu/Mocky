import { useState } from 'react'
import { loadChimeEnabled, playChime, saveChimeEnabled } from '../lib/chime'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'

/**
 * The end-of-generation chime's switch, in the personal settings.
 *
 * Its own component so the settings panel gains one line: the provider form in
 * that file is being reworked in parallel, and a self-contained block merges
 * where an interleaved one would not.
 *
 * "Test" plays the success phrase whatever the switch says (see `playChime`'s
 * `force`), and says so when the browser refused — the only moment anyone is
 * listening for a failure of this feature.
 */
export default function ChimeSetting() {
  const t = useT()
  const [on, setOn] = useState(() => loadChimeEnabled())
  const [unavailable, setUnavailable] = useState(false)

  return (
    <section>
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('chime.heading')}</span>
      </div>
      <div className="flex flex-wrap items-start gap-3 border border-line-soft bg-ink/5 p-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-accent"
            checked={on}
            onChange={(e) => {
              setOn(e.target.checked)
              saveChimeEnabled(e.target.checked)
            }}
          />
          <span>
            <span className="block text-body font-medium text-ink">{t('chime.toggle')}</span>
            <span className="measure mt-0.5 block text-body-sm text-ink-muted">{t('chime.help')}</span>
          </span>
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => setUnavailable(!(await playChime('done', { force: true })))}
        >
          <Icon name="play" size={14} />
          {t('chime.test')}
        </Button>
      </div>
      {/* Always mounted, only its text toggles: a live region that appears
          together with its message is not announced by most screen readers,
          and whoever pressed "Test" without hearing anything needs the line. */}
      <p role="status" className={unavailable ? 'mt-2 text-body-sm text-ink-muted' : 'sr-only'}>
        {unavailable ? t('chime.unavailable') : ''}
      </p>
    </section>
  )
}
