import { create } from 'zustand';
import { z } from 'zod';
import { load, save } from './storage';
import {
  HoldingZ, FxZ, PropertyInputsZ, TaxInputsZ,
  type Holding, type Fx, type PropertyInputs, type TaxInputs,
} from './types';

// Seed values — inlined since the Tax tab is the only consumer.
// Jan 2026 closing prices used as basis for the couple's portfolio.
const SEED_HOLDINGS: Holding[] = [
  { symbol: 'GOOG', qty: 700,  price: 384.90, sector: 'Communication Services', kind: 'stock' },
  { symbol: 'MRVL', qty: 153,  price: 176.27, sector: 'Technology',             kind: 'stock' },
  { symbol: 'UNH',  qty: 89,   price: 389.24, sector: 'Healthcare',             kind: 'stock' },
  { symbol: 'NVDA', qty: 135,  price: 220.61, sector: 'Technology',             kind: 'stock' },
  { symbol: 'TSLA', qty: 180,  price: 404.11, sector: 'Consumer Discretionary', kind: 'stock' },
  { symbol: 'MSFT', qty: 63,   price: 417.42, sector: 'Technology',             kind: 'stock' },
  { symbol: 'META', qty: 18,   price: 602.61, sector: 'Communication Services', kind: 'stock' },
  { symbol: 'SMH',  qty: 291,  price: 543.96, sector: 'Technology (ETF)',       kind: 'etf'   },
  { symbol: 'AIPO', qty: 669,  price: 30.50,  sector: 'AI/Robotics (ETF)',      kind: 'etf'   },
  { symbol: 'VGT',  qty: 1368, price: 111.52, sector: 'Technology (ETF)',       kind: 'etf'   },
  { symbol: 'SCHD', qty: 750,  price: 32.10,  sector: 'Dividend (ETF)',         kind: 'etf'   },
  { symbol: 'VOO',  qty: 28,   price: 674.59, sector: 'US Total (ETF)',         kind: 'etf'   },
  { symbol: 'VXUS', qty: 369,  price: 82.80,  sector: 'Intl (ETF)',             kind: 'etf'   },
  { symbol: 'BOTZ', qty: 600,  price: 38.89,  sector: 'Robotics (ETF)',         kind: 'etf'   },
  { symbol: 'BND',  qty: 300,  price: 72.45,  sector: 'Bonds (ETF)',            kind: 'etf'   },
];
const SEED_CASH_USD = 48_862;
// FX (Google Finance convention): aud_usd = USD per AUD; sgd_aud = AUD per SGD.
const SEED_FX: Fx = { aud_usd: 0.7121, sgd_aud: 1.0964 };

const defaultProperty: PropertyInputs = {
  price: 300_000, depositPct: 20, rate: 6.2, growth: 3, years: 10, yieldPct: 3.5,
};

type State = {
  holdings: Holding[];
  cashUsd: number;
  fx: Fx;
  propertyInputs: PropertyInputs;
  fireMultiplier: number;   // years of expenses for FIRE target
  fireInflation: number;    // % per year
  expectedReturn: number;   // nominal portfolio return % per year
  hasPHI: boolean;          // Private Hospital Insurance — drives Medicare Levy Surcharge
  taxInputs: TaxInputs;     // her/him income + super sacrifice

  setPropertyInputs: (p: Partial<PropertyInputs>) => void;
  setFireInflation: (n: number) => void;
  setExpectedReturn: (n: number) => void;
};

export const useStore = create<State>((set) => ({
  holdings: load('holdings', z.array(HoldingZ), SEED_HOLDINGS),
  cashUsd: load('cashUsd', z.number(), SEED_CASH_USD),
  fx: load('fx', FxZ, SEED_FX),
  propertyInputs: load('propertyInputs_v2', PropertyInputsZ, defaultProperty),
  fireMultiplier: load('fireMultiplier', z.number().int().min(15).max(60), 25),
  fireInflation: load('fireInflation', z.number().min(0).max(15), 5),
  expectedReturn: load('expectedReturn', z.number().min(0).max(25), 10),
  hasPHI: load('hasPHI', z.boolean(), true),
  taxInputs: load('taxInputs', TaxInputsZ, { herIncome: 250_000, herSacrifice: 0, himIncome: 250_000, himSacrifice: 0 }),

  setPropertyInputs: (p) => set((s) => {
    const next = { ...s.propertyInputs, ...p };
    save('propertyInputs_v2', next); return { propertyInputs: next };
  }),
  setFireInflation: (n) => { save('fireInflation', n); set({ fireInflation: n }); },
  setExpectedReturn: (n) => { save('expectedReturn', n); set({ expectedReturn: n }); },
}));
