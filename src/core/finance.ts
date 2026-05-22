import Decimal from 'decimal.js-light';
import type { Holding, Fx, PropertyInputs, PropertyOwned, Scenario } from './types';
import { COUPLE, NSW_DUTY_BANDS } from './constants';

/* ───────── Currency helpers ─────────
   FX (Google Finance convention):
     aud_usd = USD per AUD  (AUD-USD quote)
     sgd_aud = AUD per SGD  (SGD-AUD quote) */
export const usdToAud = (usd: number, fx: Fx) => usd / fx.aud_usd;
export const audToUsd = (aud: number, fx: Fx) => aud * fx.aud_usd;
export const sgdToAud = (sgd: number, fx: Fx) => sgd * fx.sgd_aud;   // MULTIPLY now
export const audToSgd = (aud: number, fx: Fx) => aud / fx.sgd_aud;

/* ───────── Portfolio ───────── */
export function portfolioUsd(holdings: Holding[], cashUsd: number) {
  return holdings.reduce((s, h) => s + h.qty * h.price, 0) + cashUsd;
}
export function portfolioAud(holdings: Holding[], cashUsd: number, fx: Fx) {
  return usdToAud(portfolioUsd(holdings, cashUsd), fx);
}
export function insuranceAud(fx: Fx) {
  return sgdToAud(COUPLE.insuranceSGD, fx);
}
export function propertyEquityAud(p?: PropertyOwned): number {
  if (!p?.active) return 0;
  return Math.max(0, p.valuation - p.loanBalance);
}
export function netWorthAud(holdings: Holding[], cashUsd: number, fx: Fx, propertyOwned?: PropertyOwned) {
  return portfolioAud(holdings, cashUsd, fx) + insuranceAud(fx) + propertyEquityAud(propertyOwned);
}

/* ───────── Concentration: HHI ───────── */
// Herfindahl–Hirschman Index. Sum of (weight%)^2. 0–10000.
// <1500 diversified, 1500–2500 moderate, >2500 concentrated.
export function hhi(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + h.qty * h.price, 0);
  if (total <= 0) return 0;
  return holdings.reduce((s, h) => {
    const w = (h.qty * h.price) / total * 100;
    return s + w * w;
  }, 0);
}

