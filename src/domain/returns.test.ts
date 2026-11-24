import Decimal from 'decimal.js'
import { expect, test } from 'vitest'
import { buildPortfolio } from './portfolio'
import { computePositions } from './positions'
import { buildReturns, xirr } from './returns'
import type { Provento, Trade } from './types'

const d = (v: number | string) => new Decimal(v)
const t = (date: string, side: 'buy' | 'sell', ticker: string, q: number, p: number): Trade => ({ date, side, ticker, quantity: d(q), price: d(p) })

test('xirr: 100 -> 110 em 365 dias = 10% a.a.; sem entrada/saída = null', () => {
  const r = xirr([{ date: '2023-01-01', amount: -100 }, { date: '2024-01-01', amount: 110 }])
  expect(r).toBeCloseTo(0.1, 6)
  expect(xirr([{ date: '2023-01-01', amount: -100 }])).toBeNull()
})

test('xirr: o momento do aporte importa (mesmo ganho, aporte tardio rende mais a.a.)', () => {
  const cedo = xirr([{ date: '2023-01-01', amount: -100 }, { date: '2024-01-01', amount: 110 }])!
  const tarde = xirr([{ date: '2023-07-01', amount: -100 }, { date: '2024-01-01', amount: 110 }])!
  expect(tarde).toBeGreaterThan(cedo)
})

test('ganho por ativo inclui vendas e proventos; vendido não é contado em dobro', () => {
  const trades = [t('2023-01-01', 'buy', 'A', 10, 10), t('2023-06-01', 'sell', 'A', 10, 15), t('2023-02-01', 'buy', 'B', 10, 10)]
  const proventos: Provento[] = [{ date: '2023-03-01', ticker: 'A', type: 'dividend', gross: d(4), tax: d(0) }]
  const pf = buildPortfolio(computePositions(trades), [{ date: '2024-01-01', ticker: 'B', quantity: 10, price: 12, value: 120 }])
  const r = buildReturns(trades, proventos, pf)
  const a = r.assets.find((x) => x.ticker === 'A')!
  expect(a.gain.toString()).toBe('54') // 0 de valor + 150 vendido + 4 proventos − 100 investido
  expect(r.assets.find((x) => x.ticker === 'B')!.gain.toString()).toBe('20')
  expect(r.total.gain.toString()).toBe('74')
  expect(r.patrimony.contributed.toString()).toBe('50') // 200 comprado − 150 vendido
  expect(r.patrimony.growth.toString()).toBe('70') // 120 de valor − 50
  expect(r.patrimony.growthPct!.toString()).toBe('1.4')
  expect(r.contributions.at(-1)!.cumulative.toString()).toBe('50') // 100 + 100 − 150
})

test('ativo aberto sem preço na Posição fica de fora e é listado', () => {
  const trades = [t('2023-01-01', 'buy', 'X', 1, 10)]
  const r = buildReturns(trades, [], buildPortfolio(computePositions(trades), []))
  expect(r.excluded).toEqual(['X'])
  expect(r.assets).toHaveLength(0)
})
