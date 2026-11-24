import Decimal from 'decimal.js'
import type { Position, QuantityAdjust, Trade } from './types'

type Op = ({ kind: 'trade' } & Trade) | ({ kind: 'adjust' } & QuantityAdjust)

/**
 * Replay cronológico de negociações e ajustes de quantidade -> posição por ticker (preço médio).
 * Mesmo dia: ordem de entrada (sort estável).
 * ponytail: sem taxas/emolumentos no custo; somar ao custo de compra se quiser bater com o PM da B3.
 */
export function computePositions(trades: Trade[], adjusts: QuantityAdjust[] = []): Map<string, Position> {
  const ops: Op[] = [
    ...trades.map((t) => ({ kind: 'trade' as const, ...t })),
    ...adjusts.map((s) => ({ kind: 'adjust' as const, ...s })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const out = new Map<string, Position>()
  for (const op of ops) {
    const p = out.get(op.ticker) ?? {
      ticker: op.ticker,
      quantity: new Decimal(0),
      cost: new Decimal(0),
      avgPrice: new Decimal(0),
      realized: new Decimal(0),
    }
    if (op.kind === 'adjust') {
      p.quantity = p.quantity.plus(op.delta) // custo total não muda
    } else if (op.side === 'buy') {
      p.quantity = p.quantity.plus(op.quantity)
      p.cost = p.cost.plus(op.quantity.times(op.price))
    } else {
      if (op.quantity.gt(p.quantity)) {
        throw new Error(`Venda de ${op.quantity} ${op.ticker} em ${op.date} excede a posição (${p.quantity})`)
      }
      const soldCost = op.quantity.times(p.avgPrice)
      p.realized = p.realized.plus(op.quantity.times(op.price).minus(soldCost))
      p.quantity = p.quantity.minus(op.quantity)
      p.cost = p.cost.minus(soldCost)
    }
    p.avgPrice = p.quantity.isZero() ? new Decimal(0) : p.cost.div(p.quantity)
    out.set(op.ticker, p)
  }
  return out
}