export function sectorBreakdown(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + h.qty * h.price, 0);
  const map = new Map<string, number>();
  holdings.forEach(h => map.set(h.sector, (map.get(h.sector) ?? 0) + h.qty * h.price));
  return Array.from(map.entries())
    .map(([sector, value]) => ({ sector, value, pct: total ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function topPositions(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + h.qty * h.price, 0);
  return [...holdings]
    .map(h => ({ ...h, value: h.qty * h.price, pct: total ? (h.qty * h.price / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/* ───────── Annual savings ───────── */
// SGD → AUD = divide by sgd_aud (which is SGD per AUD).
// If property is owned, swap rent for property monthly cost; otherwise pay rent.
export function annualSavingsAud(avgMonthlySgd: number, fx: Fx, propertyOwned?: PropertyOwned) {
  const annualSpendAud = sgdToAud(avgMonthlySgd * 12, fx);
  const annualHousing = propertyOwned?.active
    ? (propertyOwned.monthlyCost - propertyOwned.rentalIncome / 12) * 12
    : COUPLE.rentMonthlyAUD * 12;
  return COUPLE.incomeAUD - annualHousing - annualSpendAud;
}

/* ───────── Deterministic projection ───────── */
export function projectBalance(start: number, annualReturn: number, annualSavings: number, years: number) {
  const out: number[] = [start];
  for (let i = 1; i <= years; i++) {
    out.push(out[i - 1] * (1 + annualReturn) + annualSavings);
  }
  return out;
}

export function fireYearFor(start: number, annualReturn: number, annualSavings: number, target: number, baseYear = new Date().getFullYear()) {
  let bal = start;
  for (let y = 0; y < 60; y++) {
    if (bal >= target) return baseYear + y;
    bal = bal * (1 + annualReturn) + annualSavings;
  }
  return null;
}

/* ───────── Monte Carlo ───────── */
// Box-Muller normal sampler; deterministic given seed.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function normal(rand: () => number) {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export type MCResult = {
  years: number[];
  p10: number[]; p50: number[]; p90: number[];
  successProb: number; // P(balance >= target by final year)
  paths: number;
};

export function monteCarlo(opts: {
  start: number;
  annualSavings: number;
  meanReturn: number;
  volatility: number;
  years: number;
  target: number;
  paths?: number;
  seed?: number;
}): MCResult {
  const { start, annualSavings, meanReturn, volatility, years, target } = opts;
  const paths = opts.paths ?? 1000;
  const rand = rng(opts.seed ?? 42);
  const all: number[][] = [];
  let successCount = 0;
  for (let p = 0; p < paths; p++) {
    const path: number[] = [start];
    for (let y = 1; y <= years; y++) {
      const r = meanReturn + volatility * normal(rand);
      path.push(path[y - 1] * (1 + r) + annualSavings);
    }
    if (path[years] >= target) successCount++;
    all.push(path);
  }
  const p10: number[] = [], p50: number[] = [], p90: number[] = [];
  for (let y = 0; y <= years; y++) {
    const col = all.map(p => p[y]).sort((a, b) => a - b);
    p10.push(col[Math.floor(paths * 0.1)]);
    p50.push(col[Math.floor(paths * 0.5)]);
    p90.push(col[Math.floor(paths * 0.9)]);
  }
  return {
    years: Array.from({ length: years + 1 }, (_, i) => new Date().getFullYear() + i),
    p10, p50, p90,
    successProb: successCount / paths,
    paths,
  };
}

/* ───────── Super ───────── */
export const SUPER_CONTRIB = {
  default: 0,            // SGA only — for new residents starts low; modelled as 0 baseline + employer SGA below
  moderate: 20_000,      // each, concessional, additional voluntary
  max: 30_000,           // concessional cap each
};
export const SGA_RATE = 0.12; // 12% employer guarantee 2025-26
export const SUPER_TAX = 0.15;

export function projectSuper(
  scenario: 'default' | 'moderate' | 'max',
  years: number,
  meanReturn = 0.08,
) {
  const each = COUPLE.incomeAUD / 2; // $250K each
  const sga = each * SGA_RATE;
  const voluntary = SUPER_CONTRIB[scenario];
  const grossContrib = sga + voluntary;
  const netContrib = grossContrib * (1 - SUPER_TAX);
  // ×2 partners; both contribute
  const annual = netContrib * 2;
  const out = [0];
  for (let i = 1; i <= years; i++) out.push(out[i - 1] * (1 + meanReturn) + annual);
  return { balances: out, annualContribCombined: annual, taxSavingCombined: grossContrib * 2 * (0.47 - 0.15) };
}

/* ───────── SWR with success probability (Trinity-style heuristic) ───────── */
// Using simplified historical-style success probabilities for 30-year retirement on 60/40-ish portfolio.
const SWR_SUCCESS: Record<string, number> = {
  '3.0': 1.00, '3.5': 0.98, '4.0': 0.90, '4.5': 0.78, '5.0': 0.62,
};
export function swrTable(targetAud = COUPLE.fireTargetAUD) {
  return [3.0, 3.5, 4.0, 4.5].map(rate => {
    const annual = targetAud * (rate / 100);
    return {
      rate,
      annual,
      monthly: annual / 12,
      successProb: SWR_SUCCESS[rate.toFixed(1)] ?? 0,
    };
  });
}

/* ───────── NSW progressive stamp duty ───────── */
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
  const rentAnnual = (opts.rentMonthly ?? 5000) * 12;
  const a = propertyAnalysis(p);
  // Year 0 = renting baseline. Year 1+ = post-purchase (if active).
  const mortgageHousing = a.annualMortgage + a.bodyCorp + a.maintenance + a.insurance - a.annualRentIn;
  const annualSavings0 = netHouseholdIncome - rentAnnual - annualLifestyle;

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

  return { rows, annualSavings: annualSavings0, annualHousing: mortgageHousing };
}

/* ───────── Property simulator ───────── */
export function propertyAnalysis(p: PropertyInputs, altReturn: number = 0.07) {
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

  const currentRentAnnual = COUPLE.rentMonthlyAUD * 12;
  const netVsRent = annualHolding - currentRentAnnual;

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
  const equityGain = equity - deposit; // gain over deposit put in

  // Buy vs rent+invest — uses dynamic altReturn from caller (driven by Projection's investment-return slider)
  const altDeposit = deposit * Math.pow(1 + altReturn, p.years);
  const annualSaving = Math.max(0, -netVsRent);
  let altSaved = 0;
  for (let i = 0; i < p.years; i++) altSaved = altSaved * (1 + altReturn) + annualSaving;
  const altTotal = altDeposit + altSaved;

  // Breakeven growth: solve growth where equityGain ≈ altTotal-deposit (approx via linear scan)
  let breakevenGrowth: number | null = null;
  for (let g = 0; g <= 12; g += 0.1) {
    const fv = p.price * Math.pow(1 + g / 100, p.years);
    const eq = fv - remaining - deposit;
    if (eq >= altTotal - deposit) { breakevenGrowth = parseFloat(g.toFixed(1)); break; }
  }

  return {
    deposit, loan, stampDuty, upfront,
    annualMortgage, bodyCorp, maintenance, insurance, annualRentIn,
    annualHolding, netVsRent,
    totalInterest,
    futureValue, remainingLoan: remaining, equity, equityGain,
    altDeposit, altSaved, altTotal,
    buyWins: equityGain > (altTotal - deposit),
    breakevenGrowth,
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

/* ───────── Compound helper for property alt-investment ───────── */
export function compound(principal: number, rate: number, years: number) {
  return principal * Math.pow(1 + rate, years);
}

/* ───────── Default scenarios ───────── */
export const SCENARIOS: Scenario[] = [
  { name: 'Base',  return: 0.07, savingsMultiplier: 1.0, color: '#4ab4f0' },
  { name: 'Bull',  return: 0.10, savingsMultiplier: 1.3, color: '#4af0a0' },
  { name: 'Bear',  return: 0.04, savingsMultiplier: 0.7, color: '#f04a6a' },
  { name: '+Super',return: 0.08, savingsMultiplier: 1.0, superMode: 'max', color: '#f0d44a' },
];

/* ───────── decimal-safe utility for currency display ───────── */
export const dec = (n: number, places = 0) => new Decimal(n).toFixed(places);
