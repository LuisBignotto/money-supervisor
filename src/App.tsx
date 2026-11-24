import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildEvolution, pricePoints } from './domain/evolution'
import { buildPortfolio } from './domain/portfolio'
import { computePositions } from './domain/positions'
import { buildReturns } from './domain/returns'
import { derive } from './import/normalize'
import type { RawRecord } from './import/records'
import type { Snapshot } from './import/posicao'
import type { Quote } from './prices/brapi'
import { loadQuotes, loadRecords, loadSnapshots } from './storage/db'
import Carteira from './ui/Carteira'
import Cotacoes from './ui/Cotacoes'
import Evolucao from './ui/Evolucao'
import Importar from './ui/Importar'
import Proventos from './ui/Proventos'

const TABS = ['Carteira', 'Evolução', 'Proventos', 'Cotações', 'Importar'] as const

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Carteira')
  const [data, setData] = useState<{ records: RawRecord[]; snapshots: Snapshot[]; quotes: Quote[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData({ records: await loadRecords(), snapshots: await loadSnapshots(), quotes: await loadQuotes() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const result = useMemo(() => {
    if (!data) return null
    try {
      const d = derive(data.records)
      const pf = buildPortfolio(computePositions(d.trades, d.adjusts), data.snapshots, data.quotes)
      const today = new Date().toLocaleDateString('sv-SE')
      const evolution = buildEvolution(d.trades, d.adjusts, d.proventos, pricePoints(d.trades, data.snapshots, data.quotes), today)
      return { pf, ret: buildReturns(d.trades, d.proventos, pf), proventos: d.proventos, evolution }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">💰 money-supervisor</h1>
          <nav className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">Erro ao abrir o banco local: {error}</p>}
        {tab === 'Importar' ? (
          <Importar onDone={reload} />
        ) : !result ? (
          <p className="text-slate-500">Carregando…</p>
        ) : 'error' in result ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Não foi possível calcular a carteira: {result.error}</p>
        ) : tab === 'Cotações' ? (
          <Cotacoes pf={result.pf} onDone={reload} />
        ) : tab === 'Evolução' ? (
          <Evolucao points={result.evolution} />
        ) : tab === 'Proventos' ? (
          <Proventos proventos={result.proventos} cost={result.pf.cost} asOf={new Date().toLocaleDateString('sv-SE')} />
        ) : (
          <Carteira pf={result.pf} ret={result.ret} />
        )}
      </main>
    </div>
  )
}
