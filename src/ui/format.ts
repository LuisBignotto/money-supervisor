import type Decimal from 'decimal.js'

// Só formatação (exibição): cálculos continuam em Decimal.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const qty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

export const brlNumber = (n: number) => brl.format(n)
export const money = (d: Decimal | null) => (d ? brl.format(d.toNumber()) : '—')
export const percent = (d: Decimal | null) => (d ? pct.format(d.toNumber()) : '—')
export const quantity = (d: Decimal) => qty.format(d.toNumber())
