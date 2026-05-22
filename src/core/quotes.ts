// Optional live quote refresh via Finnhub (free tier: 60 calls/min, CORS-enabled).
// User adds VITE_FINNHUB_API_KEY to .env.local to enable. Otherwise the
// "Refresh quotes" button is hidden.

const KEY = (import.meta as any).env?.VITE_FINNHUB_API_KEY as string | undefined;
const BASE = 'https://finnhub.io/api/v1';

export const hasFinnhub = () => !!KEY;

export type Quote = { symbol: string; price: number; changePct?: number; fetchedAt: string };

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Finnhub returns: { c: current, d: change, dp: change%, h, l, o, pc, t }
    if (typeof data?.c !== 'number' || data.c === 0) return null;
    return {
      symbol,
      price: data.c,
      changePct: typeof data.dp === 'number' ? data.dp : undefined,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  // Sequential to stay under free-tier rate limit (60/min)
  const out: Quote[] = [];
  for (const sym of symbols) {
    const q = await fetchQuote(sym);
    if (q) out.push(q);
    await new Promise(r => setTimeout(r, 50));
  }
  return out;
}
