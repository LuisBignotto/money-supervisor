import Decimal from 'decimal.js'
import type { Provento, QuantityAdjust, Trade } from '../domain/types'
import type { RawRecord } from './records'

export interface Derived {
  trades: Trade[]
  proventos: Provento[]
  adjusts: QuantityAdjust[]
}

const dec = (v: unknown) => new Decimal(String(v))
const isTesouro = (produto: string) => !produto.includes(' - ')
/** Fracionário vem como ABCD3F: mesmo ativo de ABCD3. */
const baseTicker = (t: string) => t.replace(/(\d)F$/, '$1')

const PROVENTO = { Rendimento: 'income', Dividendo: 'dividend', 'Juros Sobre Capital Próprio': 'jcp' } as const

/**
 * Registros crus -> domínio. Deriva só o que entra nas contas; o resto continua guardado, sem efeito:
 * - Ações/FIIs/ETFs: Negociação é a fonte (a "Transferência - Liquidação" da Movimentação é o mesmo negócio liquidado).
 * - Tesouro: só existe na Movimentação (Compra/Resgate).
 * - Proventos e Desdobro: Movimentação. Valor de JCP vem líquido do IR -> tax 0 (ponytail: IR de JCP não separado).
 */
export function derive(records: RawRecord[]): Derived {
  const out: Derived = { trades: [], proventos: [], adjusts: [] }
  for (const { kind, fields: f } of records) {
    if (kind === 'negociacao') {
      out.trades.push({
        date: f['Data do Negócio'] as string,
        ticker: baseTicker(f['Código de Negociação'] as string),
        side: f['Tipo de Movimentação'] === 'Venda' ? 'sell' : 'buy',
        quantity: dec(f['Quantidade']),
        price: dec(f['Preço']),
      })
      continue
    }
    const tipo = f['Movimentação'] as string
    const produto = f['Produto'] as string
    const date = f['Data'] as string
    if (isTesouro(produto) && (tipo === 'Compra' || tipo === 'Resgate')) {
      out.trades.push({ date, ticker: produto, side: tipo === 'Compra' ? 'buy' : 'sell', quantity: dec(f['Quantidade']), price: dec(f['Preço unitário']) })
    } else if (tipo in PROVENTO) {
      out.proventos.push({ date, ticker: baseTicker(produto.split(' - ')[0]), type: PROVENTO[tipo as keyof typeof PROVENTO], gross: dec(f['Valor da Operação']), tax: new Decimal(0) })
    } else if (tipo === 'Desdobro') {
      out.adjusts.push({ date, ticker: baseTicker(produto.split(' - ')[0]), delta: dec(f['Quantidade']) })
    }
  }
  return out
}
