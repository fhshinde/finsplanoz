import { z } from 'zod';

export const HoldingZ = z.object({
  symbol: z.string(),
  qty: z.number().nonnegative(),
  price: z.number().nonnegative(),
  sector: z.string().default('Other'),
  kind: z.enum(['stock', 'etf']).default('stock'),
  costBasis: z.number().nonnegative().optional(),    // avg cost per share USD
  priceJan1: z.number().nonnegative().optional(),    // price on 2026-01-01 (for YTD)
  moat: z.enum(['wide','narrow','none']).optional(), // Morningstar style economic moat
  fairValue: z.number().nonnegative().optional(),    // analyst 1Y target (Google Finance)
});
export type Holding = z.infer<typeof HoldingZ>;

export const FxZ = z.object({ aud_usd: z.number().positive(), sgd_aud: z.number().positive() });
export type Fx = z.infer<typeof FxZ>;

export const SpendingZ = z.record(z.string(), z.array(z.number()).length(12));
export type Spending = z.infer<typeof SpendingZ>;

export const SpendingNotesZ = z.record(z.string(), z.array(z.string()).length(12));

export const CheckinZ = z.object({
  date: z.string(),
  person: z.enum(['together', 'her', 'him']),
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
});
export type Checkin = z.infer<typeof CheckinZ>;

export const JournalLogZ = z.object({
  date: z.string(),
  person: z.enum(['together', 'her', 'him']),
  mode: z.enum(['stress', 'mood', 'growth']),
});
export type JournalLog = z.infer<typeof JournalLogZ>;

export const HabitDayZ = z.object({
  walk: z.boolean().default(false),
  strength: z.boolean().default(false),
  water: z.boolean().default(false),
  sleep: z.boolean().default(false),
});
export type HabitDay = z.infer<typeof HabitDayZ>;
export const HabitsZ = z.record(z.string(), HabitDayZ);

export const WeightEntryZ = z.object({ date: z.string(), kg: z.number().positive() });
export type WeightEntry = z.infer<typeof WeightEntryZ>;
export const WeightsZ = z.object({
  her: z.array(WeightEntryZ),
  him: z.array(WeightEntryZ),
});

export const LiftCacheZ = z.object({
  date: z.string(),
  person: z.enum(['together', 'her', 'him']),
  content: z.array(z.object({ icon: z.string(), text: z.string() })),
});

export const PropertyInputsZ = z.object({
  price: z.number(),
  depositPct: z.number(),
  rate: z.number(),
  growth: z.number(),
  years: z.number(),
  yieldPct: z.number(),
});
export type PropertyInputs = z.infer<typeof PropertyInputsZ>;

export const TaxInputsZ = z.object({
  herIncome: z.number().nonnegative(),
  herSacrifice: z.number().nonnegative(),
  himIncome: z.number().nonnegative(),
  himSacrifice: z.number().nonnegative(),
});
export type TaxInputs = z.infer<typeof TaxInputsZ>;

export const PropertyOwnedZ = z.object({
  active: z.boolean(),                // user has committed to owning
  valuation: z.number(),              // current market value
  loanBalance: z.number(),            // outstanding mortgage
  monthlyCost: z.number(),            // mortgage + body corp + maintenance + insurance
  rentalIncome: z.number(),           // 0 if owner-occupied
});
export type PropertyOwned = z.infer<typeof PropertyOwnedZ>;

export type Scenario = {
  name: string;
  return: number; // annual return e.g. 0.07
  savingsMultiplier: number; // 1.0 = current, 1.3 = +30%
  superMode?: 'default' | 'moderate' | 'max';
  color: string;
};

export type Person = 'together' | 'her' | 'him';
