// Schwab "Positions" CSV import.
// Schwab's positions export has a few header rows of metadata, then a row that
// looks like: "Symbol","Description","Quantity","Price","Price Change %",...,"Market Value","Cost Basis",...
// We're permissive: find a row containing both "Symbol" and "Quantity", treat that as header.

import type { Holding } from './types';

function unquote(s: string) {
  return s.trim().replace(/^"|"$/g, '').replace(/^\$/, '').replace(/,/g, '');
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV parser handling quoted fields with commas.
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const ETF_TICKERS = new Set(['SMH','AIPO','VGT','SCHD','VOO','VXUS','BOTZ','BND','SPY','QQQ','VTI','VEA','VWO','IVV','IWM','EEM']);

function inferSector(symbol: string): string {
  const techStocks = ['NVDA','MSFT','AAPL','GOOG','GOOGL','META','MRVL','AMD','AVGO','ASML','CRM','ADBE','ORCL'];
  const techEtfs = ['VGT','SMH','XLK','SOXX','SMIN'];
  if (techEtfs.includes(symbol)) return 'Technology (ETF)';
  if (symbol === 'AIPO' || symbol === 'BOTZ') return 'AI/Robotics (ETF)';
  if (symbol === 'SCHD' || symbol === 'VYM' || symbol === 'DGRO') return 'Dividend (ETF)';
  if (symbol === 'VOO' || symbol === 'SPY' || symbol === 'IVV') return 'US Total (ETF)';
  if (symbol === 'VXUS' || symbol === 'VEA' || symbol === 'IXUS') return 'Intl (ETF)';
  if (symbol === 'BND' || symbol === 'AGG' || symbol === 'BNDX') return 'Bonds (ETF)';
  if (techStocks.includes(symbol)) return 'Technology';
  if (['UNH','JNJ','PFE','LLY','ABBV'].includes(symbol)) return 'Healthcare';
  if (['TSLA','AMZN','NKE','MCD','HD'].includes(symbol)) return 'Consumer Discretionary';
  return 'Other';
}

export type ParseResult = {
  holdings: Holding[];
  cashUsd?: number;
  warnings: string[];
};

export function parseSchwabCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const warnings: string[] = [];

  // Locate header row
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]).map(c => c.toLowerCase());
    if (cols.includes('symbol') && cols.some(c => c.startsWith('quantity'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    warnings.push('Could not locate header row containing Symbol + Quantity. Expected Schwab Positions CSV format.');
    return { holdings: [], warnings };
  }

  const header = parseCsvLine(lines[headerIdx]).map(c => unquote(c).toLowerCase());
  const idx = {
    symbol: header.findIndex(h => h === 'symbol'),
    qty: header.findIndex(h => h.startsWith('quantity') || h === 'qty'),
    price: header.findIndex(h => h === 'price'),
    value: header.findIndex(h => h.includes('market value') || h.includes('value')),
  };

  const holdings: Holding[] = [];
  let cashUsd: number | undefined;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]).map(c => unquote(c));
    const sym = cols[idx.symbol]?.trim().toUpperCase();
    if (!sym) continue;

    if (sym === 'CASH' || sym === 'CASH & CASH INVESTMENTS' || sym.includes('CASH')) {
      const v = parseFloat(cols[idx.value]?.replace(/[^0-9.\-]/g, '') ?? '');
      if (!isNaN(v)) cashUsd = v;
      continue;
    }
    if (sym === 'ACCOUNT TOTAL' || sym.startsWith('TOTAL') || sym === 'N/A') continue;
    if (!/^[A-Z]{1,5}$/.test(sym)) continue; // skip option tickers, footnotes

    const qty = parseFloat(cols[idx.qty]?.replace(/[^0-9.\-]/g, '') ?? '');
    const price = parseFloat(cols[idx.price]?.replace(/[^0-9.\-]/g, '') ?? '');
    if (isNaN(qty) || isNaN(price)) {
      warnings.push(`Skipped ${sym}: could not parse quantity/price.`);
      continue;
    }
    holdings.push({
      symbol: sym,
      qty,
      price,
      sector: inferSector(sym),
      kind: ETF_TICKERS.has(sym) ? 'etf' : 'stock',
    });
  }

  if (holdings.length === 0) warnings.push('No holdings parsed. Check that the CSV is a Schwab Positions export.');
  return { holdings, cashUsd, warnings };
}
