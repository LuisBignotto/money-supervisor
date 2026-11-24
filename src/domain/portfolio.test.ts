import Decimal from 'decimal.js'
import { expect, test } from 'vitest'
import { buildPortfolio } from './portfolio'
import { computePositions } from './positions'

const trade = (ticker: string, q: number, p: number) => ({ date: '2024-01-01', ticker, side: 'buy' as const, quantity: new Decimal(q), price: new Decimal(p) })

test('valor/resultado da foto mais recente; status por ativo; totais só com ativos precificados', () => {
  const pos = computePositions([trade('A', 10, 10), trade('B', 5, 10), trade('C', 1, 10), trade('D', 1, 10), { ...trade('D', 1, 12), side: 'sell' as const }])
  const pf = buildPortfolio(pos, [
    { date: '2024-01-01', ticker: 'A', quantity: 10, price: 1, value: 10 }, // foto antiga, ignorada
    { date: '2024-02-01', ticker: 'A', quantity: 10, price: 12, value: 120 },
    { date: '2024-02-01', ticker: 'B', quantity: 4, price: 10, value: 40 },
  ])
  const by = Object.fromEntries(pf.rows.map((r) => [r.ticker, r]))
  expect(pf.snapshotDate).toBe('2024-02-01')
  expect(by.A.result!.toString()).toBe('20')
  expect(by.A.resultPct!.toString()).toBe('0.2')
  expect(by.A.status).toBe('ok')
  expect(by.B.status).toBe('divergente')
  expect(by.C.status).toBe('sem-posicao')
  expect(by.D).toBeUndefined() // posição zerada
  expect(pf.cost.toString()).toBe('150') // A + B; C sem preço fica fora
  expect(pf.value.toString()).toBe('160')
  expect(pf.realized.toString()).toBe('2')
})

test('cotação ao vivo mais nova substitui o preço da Posição; mais antiga é ignorada', () => {
  const pos = computePositions([trade('A', 10, 10), trade('B', 10, 10)])
  const snaps = [
    { date: '2024-02-01', ticker: 'A', quantity: 10, price: 12, value: 120 },
    { date: '2024-02-01', ticker: 'B', quantity: 10, price: 12, value: 120 },
  ]
  const pf = buildPortfolio(pos, snaps, [
    { ticker: 'A', price: 15, time: '2024-03-01T20:00:00.000Z' },
    { ticker: 'B', price: 99, time: '2024-01-15T20:00:00.000Z' }, // anterior à Posição
  ])
  const by = Object.fromEntries(pf.rows.map((r) => [r.ticker, r]))
  expect(by.A.value!.toString()).toBe('150')
  expect(by.A.priceSource).toBe('cotacao')
  expect(by.B.value!.toString()).toBe('120')
  expect(by.B.priceSource).toBe('posicao')
  expect(pf.asOf).toBe('2024-03-01')
})
