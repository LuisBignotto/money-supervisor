import type Decimal from 'decimal.js'

/** Datas em ISO `aaaa-mm-dd`. */
export interface Trade {
  date: string
  ticker: string
  side: 'buy' | 'sell'
  quantity: Decimal
  price: Decimal
}

/** Desdobro/bonificação (delta > 0) ou grupamento (delta < 0): muda a quantidade, o custo total não muda. */
export interface QuantityAdjust {
  date: string
  ticker: string
  delta: Decimal
}

export type ProventoType = 'dividend' | 'jcp' | 'income'

export interface Provento {
  date: string
  ticker: string
  type: ProventoType
  gross: Decimal
  tax: Decimal
}

export interface Position {
  ticker: string
  quantity: Decimal
  /** Custo total da posição aberta. */
  cost: Decimal
  /** Preço médio = cost / quantity (0 se zerada). */
  avgPrice: Decimal
  /** Lucro/prejuízo já realizado em vendas. */
  realized: Decimal
}
