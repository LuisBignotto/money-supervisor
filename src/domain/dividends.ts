import Decimal from 'decimal.js'
import type { Provento, ProventoType } from './types'

export const net = (p: Provento) => p.gross.minus(p.tax)

const sumBy = (items: Provento[], key: (p: Provento) => string) => {
  const m = new Map<string, Decimal>()
  for (const p of items) m.set(key(p), (m.get(key(p)) ?? new Decimal(0)).plus(net(p)))
  return m
}

/** Líquido por mês (`aaaa-mm`), separado por tipo — nunca soma tipos diferentes. */
export function netByMonth(items: Provento[]): Map<string, Map<ProventoType, Decimal>> {
  const out = new Map<string, Map<ProventoType, Decimal>>()
  for (const p of items) {
    const month = p.date.slice(0, 7)
    const byType = out.get(month) ?? new Map<ProventoType, Decimal>()
    byType.set(p.type, (byType.get(p.type) ?? new Decimal(0)).plus(net(p)))
    out.set(month, byType)
  }
  return out
}

export const netByTicker = (items: Provento[]) => sumBy(items, (p) => p.ticker)

export const TYPE_LABEL: Record<ProventoType, string> = {
  dividend: 'Dividendos',
  jcp: 'JCP',
  income: 'Rendimentos (FIIs/fundos)',
}

const sumNet = (items: Provento[]) => items.reduce((a, p) => a.plus(net(p)), new Decimal(0))

/** Proventos pagos nos 12 meses até `asOf` (aaaa-mm-dd, inclusive). */
export function last12Months(items: Provento[], asOf: string): Provento[] {
  const from = `${Number(asOf.slice(0, 4)) - 1}${asOf.slice(4)}`
  return items.filter((p) => p.date > from && p.date <= asOf)
}

export const total = sumNet

export interface MonthRow {
  month: string
  dividend: number
  jcp: number
  income: number
}

/** Série mensal por tipo (só para gráfico, por isso number), sem buracos entre o primeiro e o último mês. */
export function monthlySeries(items: Provento[], year: string | null = null): MonthRow[] {
  const sel = year ? items.filter((p) => p.date.startsWith(year)) : items
  if (sel.length === 0) return []
  const byMonth = netByMonth(sel)
  const months = [...byMonth.keys()].sort()
  const [first, last] = year ? [`${year}-01`, `${year}-12`] : [months[0], months[months.length - 1]]
  const out: MonthRow[] = []
  let [y, m] = first.split('-').map(Number)
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const t = byMonth.get(key)
    out.push({ month: key, dividend: t?.get('dividend')?.toNumber() ?? 0, jcp: t?.get('jcp')?.toNumber() ?? 0, income: t?.get('income')?.toNumber() ?? 0 })
    if (key >= last) break
    if (++m > 12) { m = 1; y++ }
  }
  return out
}

export interface TickerSummary {
  ticker: string
  total: Decimal
  last12: Decimal
  payments: number
  lastDate: string
}

export function summaryByTicker(items: Provento[], asOf: string): TickerSummary[] {
  const recent = new Set(last12Months(items, asOf))
  const m = new Map<string, TickerSummary>()
  for (const p of items) {
    const s = m.get(p.ticker) ?? { ticker: p.ticker, total: new Decimal(0), last12: new Decimal(0), payments: 0, lastDate: p.date }
    s.total = s.total.plus(net(p))
    if (recent.has(p)) s.last12 = s.last12.plus(net(p))
    s.payments++
    if (p.date > s.lastDate) s.lastDate = p.date
    m.set(p.ticker, s)
  }
  return [...m.values()].sort((a, b) => b.total.comparedTo(a.total))
}

/** Mês (`aaaa-mm`) anterior ao de `asOf` (aaaa-mm-dd). */
export function previousMonth(asOf: string): string {
  const y = Number(asOf.slice(0, 4))
  const m = Number(asOf.slice(5, 7))
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** Líquido recebido num mês `aaaa-mm`, todos os tipos. */
export const monthTotal = (items: Provento[], month: string) => sumNet(items.filter((p) => p.date.startsWith(month)))
