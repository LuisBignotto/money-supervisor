import { openDB } from 'idb'
import type { RawRecord } from '../import/records'
import type { Snapshot } from '../import/posicao'
import type { Quote } from '../prices/brapi'

const db = openDB('money-supervisor', 2, {
  upgrade(d, oldVersion) {
    if (oldVersion < 1) {
      d.createObjectStore('records', { keyPath: 'id' })
      d.createObjectStore('snapshots', { keyPath: 'id' })
    }
    if (oldVersion < 2) d.createObjectStore('quotes', { keyPath: 'ticker' })
  },
})

export interface ImportResult {
  added: number
  existing: number
}

/** Upsert por id numa única transação: idempotente, nunca apaga nada. */
async function upsert(store: 'records' | 'snapshots', items: { id: string }[]): Promise<ImportResult> {
  const d = await db
  const tx = d.transaction(store, 'readwrite')
  const existing = new Set((await tx.store.getAllKeys()) as string[])
  let added = 0
  for (const it of items) {
    if (!existing.has(it.id)) added++
    await tx.store.put(it)
  }
  await tx.done
  return { added, existing: items.length - added }
}

export const saveRecords = (r: RawRecord[]) => upsert('records', r)
export const saveSnapshots = (s: Snapshot[]) => upsert('snapshots', s)
export const loadRecords = async () => (await db).getAll('records') as Promise<RawRecord[]>
export const loadSnapshots = async () => (await db).getAll('snapshots') as Promise<Snapshot[]>

/** Cotação mais recente por ticker (sobrescreve; o histórico de preços não é guardado). */
export async function saveQuotes(q: Quote[]) {
  const tx = (await db).transaction('quotes', 'readwrite')
  for (const x of q) await tx.store.put(x)
  await tx.done
}
export const loadQuotes = async () => (await db).getAll('quotes') as Promise<Quote[]>
