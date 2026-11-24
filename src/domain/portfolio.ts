import Decimal from 'decimal.js'
import type { Position } from './types'

/** Foto da Posição da B3 (só o que precisamos aqui). */
export interface PriceSnapshot {
  date: string
  ticker: string
  quantity: number
  price: number | null
  value: number
}

/** Cotação ao vivo (brapi). */
export interface LiveQuote {
  ticker: string
  price: number
  time: string
}

export interface PortfolioRow {
  ticker: string
  quantity: Decimal
  avgPrice: Decimal
  cost: Decimal
  price: Decimal | null
  value: Decimal | null
  result: Decimal | null
  resultPct: Decimal | null
  /** ok = bate com a Posição; sem-posicao = não consta na Posição; divergente = quantidade difere. */
  status: 'ok' | 'sem-posicao' | 'divergente'
  /** De onde veio o preço atual. */
  priceSource: 'cotacao' | 'posicao' | null
}

export interface Portfolio {
  rows: PortfolioRow[]
  snapshotDate: string | null
  /** Data (aaaa-mm-dd) mais recente entre a Posição e as cotações: a "data de hoje" das contas de retorno. */
  asOf: string | null
  cost: Decimal
  value: Decimal
  result: Decimal
  realized: Decimal
}

/**
 * Posições abertas + valor atual. Preço = cotação ao vivo quando existe e é mais nova que a Posição;
 * senão, a foto mais recente da Posição (valor da B3). Com cotação: valor = quantidade calculada × preço.
 */
export function buildPortfolio(positions: Map<string, Position>, snapshots: PriceSnapshot[], quotes: LiveQuote[] = []): Portfolio {
  const snapshotDate = snapshots.reduce<string | null>((m, s) => (m === null || s.date > m ? s.date : m), null)
  const snap = new Map(snapshots.filter((s) => s.date === snapshotDate).map((s) => [s.ticker, s]))

  const rows: PortfolioRow[] = []
  let realized = new Decimal(0)
  for (const p of positions.values()) {
    realized = realized.plus(p.realized)
    if (p.quantity.lte(0)) continue
    const s = snap.get(p.ticker)
    const q = quotes.find((x) => x.ticker === p.ticker && (!snapshotDate || x.time.slice(0, 10) >= snapshotDate))
    const price = q ? new Decimal(q.price) : s?.price != null ? new Decimal(s.price) : null
    const value = q ? p.quantity.times(q.price) : s ? new Decimal(s.value) : null
    const result = value ? value.minus(p.cost) : null
    rows.push({
      ticker: p.ticker,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      cost: p.cost,
      price,
      value,
      result,
      resultPct: result && !p.cost.isZero() ? result.div(p.cost) : null,
      status: !s ? 'sem-posicao' : p.quantity.eq(s.quantity) ? 'ok' : 'divergente',
      priceSource: q ? 'cotacao' : s ? 'posicao' : null,
    })
  }
  rows.sort((a, b) => (b.value ?? b.cost).comparedTo(a.value ?? a.cost))

  const priced = rows.filter((r) => r.value)
  const sum = (xs: Decimal[]) => xs.reduce((a, b) => a.plus(b), new Decimal(0))
  const cost = sum(priced.map((r) => r.cost))
  const value = sum(priced.map((r) => r.value!))
  const quoteDay = quotes.map((x) => x.time.slice(0, 10)).sort().at(-1) ?? null
  const asOf = [snapshotDate, quoteDay].filter((d): d is string => !!d).sort().at(-1) ?? null
  return { rows, snapshotDate, asOf, cost, value, result: value.minus(cost), realized }
}
