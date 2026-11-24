import Decimal from 'decimal.js'
import { net } from './dividends'
import { computePositions } from './positions'
import type { Provento, QuantityAdjust, Trade } from './types'

export interface PricePoint {
  date: string
  ticker: string
  price: Decimal
}

export interface EvolutionPoint {
  month: string
  /** Aportado líquido acumulado (compras − vendas). */
  invested: Decimal
  /** Patrimônio estimado no fim do mês. */
  value: Decimal
  /** Proventos líquidos recebidos até o fim do mês. */
  dividends: Decimal
  /** value − invested + dividends. */
  gain: Decimal
}

/**
 * Preços conhecidos por data: o preço de cada negócio, o fechamento de cada Posição importada e as cotações.
 * Em empate de data vale o último da lista (Posição/cotação ganham do negócio do mesmo dia).
 */
export function pricePoints(
  trades: Trade[],
  snapshots: { date: string; ticker: string; price: number | null }[],
  quotes: { ticker: string; price: number; time: string }[],
): PricePoint[] {
  return [
    ...trades.map((t) => ({ date: t.date, ticker: t.ticker, price: t.price })),
    ...snapshots.filter((s) => s.price !== null).map((s) => ({ date: s.date, ticker: s.ticker, price: new Decimal(s.price!) })),
    ...quotes.map((q) => ({ date: q.time.slice(0, 10), ticker: q.ticker, price: new Decimal(q.price) })),
  ].sort((a, b) => a.date.localeCompare(b.date)) // sort estável: empate mantém a ordem acima
}

const monthEnd = (month: string, asOf: string) => {
  const [y, m] = month.split('-').map(Number)
  const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  return end > asOf ? asOf : end
}

/**
 * Patrimônio mês a mês, ESTIMADO: quantidade no fim do mês × último preço conhecido até aquela data.
 * Não há histórico de cotações (o plano gratuito da brapi só traz 3 meses), então meses sem negócio
 * nem Posição usam o preço do último negócio e podem divergir do mercado.
 */
export function buildEvolution(trades: Trade[], adjusts: QuantityAdjust[], proventos: Provento[], points: PricePoint[], asOf: string): EvolutionPoint[] {
  if (trades.length === 0) return []
  const byTicker = new Map<string, PricePoint[]>()
  for (const p of points) byTicker.set(p.ticker, [...(byTicker.get(p.ticker) ?? []), p])

  let [y, m] = trades.map((t) => t.date).sort()[0].slice(0, 7).split('-').map(Number)
  const out: EvolutionPoint[] = []
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`
    const end = monthEnd(month, asOf)
    const upto = trades.filter((t) => t.date <= end)
    let value = new Decimal(0)
    for (const pos of computePositions(upto, adjusts.filter((a) => a.date <= end)).values()) {
      if (pos.quantity.lte(0)) continue
      const price = byTicker.get(pos.ticker)?.findLast((p) => p.date <= end)?.price ?? pos.avgPrice
      value = value.plus(pos.quantity.times(price))
    }
    const invested = upto.reduce((a, t) => a.plus(t.quantity.times(t.price).times(t.side === 'buy' ? 1 : -1)), new Decimal(0))
    const dividends = proventos.filter((p) => p.date <= end).reduce((a, p) => a.plus(net(p)), new Decimal(0))
    out.push({ month, invested, value, dividends, gain: value.minus(invested).plus(dividends) })
    if (month >= asOf.slice(0, 7)) break
    if (++m > 12) { m = 1; y++ }
  }
  return out
}
