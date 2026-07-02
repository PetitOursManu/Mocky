import type { Project } from '../lib/project'

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function ProjectsHome({
  projects,
  onOpen,
  onCreate,
  onDelete,
}: {
  projects: Project[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Projects</h2>
          <p className="text-sm text-slate-400">
            {projects.length === 0
              ? 'Create a project to start designing screens.'
              : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onCreate}>
          + New project
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 text-slate-400 transition hover:border-indigo-500/60 hover:text-indigo-300"
        >
          <span className="text-3xl leading-none">+</span>
          <span className="text-sm font-medium">New project</span>
        </button>

        {projects.map((p) => (
          <div
            key={p.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50 transition hover:border-slate-600"
          >
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className="block w-full text-left"
            >
              <div className="flex h-28 items-center justify-center gap-2 border-b border-slate-700/70 bg-slate-900/40 p-3">
                {p.screens.length === 0 ? (
                  <span className="text-xs text-slate-500">Empty — no screens yet</span>
                ) : (
                  p.screens.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="flex h-20 w-16 items-center justify-center rounded-md border border-slate-700 bg-slate-800 p-1 text-center text-[8px] leading-tight text-slate-400"
                      title={s.name}
                    >
                      {s.componentName}
                    </div>
                  ))
                )}
              </div>
              <div className="p-4">
                <div className="truncate font-medium text-slate-100">{p.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {p.screens.length} screen{p.screens.length === 1 ? '' : 's'} · updated {timeAgo(p.updatedAt)}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete project "${p.name}" and its ${p.screens.length} screen(s)?`))
                  onDelete(p.id)
              }}
              className="absolute right-2 top-2 rounded-md border border-slate-600 bg-slate-900/80 px-2 py-1 text-xs text-rose-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-900/40"
              title="Delete project"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
