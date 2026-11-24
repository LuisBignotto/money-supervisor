import Decimal from 'decimal.js'
import { net } from './dividends'
import type { Portfolio } from './portfolio'
import type { Provento, Trade } from './types'

export interface Flow {
  date: string
  amount: number
}

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000

/**
 * Rentabilidade anualizada ponderada pelo tempo do dinheiro (XIRR): a taxa que zera o valor presente dos fluxos.
 * Saída = negativo, entrada = positivo. Em número (é uma taxa, não dinheiro).
 * ponytail: bisection em [-99%, +1000%] a.a.; fora disso (ex.: posição de poucos dias) devolve null.
 */
export function xirr(flows: Flow[]): number | null {
  if (!flows.some((f) => f.amount > 0) || !flows.some((f) => f.amount < 0)) return null
  const t0 = flows.reduce((m, f) => (f.date < m ? f.date : m), flows[0].date)
  const npv = (r: number) => flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, days(t0, f.date) / 365), 0)
  let lo = -0.99
  let hi = 10
  if (npv(lo) * npv(hi) > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (npv(lo) * npv(mid) <= 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

export interface AssetReturn {
  ticker: string
  /** Soma das compras. */
  invested: Decimal
  /** Soma das vendas. */
  sold: Decimal
  /** Proventos líquidos. */
  dividends: Decimal
  /** Valor atual (0 se a posição foi zerada). */
  value: Decimal
  /** valor atual + vendas + proventos − compras. Já inclui o lucro de vendas, sem contar duas vezes. */
  gain: Decimal
  /** gain / invested. */
  returnPct: Decimal | null
  /** Rentabilidade anualizada considerando datas e valores de cada aporte. */
  xirr: number | null
}

export interface Returns {
  assets: AssetReturn[]
  total: Omit<AssetReturn, 'ticker'>
  /** Ativos abertos sem preço na Posição: ficam fora destas contas. */
  excluded: string[]
  /** Dinheiro seu ainda investido (compras − vendas) e quanto o patrimônio cresceu sobre ele (proventos ficam fora). */
  patrimony: { contributed: Decimal; growth: Decimal; growthPct: Decimal | null }
  /** Aportado líquido (compras − vendas) acumulado por mês `aaaa-mm`. */
  contributions: { month: string; cumulative: Decimal }[]
}

const zero = () => new Decimal(0)

function summarize(trades: Trade[], proventos: Provento[], value: Decimal, endDate: string): Omit<AssetReturn, 'ticker'> {
  let invested = zero()
  let sold = zero()
  const flows: Flow[] = []
  for (const t of trades) {
    const v = t.quantity.times(t.price)
    if (t.side === 'buy') invested = invested.plus(v)
    else sold = sold.plus(v)
    flows.push({ date: t.date, amount: (t.side === 'buy' ? -1 : 1) * v.toNumber() })
  }
  const dividends = proventos.reduce((a, p) => a.plus(net(p)), zero())
  for (const p of proventos) flows.push({ date: p.date, amount: net(p).toNumber() })
  if (value.gt(0)) flows.push({ date: endDate, amount: value.toNumber() })
  const gain = value.plus(sold).plus(dividends).minus(invested)
  return { invested, sold, dividends, value, gain, returnPct: invested.isZero() ? null : gain.div(invested), xirr: xirr(flows) }
}

export function buildReturns(trades: Trade[], proventos: Provento[], pf: Portfolio): Returns {
  const excluded = pf.rows.filter((r) => !r.value).map((r) => r.ticker)
  const open = new Map(pf.rows.map((r) => [r.ticker, r.value]))
  const endDate = pf.asOf ?? new Date().toISOString().slice(0, 10)

  const tickers = new Set([...trades.map((t) => t.ticker), ...proventos.map((p) => p.ticker)])
  const assets: AssetReturn[] = []
  for (const ticker of tickers) {
    if (excluded.includes(ticker)) continue
    const value = open.get(ticker) ?? zero() // fora de pf.rows = posição zerada
    assets.push({
      ticker,
      ...summarize(trades.filter((t) => t.ticker === ticker), proventos.filter((p) => p.ticker === ticker), value, endDate),
    })
  }
  assets.sort((a, b) => b.gain.comparedTo(a.gain))

  const incl = (t: string) => !excluded.includes(t)
  const inclTrades = trades.filter((t) => incl(t.ticker))
  const total = summarize(inclTrades, proventos.filter((p) => incl(p.ticker)), pf.rows.reduce((a, r) => (r.value ? a.plus(r.value) : a), zero()), endDate)

  const byMonth = new Map<string, Decimal>()
  for (const t of inclTrades) {
    const m = t.date.slice(0, 7)
    const v = t.quantity.times(t.price)
    byMonth.set(m, (byMonth.get(m) ?? zero()).plus(t.side === 'buy' ? v : v.neg()))
  }
  let acc = zero()
  const contributions = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, cumulative: (acc = acc.plus(v)) }))

  const contributed = total.invested.minus(total.sold)
  const growth = total.value.minus(contributed)
  const patrimony = { contributed, growth, growthPct: contributed.gt(0) ? growth.div(contributed) : null }

  return { assets, total, excluded, patrimony, contributions }
}
