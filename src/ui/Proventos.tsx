import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { last12Months, monthlySeries, monthTotal, previousMonth, summaryByTicker, TYPE_LABEL, total } from '../domain/dividends'
import type { Provento } from '../domain/types'
import { brlNumber, money, percent } from './format'
import { Card, Section } from './parts'

const COLORS = { dividend: '#3b82f6', jcp: '#f59e0b', income: '#10b981' } as const
const th = 'px-4 py-3 text-right'
const td = 'px-4 py-3 text-right'

export default function Proventos({ proventos, cost, asOf }: { proventos: Provento[]; cost: Parameters<typeof percent>[0]; asOf: string }) {
  const [year, setYear] = useState<string>('')
  if (proventos.length === 0) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Nenhum provento ainda. Importe a Movimentação na aba Importar.</p>
  }
  const years = [...new Set(proventos.map((p) => p.date.slice(0, 4)))].sort().reverse()
  const recent = last12Months(proventos, asOf)
  const last12 = total(recent)
  const series = monthlySeries(proventos, year || null)
  const rows = summaryByTicker(proventos, asOf)
  const yoc = cost && !cost.isZero() ? last12.div(cost) : null
  const fmtMonth = (m: string) => m.split('-').reverse().join('/')
  const monthName = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const prev = previousMonth(asOf)
  const current = asOf.slice(0, 7)

  return (
    <div className="space-y-12">
      <Section title="Proventos recebidos" hint="Dinheiro que os seus ativos pagaram a você, nos valores líquidos que a B3 informa.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Total recebido" info="Soma de todos os proventos (dividendos, JCP e rendimentos) desde o seu primeiro registro, incluindo ativos que você já vendeu. Valores já líquidos de IR retido, como a B3 informa." className="text-emerald-600">{money(total(proventos))}</Card>
          <Card label={`Último mês (${monthName(prev)})`} sub={`${monthName(current)} até hoje: ${money(monthTotal(proventos, current))}`} info="Quanto você recebeu de proventos no mês passado inteiro, comparando as datas de pagamento com a data de hoje do seu computador. Embaixo, o que já caiu no mês atual, que ainda está em andamento e pode crescer." className="text-emerald-600">{money(monthTotal(proventos, prev))}</Card>
          <Card label="Últimos 12 meses" sub={`até ${asOf.split('-').reverse().join('/')}`} info="Quanto você recebeu de proventos no último ano. É o número mais útil para comparar com o custo da carteira, porque tira o efeito de quando você começou a investir.">{money(last12)}</Card>
          <Card label="Média por mês" sub="últimos 12 meses" info="Os proventos dos últimos 12 meses divididos por 12: quanto a carteira 'paga de salário' por mês, em média. Varia bastante, porque FIIs pagam todo mês e ações pagam em datas espaçadas.">{money(last12.div(12))}</Card>
          <Card label="Yield sobre o custo" sub="12 meses ÷ custo das posições atuais" info="Proventos dos últimos 12 meses divididos pelo que você pagou nos ativos que ainda tem (custo das posições atuais). Mostra quanto a carteira rende por ano em proventos sobre o dinheiro que você colocou, não sobre o preço de hoje. Os proventos de ativos já vendidos entram no numerador, então pode ficar um pouco alto.">{percent(yoc)}</Card>
        </div>
      </Section>

      <Section title="Por mês" hint="Cada barra é um mês, dividida por tipo de provento.">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <label htmlFor="ano" className="text-slate-500">Período</label>
            <select id="ano" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1">
              <option value="">Tudo</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} minTickGap={20} />
                <YAxis tickFormatter={(v) => brlNumber(Number(v)).replace(',00', '')} tick={{ fontSize: 12 }} width={70} />
                <Tooltip labelFormatter={(m) => fmtMonth(String(m))} formatter={(v) => brlNumber(Number(v))} />
                <Legend />
                <Bar dataKey="dividend" name={TYPE_LABEL.dividend} stackId="a" fill={COLORS.dividend} />
                <Bar dataKey="jcp" name={TYPE_LABEL.jcp} stackId="a" fill={COLORS.jcp} />
                <Bar dataKey="income" name={TYPE_LABEL.income} stackId="a" fill={COLORS.income} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Dividendos: lucro distribuído por empresas. JCP: parecido, mas com IR retido na fonte. Rendimentos: o que FIIs e fundos pagam (geralmente todo mês).
          </p>
        </div>
      </Section>

      <Section title="Por ativo" hint="Quem mais pagou, e quando foi o último pagamento.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Ativo</th>
                <th className={th}>Total recebido</th>
                <th className={th}>Últimos 12 meses</th>
                <th className={th}>Pagamentos</th>
                <th className={th}>Último</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.ticker}</td>
                  <td className={td}>{money(r.total)}</td>
                  <td className={td}>{money(r.last12)}</td>
                  <td className={td}>{r.payments}</td>
                  <td className={td}>{r.lastDate.split('-').reverse().join('/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
