// Couple profile — embedded into all AI system prompts
export const COUPLE = {
  her: {
    name: 'Her',
    dob: '1990-03-06',
    origin: 'Taiwan → Singapore',
    role: 'Presales, tech sales APAC',
    passport: 'Singapore',
    visa: 'AU PR Visa 190',
    therapyFocus: 'family-of-origin',
    color: 'purple' as const,
  },
  him: {
    name: 'Him',
    dob: '1991-09-12',
    origin: 'Pune, India',
    role: 'Chief of Staff, Google APAC Gov Affairs & Public Policy + Platform & Devices',
    passport: 'India',
    visa: 'BVB (820/801 pending)',
    therapyFocus: 'work stress',
    color: 'blue' as const,
  },
  metYear: 2022,
  marriedYear: 2024,
  relocatedSydney: '2026-01',
  tripsTogether: 10,
  incomeAUD: 500_000,
  rentMonthlyAUD: 5_000,
  lifestyleMonthlyAUD: 13_000,     // discretionary AUD/mo, excludes rent
  defaultSuperSacrifice: 0,        // user sets per-person in Tax & Super
  monthlySpendTargetSGD: 18_000,
  insuranceSGD: 600_000,
  fireTargetAUD: 5_000_000,
  fireTargetAge: 55,
};

// Jan 2, 2026 closing prices — first trading day of 2026 (Google Finance / yfinance verified)
export const PRICE_JAN1_2026: Record<string, number> = {
  GOOG: 315.32, MRVL: 89.39,  UNH: 336.40, NVDA: 188.85, TSLA: 438.07,
  MSFT: 472.94, META: 650.41, SMH: 373.30, AIPO: 23.15,  VGT: 94.50,
  SCHD: 27.73,  VOO: 628.30,  VXUS: 76.54, BOTZ: 36.71,  BND: 74.04,
};

// Current as of May 2026. Prices verified against Google Finance + yfinance.
// MOAT ratings reflect Morningstar consensus. Fair Value = consensus 1Y analyst target (estimate, edit to update).
export const SEED_HOLDINGS = [
  { symbol: 'GOOG', qty: 700,  price: 384.90, sector: 'Communication Services', kind: 'stock' as const, moat: 'wide' as const,   fairValue: 425, priceJan1: PRICE_JAN1_2026.GOOG },
  { symbol: 'MRVL', qty: 153,  price: 176.27, sector: 'Technology',             kind: 'stock' as const, moat: 'narrow' as const, fairValue: 185, priceJan1: PRICE_JAN1_2026.MRVL },
  { symbol: 'UNH',  qty: 89,   price: 389.24, sector: 'Healthcare',             kind: 'stock' as const, moat: 'wide' as const,   fairValue: 450, priceJan1: PRICE_JAN1_2026.UNH  },
  { symbol: 'NVDA', qty: 135,  price: 220.61, sector: 'Technology',             kind: 'stock' as const, moat: 'wide' as const,   fairValue: 240, priceJan1: PRICE_JAN1_2026.NVDA },
  { symbol: 'TSLA', qty: 180,  price: 404.11, sector: 'Consumer Discretionary', kind: 'stock' as const, moat: 'narrow' as const, fairValue: 380, priceJan1: PRICE_JAN1_2026.TSLA },
  { symbol: 'MSFT', qty: 63,   price: 417.42, sector: 'Technology',             kind: 'stock' as const, moat: 'wide' as const,   fairValue: 480, priceJan1: PRICE_JAN1_2026.MSFT },
  { symbol: 'META', qty: 18,   price: 602.61, sector: 'Communication Services', kind: 'stock' as const, moat: 'wide' as const,   fairValue: 700, priceJan1: PRICE_JAN1_2026.META },
  { symbol: 'SMH',  qty: 291,  price: 543.96, sector: 'Technology (ETF)',       kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.SMH  },
  { symbol: 'AIPO', qty: 669,  price: 30.50,  sector: 'AI/Robotics (ETF)',      kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.AIPO },
  { symbol: 'VGT',  qty: 1368, price: 111.52, sector: 'Technology (ETF)',       kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.VGT  },
  { symbol: 'SCHD', qty: 750,  price: 32.10,  sector: 'Dividend (ETF)',         kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.SCHD },
  { symbol: 'VOO',  qty: 28,   price: 674.59, sector: 'US Total (ETF)',         kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.VOO  },
  { symbol: 'VXUS', qty: 369,  price: 82.80,  sector: 'Intl (ETF)',             kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.VXUS },
  { symbol: 'BOTZ', qty: 600,  price: 38.89,  sector: 'Robotics (ETF)',         kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.BOTZ },
  { symbol: 'BND',  qty: 300,  price: 72.45,  sector: 'Bonds (ETF)',            kind: 'etf' as const,   moat: 'none' as const,                   priceJan1: PRICE_JAN1_2026.BND  },
];

export const SEED_CASH_USD = 48_862;

// FX semantics (matches Google Finance convention):
//   aud_usd = USD per 1 AUD   (i.e. AUD-USD = 0.7121 → $1 buys US$0.71)
//   sgd_aud = AUD per 1 SGD   (i.e. SGD-AUD = 1.0964 → S$1 buys $1.10)
export const SEED_FX = { aud_usd: 0.7121, sgd_aud: 1.0964 };

export const SEED_SPENDING_SGD: Record<string, number[]> = {
  '2024': [13102, 4759, 8885, 12547, 12682, 23204, 4674, 15397, 8328, 15939, 23981, 12261],
  '2025': [20005, 15787, 19744, 14191, 13385, 25948, 17881, 18578, 14195, 13390, 33796, 46729],
  '2026': [26666, 17797, 12306, 17658, 0, 0, 0, 0, 0, 0, 0, 0],
};

// NSW stamp duty (PPR, owner-occupied) — progressive bands as of 2025/26
export const NSW_DUTY_BANDS: Array<{ upto: number; base: number; marginal: number; over: number }> = [
  { upto: 17_000,    base: 0,       marginal: 0.0125, over: 0 },
  { upto: 36_000,    base: 213,     marginal: 0.015,  over: 17_000 },
  { upto: 97_000,    base: 498,     marginal: 0.0175, over: 36_000 },
  { upto: 364_000,   base: 1_564,   marginal: 0.035,  over: 97_000 },
  { upto: 1_212_000, base: 10_909,  marginal: 0.045,  over: 364_000 },
  { upto: 3_636_000, base: 49_069,  marginal: 0.055,  over: 1_212_000 },
  { upto: Infinity,  base: 182_389, marginal: 0.07,   over: 3_636_000 },
];

export const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#4ab4f0',
  'Technology (ETF)': '#4ab4f0',
  'Communication Services': '#a04af0',
  'Healthcare': '#4af0a0',
  'Consumer Discretionary': '#f0954a',
  'AI/Robotics (ETF)': '#f0d44a',
  'Dividend (ETF)': '#4af0a0',
  'US Total (ETF)': '#4ab4f0',
  'Intl (ETF)': '#a04af0',
  'Robotics (ETF)': '#f0d44a',
  'Bonds (ETF)': '#5a6580',
};

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
