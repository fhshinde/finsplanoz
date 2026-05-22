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
   Bars: each YEAR's outflows, growing with inflation (annual flows, not cumulative).
   Saved: cumulative running total (so it visually accumulates positive).
   Lines: portfolio (compounds + savings reinvested) and property equity. */
export function propertyTimeSeries(opts: {
  inputs: PropertyInputs;
  startPortfolioAud: number;
  insuranceAud: number;
  netHouseholdIncome: number;
  totalTaxPaid: number;
  annualLifestyle: number;
  portfolioReturn?: number;
  rentMonthly?: number;
  active?: boolean;
  inflation?: number;          // annual inflation, e.g. 0.03
}) {
  const { inputs: p, startPortfolioAud, insuranceAud, netHouseholdIncome, totalTaxPaid, annualLifestyle } = opts;
  const portReturn = opts.portfolioReturn ?? 0.07;
  const inflation = opts.inflation ?? 0.03;
  const active = opts.active ?? true;
  const rentAnnual = (opts.rentMonthly ?? 5_000) * 12;
  const a = propertyAnalysis(p);

  const m = mortgageMonthly(a.loan, p.rate, 30);
  const rMonth = p.rate / 100 / 12;
  let remainingLoan = a.loan;

  // Portfolio starts intact at year 0 (still renting). Purchase happens between y=0 and y=1.
  let portfolio = startPortfolioAud;
  let cumSaved = 0;

  const rows: Array<{
    year: number;
    Tax: number;
    Housing: number;
    Lifestyle: number;
    NetIncome: number;
    Saved: number;
    portfolio: number;
    property: number;
    netWorth: number;
  }> = [];

  for (let y = 0; y <= p.years; y++) {
    const inflFactor = Math.pow(1 + inflation, y);
    const taxYear = totalTaxPaid * inflFactor;
    const lifestyleYear = annualLifestyle * inflFactor;

    // Year 0 = rent baseline. Year 1+ = mortgage (if active). Mortgage P+I is fixed; the rest inflates.
    const isOwning = active && y >= 1;
    const housingYear = isOwning
      ? a.annualMortgage + (a.bodyCorp + a.maintenance + a.insurance) * inflFactor - a.annualRentIn
      : rentAnnual * inflFactor;

    const netIncomeYear = netHouseholdIncome * inflFactor;
    const savedThisYear = netIncomeYear - housingYear - lifestyleYear;

    if (y === 1 && active) {
      // Year-1 transition: deduct upfront from portfolio when purchase commits
      portfolio = Math.max(0, portfolio - a.upfront);
    }
    if (y > 0) {
      if (isOwning) {
        for (let mi = 0; mi < 12; mi++) {
          const interest = remainingLoan * rMonth;
          const principal = m - interest;
          remainingLoan = Math.max(0, remainingLoan - principal);
        }
      }
      portfolio = portfolio * (1 + portReturn) + Math.max(0, savedThisYear);
      cumSaved += Math.max(0, savedThisYear);
    }

    const propertyVal = isOwning ? p.price * Math.pow(1 + p.growth / 100, y) : 0;
    const equity = isOwning ? propertyVal - remainingLoan : 0;

    rows.push({
      year: new Date().getFullYear() + y,
      Tax: -Math.round(taxYear),
      Housing: -Math.round(housingYear),
      Lifestyle: -Math.round(lifestyleYear),
      NetIncome: Math.round(netIncomeYear),
      Saved: Math.round(cumSaved),
      portfolio: Math.round(portfolio),
      property: Math.round(equity),
      netWorth: Math.round(portfolio + insuranceAud + equity),
    });
  }

  return { rows };
}

/* ───────── Property simulator ───────── */
export function propertyAnalysis(p: PropertyInputs) {
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

/* ───────── AU income tax (2025-26 resident) — per ATO ─────────
 * Sources:
 *  • Brackets: ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents
 *  • Medicare levy: ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy
 *  • Medicare Levy Surcharge: ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge
 *  • LITO: ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets/low-income-tax-offset
 */
export type AuTaxOpts = {
  hasPHI?: boolean;             // Private Hospital Insurance — true => no MLS
  mlsHouseholdIncome?: number;  // combined household income for MLS-tier lookup (family). If absent, treat as single.
  isFamily?: boolean;           // use family MLS thresholds; default false (single)
};

export function auTax(income: number, opts: AuTaxOpts = {}) {
  // 2025-26 stage-3 brackets (unchanged from 2024-25)
  const bands = [
    { upto: 18_200,  rate: 0,    base: 0,      over: 0       },
    { upto: 45_000,  rate: 0.16, base: 0,      over: 18_200  },
    { upto: 135_000, rate: 0.30, base: 4_288,  over: 45_000  },
    { upto: 190_000, rate: 0.37, base: 31_288, over: 135_000 },
    { upto: Infinity,rate: 0.45, base: 51_638, over: 190_000 },
  ];
  const b = bands.find(x => income <= x.upto)!;
  let incTax = b.base + (income - b.over) * b.rate;

  // LITO — max $700; phase 1: −5c/$1 over $37,500; phase 2: −1.5c/$1 over $45,000
  let lito = 0;
  if (income <= 37_500) lito = 700;
  else if (income <= 45_000) lito = 700 - (income - 37_500) * 0.05;   // → 325 at 45k
  else if (income <= 66_667) lito = 325 - (income - 45_000) * 0.015;  // → 0 at 66,667
  incTax = Math.max(0, incTax - lito);

  // Medicare levy — shade-in between lower ($28,011) and upper (28,011/0.8 = $35,013.75)
  // Above upper threshold: full 2% of taxable income. Below lower: 0.
  const LOW = 28_011;
  const UP  = LOW / 0.8; // 35,013.75
  let medicare = 0;
  if (income >= UP) medicare = income * 0.02;
  else if (income > LOW) medicare = (income - LOW) * 0.10; // 10c/$1 shade-in

  // Medicare Levy Surcharge — only if no PHI. Tier rate applies to ENTIRE income (not just over threshold).
  // 2025-26 thresholds: singles 101k/118k/158k, family 202k/236k/314k (Tier1/2/3).
  let mls = 0;
  if (opts.hasPHI === false) {
    const mlsIncome = opts.mlsHouseholdIncome ?? income;
    const thr = opts.isFamily
      ? [202_000, 236_000, 314_000]
      : [101_000, 118_000, 158_000];
    let rate = 0;
    if (mlsIncome > thr[2]) rate = 0.015;
    else if (mlsIncome > thr[1]) rate = 0.0125;
    else if (mlsIncome > thr[0]) rate = 0.01;
    mls = income * rate;
  }

  const total = incTax + medicare + mls;
  return { incTax, lito, medicare, mls, total, net: income - total };
}
