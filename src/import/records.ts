export type Kind = 'negociacao' | 'movimentacao'
export type Cell = string | number | null

/** Linha crua da B3, com datas em ISO e "-" -> null. Nada é descartado aqui. */
export interface RawRecord {
  id: string
  kind: Kind
  fields: Record<string, Cell>
}

const HEADERS: Record<Kind, string[]> = {
  negociacao: ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Prazo/Vencimento', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor'],
  movimentacao: ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
}
const DATE_COLS = new Set(['Data do Negócio', 'Prazo/Vencimento', 'Data'])

const toIso = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function cell(col: string, v: unknown, where: string): Cell {
  if (v === null || v === undefined || v === '' || v === '-') return null
  if (DATE_COLS.has(col)) {
    const iso = typeof v === 'string' ? toIso(v.trim()) : null
    if (!iso) throw new Error(`${where}: data inválida em "${col}": ${String(v)}`)
    return iso
  }
  if (typeof v === 'number' || typeof v === 'string') return typeof v === 'string' ? v.trim() : v
  throw new Error(`${where}: valor inesperado em "${col}": ${String(v)}`)
}

/**
 * rows = matriz da planilha (1ª linha = cabeçalho). Valida o layout e falha alto se mudou.
 * id = campos + "#n", onde n é a ocorrência da linha idêntica no arquivo: preserva linhas
 * legitimamente repetidas e, ao reimportar (mesmo com períodos sobrepostos), gera os mesmos ids.
 * Vale porque a granularidade é diária: um arquivo contém todas as linhas dos dias que cobre.
 */
export function parseRecords(kind: Kind, rows: unknown[][]): RawRecord[] {
  const expected = HEADERS[kind]
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim())
  const missing = expected.filter((h) => !header.includes(h))
  if (missing.length) throw new Error(`Layout de ${kind} mudou; colunas ausentes: ${missing.join(', ')}`)

  const seen = new Map<string, number>()
  const out: RawRecord[] = []
  rows.slice(1).forEach((row, i) => {
    if (row.every((c) => c === null || c === undefined || c === '')) return
    const where = `${kind}, linha ${i + 2}`
    const fields: Record<string, Cell> = {}
    for (const col of expected) fields[col] = cell(col, row[header.indexOf(col)], where)
    const key = `${kind}|${expected.map((c) => fields[c] ?? '').join('|')}`
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    out.push({ id: `${key}#${n}`, kind, fields })
  })
  return out
}
