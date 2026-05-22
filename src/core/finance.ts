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

export function nswStampDuty(price: number) {
  const band = NSW_DUTY_BANDS.find(b => price <= b.upto)!;
  return band.base + (price - band.over) * band.marginal;
}

/* ───────── Mortgage (FIXED) — monthly compounding, 30-year term ───────── */
export function mortgageMonthly(loan: number, annualRate: number, years = 30) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function mortgageAmortise(loan: number, annualRate: number, years = 30) {
  const monthly = mortgageMonthly(loan, annualRate, years);
  const totalPaid = monthly * years * 12;
  return { monthly, annual: monthly * 12, totalPaid, totalInterest: totalPaid - loan };
}

/* ───────── Property year-by-year time series ─────────
   Returns one row per year with the values the Tax tab's charts actually consume:
   Housing/Lifestyle (cashflow bars), NetIncome (cashflow bar), property (equity line). */
export function propertyTimeSeries(opts: {
  inputs: PropertyInputs;
  startPortfolioAud: number;
  insuranceAud: number;
  netHouseholdIncome: number;
  annualLifestyle: number;
  portfolioReturn?: number;
  rentMonthly?: number;
  active?: boolean;
  inflation?: number;          // annual inflation, e.g. 0.03
}) {
  const { inputs: p, netHouseholdIncome, annualLifestyle } = opts;
  const inflation = opts.inflation ?? 0.03;
  const active = opts.active ?? true;
  const rentAnnual = (opts.rentMonthly ?? 5_000) * 12;
  const a = propertyAnalysis(p);

  const m = mortgageMonthly(a.loan, p.rate, 30);
  const rMonth = p.rate / 100 / 12;
  let remainingLoan = a.loan;

  const rows: Array<{
    year: number;
    Housing: number;
    Lifestyle: number;
    NetIncome: number;
    property: number;
  }> = [];

  for (let y = 0; y <= p.years; y++) {
    const inflFactor = Math.pow(1 + inflation, y);
    const lifestyleYear = annualLifestyle * inflFactor;

    // Year 0 = rent baseline. Year 1+ = mortgage (if active). Mortgage P+I is fixed; the rest inflates.
    const isOwning = active && y >= 1;
    const housingYear = isOwning
      ? a.annualMortgage + (a.bodyCorp + a.maintenance + a.insurance) * inflFactor - a.annualRentIn
      : rentAnnual * inflFactor;

    const netIncomeYear = netHouseholdIncome * inflFactor;

    if (y > 0 && isOwning) {
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
      Housing: -Math.round(housingYear),
      Lifestyle: -Math.round(lifestyleYear),
      NetIncome: Math.round(netIncomeYear),
      property: Math.round(equity),
    });
  }

  return { rows };
}

/* ───────── Property simulator ───────── */
export function propertyAnalysis(p: PropertyInputs) {
  // Price = 0 means no transaction — no purchase, no carrying costs, no $15K legal.
  if (p.price <= 0) {
    return {
      deposit: 0, loan: 0, stampDuty: 0, upfront: 0,
      annualMortgage: 0, bodyCorp: 0, maintenance: 0, insurance: 0, annualRentIn: 0,
      annualHolding: 0,
      totalInterest: 0,
      futureValue: 0, remainingLoan: 0, equity: 0,
    };
  }

  const deposit = p.price * (p.depositPct / 100);
  const loan = p.price - deposit;
  const stampDuty = nswStampDuty(p.price);
  const upfront = deposit + stampDuty + 15_000; // legal
  const { annual: annualMortgage, totalInterest } = mortgageAmortise(loan, p.rate, 30);

  const bodyCorp = 3_000;
  const maintenance = p.price * 0.005;
  const insurance = 2_500;
  const annualRentIn = p.price * (p.yieldPct / 100);
  const annualHolding = annualMortgage + bodyCorp + maintenance + insurance - annualRentIn;

  // Property exit
  const futureValue = p.price * Math.pow(1 + p.growth / 100, p.years);

  // Remaining loan after years (amortising)
  const r = p.rate / 100 / 12;
  const months = p.years * 12;
  const m = mortgageMonthly(loan, p.rate, 30);
  let remaining = loan;
  for (let i = 0; i < months; i++) {
    const interest = remaining * r;
    const principal = m - interest;
    remaining = Math.max(0, remaining - principal);
  }
  const equity = futureValue - remaining;

  return {
    deposit, loan, stampDuty, upfront,
    annualMortgage, bodyCorp, maintenance, insurance, annualRentIn,
    annualHolding,
    totalInterest,
    futureValue, remainingLoan: remaining, equity,
  };
}

