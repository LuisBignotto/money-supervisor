import Decimal from 'decimal.js'
import { expect, test } from 'vitest'
import { netByMonth, netByTicker } from './dividends'
import { computePositions } from './positions'
import type { Provento, QuantityAdjust, Trade } from './types'

const d = (v: string | number) => new Decimal(v)
const t = (date: string, side: 'buy' | 'sell', q: number, price: string, ticker = 'PETR4'): Trade => ({
  date, ticker, side, quantity: d(q), price: d(price),
})

test('preço médio de duas compras', () => {
  const p = computePositions([t('2024-01-02', 'buy', 100, '10'), t('2024-02-02', 'buy', 100, '20')]).get('PETR4')!
  expect(p.quantity.toString()).toBe('200')
  expect(p.avgPrice.toString()).toBe('15')
})

test('venda parcial realiza lucro sem mudar o PM', () => {
  const p = computePositions([
    t('2024-01-02', 'buy', 100, '10'),
    t('2024-02-02', 'buy', 100, '20'),
    t('2024-03-02', 'sell', 50, '18'),
  ]).get('PETR4')!
  expect(p.realized.toString()).toBe('150') // 50 * (18 - 15)
  expect(p.quantity.toString()).toBe('150')
  expect(p.avgPrice.toString()).toBe('15')
})

test('zerar posição e recomprar reinicia o PM', () => {
  const p = computePositions([
    t('2024-01-02', 'buy', 10, '10'),
    t('2024-01-03', 'sell', 10, '12'),
    t('2024-01-04', 'buy', 10, '30'),
  ]).get('PETR4')!
  expect(p.realized.toString()).toBe('20')
  expect(p.avgPrice.toString()).toBe('30')
})

test('sem erro de ponto flutuante', () => {
  const p = computePositions([t('2024-01-02', 'buy', 3, '0.1'), t('2024-01-03', 'buy', 3, '0.2')]).get('PETR4')!
  expect(p.cost.toString()).toBe('0.9')
})

test('desdobro credita quantidade e reduz o PM', () => {
  const adj: QuantityAdjust = { date: '2024-02-01', ticker: 'PETR4', delta: d(100) }
  const p = computePositions([t('2024-01-02', 'buy', 100, '10')], [adj]).get('PETR4')!
  expect(p.quantity.toString()).toBe('200')
  expect(p.avgPrice.toString()).toBe('5')
})

test('grupamento debita quantidade e aumenta o PM', () => {
  const adj: QuantityAdjust = { date: '2024-02-01', ticker: 'PETR4', delta: d(-90) }
  const p = computePositions([t('2024-01-02', 'buy', 100, '1')], [adj]).get('PETR4')!
  expect(p.quantity.toString()).toBe('10')
  expect(p.avgPrice.toString()).toBe('10')
})

test('operações fora de ordem são ordenadas por data', () => {
  const p = computePositions([t('2024-02-02', 'sell', 5, '12'), t('2024-01-02', 'buy', 10, '10')]).get('PETR4')!
  expect(p.quantity.toString()).toBe('5')
})

test('venda maior que a posição falha com erro claro', () => {
  expect(() => computePositions([t('2024-01-02', 'sell', 1, '10')])).toThrow(/excede a posição/)
})

test('tickers independentes', () => {
  const m = computePositions([t('2024-01-02', 'buy', 1, '10', 'A'), t('2024-01-02', 'buy', 2, '5', 'B')])
  expect(m.get('A')!.quantity.toString()).toBe('1')
  expect(m.get('B')!.quantity.toString()).toBe('2')
})

const prov = (date: string, ticker: string, type: Provento['type'], gross: string, tax = '0'): Provento => ({
  date, ticker, type, gross: d(gross), tax: d(tax),
})

test('proventos: líquido por mês separado por tipo (JCP com IR)', () => {
  const m = netByMonth([
    prov('2024-03-10', 'PETR4', 'dividend', '10'),
    prov('2024-03-20', 'ITUB4', 'jcp', '10', '1.5'),
    prov('2024-04-05', 'HGLG11', 'income', '7'),
  ])
  expect(m.get('2024-03')!.get('dividend')!.toString()).toBe('10')
  expect(m.get('2024-03')!.get('jcp')!.toString()).toBe('8.5')
  expect(m.get('2024-04')!.get('income')!.toString()).toBe('7')
})

test('proventos: total por ticker', () => {
  const m = netByTicker([prov('2024-03-10', 'A', 'dividend', '10'), prov('2024-04-10', 'A', 'jcp', '5', '1')])
  expect(m.get('A')!.toString()).toBe('14')
})

test('proventos: 12 meses, série sem buracos e resumo por ticker', async () => {
  const { last12Months, monthlySeries, summaryByTicker } = await import('./dividends')
  const items = [
    prov('2023-05-10', 'A', 'dividend', '100'), // fora dos 12 meses
    prov('2024-03-10', 'A', 'dividend', '10'),
    prov('2024-06-10', 'A', 'jcp', '5', '1'),
    prov('2024-06-15', 'B', 'income', '7'),
  ]
  expect(last12Months(items, '2024-06-30')).toHaveLength(3)
  const series = monthlySeries(items.slice(1))
  expect(series.map((r) => r.month)).toEqual(['2024-03', '2024-04', '2024-05', '2024-06'])
  expect(series[3]).toMatchObject({ jcp: 4, income: 7, dividend: 0 })
  expect(monthlySeries(items, '2024')).toHaveLength(12)
  const a = summaryByTicker(items, '2024-06-30').find((s) => s.ticker === 'A')!
  expect(a.total.toString()).toBe('114')
  expect(a.last12.toString()).toBe('14')
  expect(a.payments).toBe(3)
  expect(a.lastDate).toBe('2024-06-10')
})

test('proventos: mês anterior (virada de ano) e total do mês', async () => {
  const { monthTotal, previousMonth } = await import('./dividends')
  expect(previousMonth('2026-11-23')).toBe('2026-10')
  expect(previousMonth('2026-01-05')).toBe('2025-12')
  const items = [prov('2026-10-03', 'A', 'dividend', '10'), prov('2026-10-20', 'B', 'jcp', '5', '1'), prov('2026-11-02', 'A', 'income', '7')]
  expect(monthTotal(items, '2026-10').toString()).toBe('14')
  expect(monthTotal(items, '2026-09').toString()).toBe('0')
})
