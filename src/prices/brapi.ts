export interface Quote {
  ticker: string
  price: number
  /** Horário da cotação (ISO), informado pela brapi. */
  time: string
}

export const hasToken = () => Boolean(import.meta.env.VITE_BRAPI_TOKEN)
/** Só ativos de bolsa têm cotação (Tesouro não: continua com o preço da Posição). */
export const isListed = (ticker: string) => /^[A-Z]{4}\d{1,2}$/.test(ticker)

export async function fetchQuote(ticker: string, token: string): Promise<Quote> {
  const res = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = (await res.json().catch(() => null)) as { message?: string; results?: { regularMarketPrice?: unknown; regularMarketTime?: string }[] } | null
  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`)
  const r = body?.results?.[0]
  if (typeof r?.regularMarketPrice !== 'number' || !r.regularMarketTime) throw new Error('resposta sem preço')
  return { ticker, price: r.regularMarketPrice, time: r.regularMarketTime }
}

/**
 * Um ativo por vez: o plano gratuito limita a 1 ativo por requisição e 1 requisição simultânea.
 * Falha de um ticker não derruba os outros; os erros voltam por ticker.
 * ponytail: sequencial; com plano pago (até 10 por requisição) dá para agrupar.
 */
export async function fetchQuotes(tickers: string[], token: string): Promise<{ quotes: Quote[]; errors: Record<string, string> }> {
  const quotes: Quote[] = []
  const errors: Record<string, string> = {}
  for (const t of tickers) {
    try {
      quotes.push(await fetchQuote(t, token))
    } catch (e) {
      errors[t] = e instanceof Error ? e.message : String(e)
    }
  }
  return { quotes, errors }
}
