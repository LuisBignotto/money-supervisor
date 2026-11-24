import Decimal from 'decimal.js'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EvolutionPoint } from '../domain/evolution'
import { brlNumber, money } from './format'
import { Card, Section, tone } from './parts'

const fmtMonth = (m: string) => m.split('-').reverse().join('/')
const axis = (v: unknown) => `${Math.round(Number(v) / 1000)}k`

export default function Evolucao({ points }: { points: EvolutionPoint[] }) {
  if (points.length === 0) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Nenhum dado ainda. Importe seus arquivos na aba Importar.</p>
  }
  const last = points[points.length - 1]
  // Janela de 12 meses: compara com o ponto de 12 meses atrás (ou com o zero, se o histórico é mais curto).
  const long = points.length > 12
  const base = long ? points[points.length - 13] : { invested: new Decimal(0), gain: new Decimal(0) }
  const months = long ? 12 : points.length
  const gain12 = last.gain.minus(base.gain)
  const monthly = last.invested.minus(base.invested).div(months)

  const data = points.map((p) => ({ month: p.month, patrimonio: p.value.toNumber(), aportado: p.invested.toNumber(), ganho: p.gain.toNumber() }))

  return (
    <div className="space-y-12">
      <Section title="Evolução do patrimônio" hint="Como a sua carteira cresceu desde o primeiro aporte: o que veio do seu bolso e o que foi ganho.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Patrimônio hoje" info="Quanto a carteira vale no último ponto da série (preços mais recentes que o app conhece). Pode diferir alguns reais da aba Carteira, que deixa de fora ativos sem preço na Posição.">{money(last.value)}</Card>
          <Card label="Aporte médio por mês" sub={long ? 'últimos 12 meses' : `desde o início (${months} meses)`} info="Quanto, em média, você colocou por mês na carteira: compras menos vendas dos últimos 12 meses, divididos por 12. Mostra o seu ritmo de investimento.">{money(monthly)}</Card>
          <Card label="Ganho nos últimos 12 meses" sub="valorização + proventos" info="O que a carteira rendeu de verdade no último ano: a variação do patrimônio, descontando o dinheiro novo que você colocou, mais os proventos recebidos. Assim um mês de aporte grande não parece lucro." className={tone(gain12)}>{money(gain12)}</Card>
        </div>
      </Section>

      <Section title="Patrimônio × dinheiro aportado" hint="A distância entre as linhas é o que foi ganho (ou perdido) em valorização. Acima da linha azul, a carteira vale mais do que você colocou.">
        <div className="h-80 rounded-2xl border border-slate-200 bg-white p-4">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={axis} tick={{ fontSize: 12 }} width={44} />
              <Tooltip labelFormatter={(m) => fmtMonth(String(m))} formatter={(v) => brlNumber(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="aportado" name="Aportado (compras − vendas)" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="patrimonio" name="Patrimônio (estimado)" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Ganho acumulado" hint="Valorização mais proventos recebidos, mês a mês. Verde: no positivo. Vermelho: no negativo.">
        <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={axis} tick={{ fontSize: 12 }} width={44} />
              <Tooltip labelFormatter={(m) => fmtMonth(String(m))} formatter={(v) => brlNumber(Number(v))} />
              <Bar dataKey="ganho" name="Ganho acumulado">
                {data.map((p) => <Cell key={p.month} fill={p.ganho < 0 ? '#ef4444' : '#10b981'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500">
          O patrimônio dos meses passados é uma <strong>estimativa</strong>: quantidade que você tinha × último preço conhecido (seus negócios, Posições importadas e cotações). O plano gratuito da brapi só traz 3 meses de histórico, então os meses sem negócio podem divergir do mercado. Importar uma Posição a cada mês deixa a série mais fiel daqui para a frente.
        </p>
      </Section>
    </div>
  )
}
