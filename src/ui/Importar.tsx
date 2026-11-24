import { useRef, useState } from 'react'
import { importFile } from '../import/importFile'

interface Line {
  name: string
  ok: boolean
  text: string
}

export default function Importar({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function run(files: FileList | File[]) {
    setBusy(true)
    const out: Line[] = []
    for (const f of Array.from(files)) {
      try {
        const r = await importFile(f)
        out.push({ name: f.name, ok: true, text: `${r.label}: ${r.added} novos, ${r.existing} já existentes` })
      } catch (e) {
        out.push({ name: f.name, ok: false, text: e instanceof Error ? e.message : String(e) })
      }
    }
    setLines(out)
    setBusy(false)
    onDone()
  }

  return (
    <div className="space-y-6">
      <div
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void run(e.dataTransfer.files) }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-12 text-center transition ${
          over ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <span className="text-4xl">📥</span>
        <p className="font-medium text-slate-800">{busy ? 'Importando…' : 'Solte os arquivos da B3 aqui'}</p>
        <p className="text-sm text-slate-500">ou clique para escolher — negociacao-…, movimentacao-… e posicao-… (.xlsx)</p>
        <input ref={input} type="file" multiple accept=".xlsx" hidden onChange={(e) => e.target.files && void run(e.target.files)} />
      </div>

      {lines.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {lines.map((l) => (
            <li key={l.name} className="flex items-start gap-3 p-4">
              <span>{l.ok ? '✅' : '❌'}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{l.name}</p>
                <p className={`text-sm ${l.ok ? 'text-slate-500' : 'text-red-600'}`}>{l.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-slate-500">
        Pode reimportar períodos que se sobrepõem: registros já existentes são reconhecidos e nada é duplicado nem apagado.
      </p>
    </div>
  )
}
