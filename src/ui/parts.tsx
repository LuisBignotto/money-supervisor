export const tone = (d: { isNegative(): boolean } | null) => (!d ? 'text-slate-400' : d.isNegative() ? 'text-red-600' : 'text-emerald-600')

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {hint && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** ⓘ com explicação ao passar o mouse ou focar (teclado). Toda box nova deve ter um. */
export function Info({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button type="button" aria-label={`O que é: ${text}`} className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold leading-none ${light ? 'border-white/60 text-white/80' : 'border-slate-300 text-slate-400 hover:text-slate-600'}`}>
        i
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-7 z-20 hidden w-72 rounded-lg bg-slate-900 p-3 text-sm font-normal normal-case leading-relaxed text-white shadow-lg group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
  )
}

export function Card({ label, info, sub, children, className = '' }: { label: string; info: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Info text={info} />
      </div>
      <p className={`mt-3 text-3xl font-semibold tabular-nums tracking-tight ${className}`}>{children}</p>
      {sub && <p className="mt-2 text-sm leading-snug text-slate-500">{sub}</p>}
    </div>
  )
}
