import { expect, test } from 'vitest'
import { computePositions } from '../domain/positions'
import { derive } from './normalize'
import { parsePosicao } from './posicao'
import { parseRecords } from './records'

const NEG = ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Prazo/Vencimento', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor']
const MOV = ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação']
const neg = (date: string, tipo: string, code: string, q: number, p: number) => [date, tipo, 'Mercado à Vista', '-', 'CORRETORA', code, q, p, q * p]
const mov = (date: string, tipo: string, prod: string, q: number, p: number | string, v: number | string, io = 'Credito') => [io, date, tipo, prod, 'CORRETORA', q, p, v]

test('reimportar o mesmo arquivo gera exatamente os mesmos ids', () => {
  const rows = [NEG, neg('09/11/2026', 'Compra', 'AAAA11', 10, 5)]
  expect(parseRecords('negociacao', rows).map((r) => r.id)).toEqual(parseRecords('negociacao', rows).map((r) => r.id))
})

test('períodos sobrepostos: união por id, sem duplicar e sem perder', () => {
  const a = [NEG, neg('10/01/2026', 'Compra', 'AAAA11', 1, 5), neg('10/02/2026', 'Compra', 'AAAA11', 2, 5)]
  const b = [NEG, neg('10/02/2026', 'Compra', 'AAAA11', 2, 5), neg('10/03/2026', 'Compra', 'AAAA11', 3, 5)]
  const merged = new Map([...parseRecords('negociacao', a), ...parseRecords('negociacao', b)].map((r) => [r.id, r]))
  expect(merged.size).toBe(3)
})

test('linhas idênticas legítimas no mesmo arquivo são preservadas e continuam estáveis na sobreposição', () => {
  const full = [MOV, mov('16/10/2026', 'Transferência', 'FFFF11 - FUNDO', 7, '-', '-'), mov('16/10/2026', 'Transferência', 'FFFF11 - FUNDO', 7, '-', '-')]
  const again = parseRecords('movimentacao', full)
  expect(again.map((r) => r.id)).toHaveLength(2)
  expect(new Set(again.map((r) => r.id)).size).toBe(2)
  const merged = new Map([...parseRecords('movimentacao', full), ...again].map((r) => [r.id, r]))
  expect(merged.size).toBe(2)
})

test('datas viram ISO e "-" vira null', () => {
  const [r] = parseRecords('movimentacao', [MOV, mov('09/11/2026', 'Atualização', 'BBBB3 - BANCO', 100, '-', '-')])
  expect(r.fields['Data']).toBe('2026-11-09')
  expect(r.fields['Valor da Operação']).toBeNull()
})

test('layout mudado e data inválida falham com erro claro', () => {
  expect(() => parseRecords('negociacao', [['Data', 'Preço'], []])).toThrow(/colunas ausentes/)
  expect(() => parseRecords('negociacao', [NEG, neg('2026-11-09', 'Compra', 'A', 1, 1)])).toThrow(/data inválida/)
})

test('derive: fracionário = mesmo ticker; Transferência - Liquidação não duplica o negócio', () => {
  const records = [
    ...parseRecords('negociacao', [NEG, neg('09/11/2026', 'Compra', 'AAAA11', 10, 5), neg('10/11/2026', 'Compra', 'BBBB3F', 3, 10), neg('11/11/2026', 'Compra', 'BBBB3', 7, 10)]),
    ...parseRecords('movimentacao', [MOV, mov('11/11/2026', 'Transferência - Liquidação', 'AAAA11 - FUNDO', 10, 5, 50)]),
  ]
  const { trades } = derive(records)
  expect(trades).toHaveLength(3)
  expect(computePositions(trades).get('BBBB3')!.quantity.toString()).toBe('10')
})

test('derive: Tesouro (Compra/Resgate), proventos por tipo e Desdobro', () => {
  const { trades, proventos, adjusts } = derive(
    parseRecords('movimentacao', [
      MOV,
      mov('10/11/2026', 'Compra', 'Tesouro Selic 2029', 0.3, 100, 30),
      mov('11/11/2026', 'Resgate', 'Tesouro Selic 2029', 0.1, 110, 11, 'Debito'),
      mov('13/11/2026', 'Rendimento', 'FFFF11 - FUNDO', 100, 1.5, 150),
      mov('11/09/2026', 'Juros Sobre Capital Próprio', 'BBBB3 - BANCO', 200, 0.1, 20),
      mov('15/05/2025', 'Dividendo', 'CCCC3 - EMPRESA', 100, 0.5, 50),
      mov('17/04/2024', 'Desdobro', 'BBBB3 - BANCO', 20, '-', '-'),
    ]),
  )
  expect(trades.map((t) => t.side)).toEqual(['buy', 'sell'])
  expect(proventos.map((p) => p.type).sort()).toEqual(['dividend', 'income', 'jcp'])
  expect(adjusts[0].delta.toString()).toBe('20')
})

test('posição: ignora linhas em branco/Total; Tesouro usa o nome e calcula o preço', () => {
  const sheets = [
    { sheet: 'Fundo de Investimento', data: [['Produto', 'Código de Negociação', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'], ['FFFF11 - FUNDO', 'FFFF11', 10, 100, 1000], [''], ['', '', '', 'Total'], ['', '', '', '', 24684]] },
    { sheet: 'Tesouro Direto', data: [['Produto', 'Quantidade', 'Valor Atualizado'], ['Tesouro Selic 2029', 0.15, 3000]] },
  ]
  const s = parsePosicao(sheets, '2026-11-22')
  expect(s.map((x) => x.ticker)).toEqual(['FFFF11', 'Tesouro Selic 2029'])
  expect(s[1].price).toBe(20000)
  expect(s[0].id).toBe('2026-11-22|Fundo de Investimento|FFFF11')
})
