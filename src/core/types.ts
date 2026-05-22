import { z } from 'zod';

export const HoldingZ = z.object({
  symbol: z.string(),
  qty: z.number().nonnegative(),
  price: z.number().nonnegative(),
  sector: z.string().default('Other'),
  kind: z.enum(['stock', 'etf']).default('stock'),
});
export type Holding = z.infer<typeof HoldingZ>;

export const FxZ = z.object({ aud_usd: z.number().positive(), sgd_aud: z.number().positive() });
export type Fx = z.infer<typeof FxZ>;

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
