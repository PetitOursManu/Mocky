import { useState } from 'react'
import { Button, Field, Icon, Modal, Textarea } from '../ui'
import { BRIEF_MAX_LENGTH } from '../lib/video/client'
import { useT } from '../i18n'

/**
 * Ask what should change in a film already placed in a screen.
 *
 * It was `window.prompt`, which did the job and looked like the browser rather
 * than like Mocky: no house type, no room for the examples that make the answer
 * useful, and a one-line field for a sentence that is often longer. The question
 * is the whole dialog — the render that follows is watched on the screen itself,
 * where the badge already says what is happening.
 *
 * The examples are not decoration. A colour asked for without its role ("en
 * bleu") comes back as the same film, because which of ground and ink it means
 * is exactly the guess the theme reader refuses to make — so the hint says
 * "fond, texte ou accent" before the request is sent rather than after a
 * round trip.
 */
export default function MotionReviseDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (request: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [request, setRequest] = useState('')
  const ready = request.trim().length > 0

  const submit = () => {
    if (!ready) return
    onSubmit(request.trim())
  }

  return (
    <Modal
      title={t('project.motionReviseTitle')}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" disabled={!ready} onClick={submit}>
            <Icon name="sparkle" size={15} />
            {t('project.motionReviseSubmit')}
          </Button>
        </div>
      }
    >
      <p className="measure text-body text-ink-muted">{t('project.motionReviseBlurb')}</p>
      <Field className="mt-4" label={t('project.motionReviseLabel')} hint={t('project.motionReviseHint')}>
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            autoFocus
            value={request}
            maxLength={BRIEF_MAX_LENGTH}
            placeholder={t('project.motionRevisePlaceholder')}
            onChange={(e) => setRequest(e.currentTarget.value)}
            // Ctrl/Cmd+Enter sends, like the composer; a bare Enter is a new line
            // in a field that is meant to hold a sentence.
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                submit()
              }
            }}
          />
        )}
      </Field>
    </Modal>
  )
}
