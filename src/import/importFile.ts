import readSheets from 'read-excel-file/browser'
import { parsePosicao } from './posicao'
import { parseRecords } from './records'
import { saveRecords, saveSnapshots, type ImportResult } from '../storage/db'

const NAME = /^(negociacao|movimentacao|posicao)-(\d{4}-\d{2}-\d{2})/i

/** Detecta o tipo pelo nome do arquivo exportado da B3 e grava. Lança erro claro se não reconhecer/validar. */
export async function importFile(file: File): Promise<ImportResult & { label: string }> {
  const m = NAME.exec(file.name)
  if (!m) throw new Error('Nome não reconhecido (esperado negociacao-…, movimentacao-… ou posicao-…)')
  const kind = m[1].toLowerCase()
  const sheets = (await readSheets(file)) as { sheet: string; data: unknown[][] }[]
  if (kind === 'posicao') {
    const r = await saveSnapshots(parsePosicao(sheets, m[2]))
    return { ...r, label: `Posição de ${m[2].split('-').reverse().join('/')}` }
  }
  const k = kind as 'negociacao' | 'movimentacao'
  const r = await saveRecords(parseRecords(k, sheets[0].data))
  return { ...r, label: k === 'negociacao' ? 'Negociação' : 'Movimentação' }
}
