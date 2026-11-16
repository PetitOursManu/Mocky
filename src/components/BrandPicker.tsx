import { Select } from '../ui'
import { useT } from '../i18n'

/**
 * Which of the account's brands a project is in (lib/brand.ts), shown under
 * the composer's "Marque" switch once the account has more than one. A project
 * naming a brand that was deleted shows that, rather than another brand it is
 * not in: `brandOfProject` gives such a project none.
 */
export default function BrandPicker({
  brands,
  value,
  onChange,
  className = '',
}: {
  brands: { id: string; name: string }[]
  value: string | undefined
  onChange: (id: string) => void
  className?: string
}) {
  const t = useT()
  const known = brands.some((b) => b.id === value)
  return (
    <Select
      className={`w-full text-body-sm ${className}`}
      aria-label={t('brand.pick')}
      value={known ? value : ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {!known && (
        <option value="" disabled>
          {t('brand.pickGone')}
        </option>
      )}
      {brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  )
}
