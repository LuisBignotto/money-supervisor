import { useState } from 'react'
import type { Portfolio } from '../domain/portfolio'
import { fetchQuotes, hasToken, isListed } from '../prices/brapi'
import { saveQuotes } from '../storage/db'
import { money } from './format'
import { Card, Section } from './parts'

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function Cotacoes({ pf, onDone }: { pf: Portfolio; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const tickers = pf.rows.map((r) => r.ticker).filter(isListed)

  async function refresh() {
    setBusy(true)
    setErrors({})
    setProgress(`Buscando ${tickers.length} ativos…`)
    const { quotes, errors } = await fetchQuotes(tickers, import.meta.env.VITE_BRAPI_TOKEN as string)
    await saveQuotes(quotes)
    setErrors(errors)
    setProgress('')
    setBusy(false)
    onDone()
  }

  return (
    <div className="space-y-10">
      <Section title="Cotações" hint="Preços de mercado vindos da brapi. Eles substituem o preço da Posição na Carteira, quando são mais novos.">
        {!hasToken() && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Token da brapi não encontrado. Coloque <code>VITE_BRAPI_TOKEN=seu_token</code> no arquivo <code>.env</code> e reinicie o <code>npm run dev</code>.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Ativos com cotação" sub={`${pf.rows.filter((r) => r.priceSource === 'cotacao').length} de ${tickers.length} de bolsa`} info="Quantos dos seus ativos negociados em bolsa estão usando uma cotação da brapi. Os outros usam o preço da última Posição importada. Tesouro Direto não tem cotação aqui e sempre usa a Posição.">
            {pf.rows.filter((r) => r.priceSource === 'cotacao').length}
          </Card>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Atualizar traz o preço mais recente de cada ativo, um por vez (limite do plano gratuito). Leva alguns segundos.</p>
            <button
              onClick={() => void refresh()}
              disabled={busy || !hasToken()}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? progress || 'Atualizando…' : 'Atualizar cotações'}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Preço de cada ativo">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3 text-right">Preço usado</th>
                <th className="px-4 py-3">Fonte</th>
                <th className="px-4 py-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pf.rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.ticker}</td>
                  <td className="px-4 py-3 text-right">{money(r.price)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.priceSource === 'cotacao' ? 'Cotação (brapi)' : r.priceSource === 'posicao' ? 'Posição da B3' : '—'}</td>
                  <td className="px-4 py-3 text-xs text-red-600">{errors[r.ticker] ?? (isListed(r.ticker) ? '' : 'Sem cotação para este tipo de ativo')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pf.asOf && <p className="text-xs text-slate-500">Preços mais recentes de {when(pf.asOf)}.</p>}
      </Section>
    </div>
  )
}
