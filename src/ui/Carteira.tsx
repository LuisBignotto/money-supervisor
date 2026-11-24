import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Portfolio, PortfolioRow } from '../domain/portfolio'
import type { Returns } from '../domain/returns'
import { brlNumber, money, percent, quantity } from './format'
import { Card, Info, Section, tone } from './parts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#64748b']
const pctNum = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1).replace('.', ',')}% a.a.`)

const BADGE: Record<PortfolioRow['status'], string | null> = {
  ok: null,
  'sem-posicao': 'Não consta na Posição',
  divergente: 'Quantidade difere da Posição',
}

const th = 'px-4 py-3 text-right'
const td = 'px-4 py-3 text-right'

export default function Carteira({ pf, ret }: { pf: Portfolio; ret: Returns }) {
  if (pf.rows.length === 0) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Nenhum dado ainda. Importe seus arquivos na aba Importar.</p>
  }
  const pie = pf.rows.filter((r) => r.value).map((r) => ({ name: r.ticker, value: r.value!.toNumber() }))
  const total = pf.value.toNumber()
  const t = ret.total
  const { contributed, growth, growthPct } = ret.patrimony
  const unrealizedPct = pf.cost.isZero() ? null : pf.result.div(pf.cost)
  const evolution = ret.contributions.map((c) => ({ month: c.month, aportado: c.cumulative.toNumber() }))

  return (
    <div className="space-y-12">
      <Section title="Patrimônio hoje" hint="Só o que você tem agora, comparado ao custo das posições abertas e ao dinheiro que você colocou.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Valor atual" info="Quanto a sua carteira vale hoje, pelo preço de fechamento da última Posição importada (a data aparece embaixo da tabela de posições). Ativos sem preço na Posição não entram.">{money(pf.value)}</Card>
          <Card label="Custo das posições atuais" sub="preço médio × quantidade" info="Quanto você pagou, em média, pelos ativos que ainda tem: preço médio × quantidade. O que você já vendeu não entra aqui.">{money(pf.cost)}</Card>
          <Card label="Resultado não realizado" info="Lucro ou prejuízo 'no papel' dos ativos que você ainda possui: valor atual − custo. 'Não realizado' porque você ainda não vendeu: só vira dinheiro de verdade se vender, e o valor muda com o mercado." className={tone(pf.result)}>{money(pf.result)}</Card>
          <Card label="Não realizado (%)" info="O mesmo resultado não realizado, em porcentagem sobre o custo das posições atuais." className={tone(unrealizedPct)}>{percent(unrealizedPct)}</Card>
          <Card label="Evolução patrimonial" sub={`carteira ${growth.isNegative() ? 'vale' : 'vale +'}${money(growth.abs())} ${growth.isNegative() ? 'a menos' : 'a mais'} que o colocado (${money(contributed)}), sem contar proventos`} info="Compara o patrimônio de hoje com o dinheiro que você colocou e ainda está investido (compras − vendas). Positivo: a carteira vale mais do que você colocou; negativo: vale menos. Proventos recebidos não entram aqui: por isso esta box pode estar negativa enquanto o Ganho total (que soma os proventos) está positivo." className={tone(growthPct)}>{percent(growthPct)}</Card>
        </div>
      </Section>

      <Section title="Retorno total" hint="Tudo que você colocou, tudo que voltou (vendas e proventos) e o que vale hoje. O lucro de vendas já está incluído, sem contar duas vezes.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Seu dinheiro (compras − vendas)" sub={`compras ${money(t.invested)} · vendas ${money(t.sold)}`} info="Tudo que você comprou menos tudo que vendeu: o dinheiro que realmente saiu do seu bolso e continua investido, sem considerar proventos.">{money(contributed)}</Card>
          <Card label="Proventos recebidos" info="Dividendos, JCP e rendimentos de FIIs que você recebeu, nos valores que a B3 informa (já líquidos de IR retido). Inclui ativos que você já vendeu." className="text-emerald-600">{money(t.dividends)}</Card>
          <div className={`rounded-2xl p-6 text-white ${t.gain.isNegative() ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium opacity-90">Ganho total · {t.gain.isNegative() ? 'no negativo' : 'no positivo'}</p>
              <Info light text="Fecha a conta de caixa: valor atual + o que você recebeu em vendas + proventos − tudo que comprou. Já inclui o lucro das vendas, sem contar duas vezes. É bruto: sem corretagem, taxas e IR." />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{money(t.gain)}</p>
            <dl className="mt-4 space-y-1.5 border-t border-white/30 pt-3 text-sm tabular-nums">
              <div className="flex justify-between gap-2"><dt className="opacity-80">Carteira vs. dinheiro colocado</dt><dd>{money(growth)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="opacity-80">+ Proventos recebidos</dt><dd>{money(t.dividends)}</dd></div>
            </dl>
          </div>
          <Card label="Retorno sobre o que investiu" sub="ganho ÷ total comprado" info="Ganho total dividido por tudo que você já comprou. Mostra quanto cada R$ 1 comprado rendeu até hoje, sem considerar por quanto tempo ficou investido." className={tone(t.returnPct)}>{percent(t.returnPct)}</Card>
          <Card label="Rentabilidade anualizada" sub="considera quando cada aporte foi feito" info="Quanto a carteira rendeu por ano, levando em conta a data e o valor de cada compra, venda e provento (XIRR). Dinheiro colocado há pouco tempo pesa menos, por isso difere do retorno simples. Em posições muito recentes pode não dar para calcular (—)." className={tone(t.xirr === null ? null : { isNegative: () => t.xirr! < 0 })}>{pctNum(t.xirr)}</Card>
        </div>
        <p className="text-xs text-slate-500">
          Ainda sem custos e impostos: corretagem, taxas e IR não vêm nos arquivos da B3, então este é o resultado bruto, não o lucro líquido.
          {ret.excluded.length > 0 && ` Fora destas contas por não ter preço na Posição: ${ret.excluded.join(', ')}.`}
        </p>
      </Section>

      <Section title="Evolução do seu dinheiro" hint="Quanto você já colocou (compras − vendas), acumulado por mês. A linha tracejada é o patrimônio de hoje: a distância entre as duas é o que foi ganho.">
        <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4">
          <ResponsiveContainer>
            <LineChart data={evolution} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} width={44} />
              <Tooltip formatter={(v) => brlNumber(Number(v))} />
              <ReferenceLine y={total} stroke="#10b981" strokeDasharray="6 4" label={{ value: 'Patrimônio hoje', position: 'insideTopLeft', fontSize: 12, fill: '#059669' }} />
              <Line type="stepAfter" dataKey="aportado" name="Aportado" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500">Histórico do valor do patrimônio mês a mês precisa de cotações antigas; entra junto com a busca de preços.</p>
      </Section>

      <Section title="Posições">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white lg:col-span-2">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ativo</th>
                  <th className={th}>Qtd</th>
                  <th className={th}>Preço médio</th>
                  <th className={th}>Preço atual</th>
                  <th className={th}>Valor</th>
                  <th className={th}>Resultado (R$)</th>
                  <th className={th}>Resultado (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pf.rows.map((r) => (
                  <tr key={r.ticker} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.ticker}
                      {BADGE[r.status] && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">{BADGE[r.status]}</span>}
                    </td>
                    <td className={td}>{quantity(r.quantity)}</td>
                    <td className={td}>{money(r.avgPrice)}</td>
                    <td className={td}>{money(r.price)}</td>
                    <td className={td}>{money(r.value)}</td>
                    <td className={`${td} ${tone(r.result)}`}>{money(r.result)}</td>
                    <td className={`${td} ${tone(r.resultPct)}`}>{percent(r.resultPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              Preço atual: cotação (brapi) quando existe, senão a Posição de {pf.snapshotDate ? pf.snapshotDate.split('-').reverse().join('/') : '—'}. Veja a fonte na aba Cotações. Taxas não entram no preço médio.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-medium text-slate-700">Alocação por valor</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
                    {pie.map((p, i) => <Cell key={p.name} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brlNumber(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {pie.map((p, i) => (
                <li key={p.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1">{p.name}</span>
                  <span className="tabular-nums text-slate-500">{((p.value / total) * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Rentabilidade por ativo" hint="Inclui vendas e proventos, e também os ativos que você já zerou.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Ativo</th>
                <th className={th}>Comprado</th>
                <th className={th}>Vendido</th>
                <th className={th}>Proventos</th>
                <th className={th}>Valor atual</th>
                <th className={th}>Ganho (R$)</th>
                <th className={th}>Retorno (%)</th>
                <th className={th}>Rentab. a.a.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ret.assets.map((a) => (
                <tr key={a.ticker} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {a.ticker}
                    {a.value.isZero() && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">zerado</span>}
                  </td>
                  <td className={td}>{money(a.invested)}</td>
                  <td className={td}>{money(a.sold)}</td>
                  <td className={td}>{money(a.dividends)}</td>
                  <td className={td}>{money(a.value)}</td>
                  <td className={`${td} ${tone(a.gain)}`}>{money(a.gain)}</td>
                  <td className={`${td} ${tone(a.returnPct)}`}>{percent(a.returnPct)}</td>
                  <td className={`${td} ${tone(a.xirr === null ? null : { isNegative: () => a.xirr! < 0 })}`}>{pctNum(a.xirr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
