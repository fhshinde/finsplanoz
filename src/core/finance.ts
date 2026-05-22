/* ───────── Property scenario inputs ───────── */
export type PropertyInputs = {
  price: number;
  depositPct: number;
  rate: number;
  growth: number;
  years: number;
  yieldPct: number;
};

/* ───────── NSW progressive stamp duty (PPR, owner-occupied) — 2025/26 bands ───────── */
const NSW_DUTY_BANDS: Array<{ upto: number; base: number; marginal: number; over: number }> = [
  { upto: 17_000,    base: 0,       marginal: 0.0125, over: 0 },
  { upto: 36_000,    base: 213,     marginal: 0.015,  over: 17_000 },
  { upto: 97_000,    base: 498,     marginal: 0.0175, over: 36_000 },
  { upto: 364_000,   base: 1_564,   marginal: 0.035,  over: 97_000 },
  { upto: 1_212_000, base: 10_909,  marginal: 0.045,  over: 364_000 },
  { upto: 3_636_000, base: 49_069,  marginal: 0.055,  over: 1_212_000 },
  { upto: Infinity,  base: 182_389, marginal: 0.07,   over: 3_636_000 },
];

function nswStampDuty(price: number) {
  const band = NSW_DUTY_BANDS.find(b => price <= b.upto)!;
  return band.base + (price - band.over) * band.marginal;
}

/* ───────── Mortgage payment — monthly compounding, 30-year term ───────── */
function mortgageMonthly(loan: number, annualRate: number, years = 30) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/* ───────── Property scenario — upfront cost and loan principal ─────────
   Price = 0 means no transaction (no $15K legal, no deposit, no duty). */
export function propertyAnalysis(p: PropertyInputs) {
  if (p.price <= 0) return { loan: 0, upfront: 0 };
  const deposit = p.price * (p.depositPct / 100);
  const loan = p.price - deposit;
  const upfront = deposit + nswStampDuty(p.price) + 15_000; // legal
  return { loan, upfront };
}

/* ───────── Property equity year-by-year ─────────
   Returns the year axis and the property equity each year (market value
   minus remaining loan balance). With active=false equity is 0 throughout. */
export function propertyTimeSeries(opts: { inputs: PropertyInputs; active?: boolean }) {
  const { inputs: p } = opts;
  const active = opts.active ?? true;
  const { loan } = propertyAnalysis(p);

  const m = mortgageMonthly(loan, p.rate, 30);
  const rMonth = p.rate / 100 / 12;
  let remainingLoan = loan;

  const rows: Array<{ year: number; property: number }> = [];

  for (let y = 0; y <= p.years; y++) {
    const isOwning = active && y >= 1;

    if (isOwning) {
      for (let mi = 0; mi < 12; mi++) {
        const interest = remainingLoan * rMonth;
        const principal = m - interest;
        remainingLoan = Math.max(0, remainingLoan - principal);
      }
    }

    const propertyVal = isOwning ? p.price * Math.pow(1 + p.growth / 100, y) : 0;
    const equity = isOwning ? propertyVal - remainingLoan : 0;

    rows.push({
      year: new Date().getFullYear() + y,
      property: Math.round(equity),
    });
  }

  return { rows };
}
