export interface Snapshot {
  id: string
  date: string
  ticker: string
  quantity: number
  price: number | null
  value: number
}

const num = (v: unknown) => (typeof v === 'number' ? v : null)

/**
 * Posição = foto de um dia (a planilha não traz data; vem do nome do arquivo/usuário).
 * id por (data, aba, ticker): reimportar a mesma data sobrescreve, datas diferentes acumulam histórico.
 * Tesouro não tem ticker: usa o nome do produto e preço = valor / quantidade.
 */
export function parsePosicao(sheets: { sheet: string; data: unknown[][] }[], date: string): Snapshot[] {
  const out: Snapshot[] = []
  for (const { sheet, data } of sheets) {
    const header = (data[0] ?? []).map((h) => String(h ?? ''))
    const col = (name: string) => header.indexOf(name)
    const [iProd, iCode, iQty, iPrice, iValue] = ['Produto', 'Código de Negociação', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'].map(col)
    if (iProd < 0 || iQty < 0 || iValue < 0) throw new Error(`Layout da aba "${sheet}" mudou (Produto/Quantidade/Valor Atualizado)`)
    for (const row of data.slice(1)) {
      const product = row[iProd]
      const quantity = num(row[iQty])
      if (typeof product !== 'string' || !product || quantity === null) continue // linhas em branco e "Total"
      const ticker = iCode >= 0 && typeof row[iCode] === 'string' ? (row[iCode] as string) : product
      const value = num(row[iValue])
      if (value === null) throw new Error(`Aba "${sheet}", ${ticker}: valor atualizado inválido`)
      const price = iPrice >= 0 ? num(row[iPrice]) : quantity ? value / quantity : null
      out.push({ id: `${date}|${sheet}|${ticker}`, date, ticker, quantity, price, value })
    }
  }
  return out
}
