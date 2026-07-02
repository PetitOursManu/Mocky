import { PRESETS } from '../lib/presets'

export default function PresetPicker({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {PRESETS.map((p) => {
        const active = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              active
                ? 'border-indigo-500 bg-indigo-500 text-white'
                : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
            title={`${p.label} · ${p.w}×${p.h}`}
          >
            {p.badge}
          </button>
        )
      })}
    </div>
  )
}
