import Decimal from 'decimal.js'
import { expect, test } from 'vitest'
import { buildEvolution, pricePoints } from './evolution'
import type { Provento, Trade } from './types'

const d = (v: number | string) => new Decimal(v)
const t = (date: string, side: 'buy' | 'sell', q: number, p: number): Trade => ({ date, side, ticker: 'A', quantity: d(q), price: d(p) })

test('patrimônio = qtd × último preço conhecido; aportado líquido; proventos acumulados; meses sem buraco', () => {
  const trades = [t('2024-01-10', 'buy', 10, 10), t('2024-03-05', 'buy', 10, 12), t('2024-03-20', 'sell', 5, 14)]
  const prov: Provento[] = [{ date: '2024-02-15', ticker: 'A', type: 'dividend', gross: d(3), tax: d(0) }]
  const snaps = [{ date: '2024-02-29', ticker: 'A', price: 11 }]
  const ev = buildEvolution(trades, [], prov, pricePoints(trades, snaps, []), '2024-04-15')

  expect(ev.map((e) => e.month)).toEqual(['2024-01', '2024-02', '2024-03', '2024-04'])
  expect(ev[0].value.toString()).toBe('100') // 10 × 10 (preço do negócio)
  expect(ev[1].value.toString()).toBe('110') // 10 × 11 (Posição de fim de fevereiro)
  expect(ev[1].dividends.toString()).toBe('3')
  expect(ev[2].invested.toString()).toBe('150') // 100 + 120 − 70
  expect(ev[2].value.toString()).toBe('210') // 15 × 14 (último negócio)
  expect(ev[2].gain.toString()).toBe('63') // 210 − 150 + 3
  expect(ev[3].value.toString()).toBe('210') // sem preço novo: mantém o último
})

test('sem negócios, sem série', () => {
  expect(buildEvolution([], [], [], [], '2024-04-15')).toEqual([])
})
