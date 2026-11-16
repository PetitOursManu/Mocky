import { useState } from 'react'
import { Button, Icon, Modal, Select } from '../ui'
import { useLang, useT } from '../i18n'
import { LANG_NAMES, TRANSLATE_LANGS, type TranslateLang } from '../lib/translate'

/**
 * "Traduire…" from a screen's menu: pick a language, get a translated COPY
 * beside the screen (lib/translate.ts says why a copy and why the model never
 * sees the code). The default is the interface's other language, which is the
 * one somebody working in Mocky in French most often needs.
 */
export default function TranslateDialog({
  screenName,
  onTranslate,
  onClose,
}: {
  screenName: string
  onTranslate: (lang: TranslateLang) => void
  onClose: () => void
}) {
  const t = useT()
  const [ui] = useLang()
  const [lang, setLang] = useState<TranslateLang>(ui === 'fr' ? 'en' : 'fr')
  return (
    <Modal
      title={t('translate.title', { name: screenName })}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onTranslate(lang)
              onClose()
            }}
          >
            <Icon name="translate" size={16} />
            {t('translate.go')}
          </Button>
        </>
      }
    >
      <label className="block text-body-sm text-ink-muted" htmlFor="mocky-translate-lang">
        {t('translate.into')}
      </label>
      <Select
        id="mocky-translate-lang"
        className="mt-1.5 w-full"
        value={lang}
        onChange={(e) => setLang((e.target as HTMLSelectElement).value as TranslateLang)}
      >
        {TRANSLATE_LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </Select>
      <p className="mt-3 text-caption text-ink-faint">{t('translate.how')}</p>
    </Modal>
  )
}
