import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { propertyAnalysis, propertyTimeSeries, type PropertyInputs } from '../../core/finance';
import { Surface, Slider, NumInput, SaveButton, fmtAud, fmtCompact, cn } from '../../components/ui';

/* ───────── Couple's profile constants (inlined — Tax tab is the only consumer) ───────── */
const MARGINAL_RATE = 0.47;            // top AU marginal incl. Medicare
const CGT_DISCOUNT = 0.5;              // 50% discount on assets held >12 months

/* ───────── Tiny localStorage-backed state helper ───────── */
function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const fullKey = 'hos.' + key;
  const [val, setVal] = useState<T>(() => {
    try { const raw = localStorage.getItem(fullKey); return raw ? (JSON.parse(raw) as T) : initial; }
    catch { return initial; }
  });
  const set = (v: T) => { setVal(v); try { localStorage.setItem(fullKey, JSON.stringify(v)); } catch {} };
  return [val, set];
}

const defaultProperty: PropertyInputs = {
  price: 0, depositPct: 0, rate: 0, growth: 0, years: 0, yieldPct: 0,
};

export default function FinTaxFlow() {
  // v4 key — defaults reset to 0 across the board; bump invalidates older persisted state
  const [p, setPInput] = usePersistedState<PropertyInputs>('propertyInputs_v4', defaultProperty);
  const setP = (partial: Partial<PropertyInputs>) => setPInput({ ...p, ...partial });
  const [portReturn, setExpectedReturn] = usePersistedState<number>('expectedReturn_v2', 0);
  const [inflation, setFireInflation] = usePersistedState<number>('fireInflation_v2', 0);

  const [liquidOverride, setLiquidOverride] = useState<number | null>(0);
  const startPortfolioAud = liquidOverride ?? 0;

  // Other asset (e.g. super, vested equity, second property) — user-scenario only
  const [otherAssetValue, setOtherAssetValue] = useState(0);
  const [otherAssetGrowth, setOtherAssetGrowth] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [insuranceOverride, setInsuranceOverride] = useState<number | null>(0);
  const [grossFireTarget, setGrossFireTarget] = useState<number>(0);

  const insuranceStartAud = insuranceOverride ?? 0;
  const startNw = startPortfolioAud + insuranceStartAud;

  // Zero price = no property transaction. Switches the model back to renting throughout.
  const hasProperty = p.price > 0;

  // Year-by-year series — just property equity over the hold period.
  const series = useMemo(() => {
    return propertyTimeSeries({ inputs: p, active: hasProperty });
  }, [p, hasProperty]);

  // Property purchase costs reduce starting liquid (deposit + stamp duty + legal)
  const a = useMemo(() => propertyAnalysis(p), [p]);
  const effectiveStartLiquid = Math.max(0, startPortfolioAud - a.upfront);
  // Pure compounded liquid (no savings added)
  // Y0 = actual current portfolio (before property purchase)
  // Y1+ = post-purchase basis compounded (the $380K property costs are deducted at Y0→Y1 transition)
  const purePortfolio = (yearN: number) => {
    if (yearN === 0) return startPortfolioAud;
    return effectiveStartLiquid * Math.pow(1 + portReturn / 100, yearN);
  };

  // Property value (market) — independent of equity
  const propertyValueAt = (yearN: number) => p.price * Math.pow(1 + p.growth / 100, yearN);

  // Final year position
  const lastRow = series.rows[series.rows.length - 1];
  const finalPortfolio = purePortfolio(p.years);
  const finalPropertyValue = propertyValueAt(p.years);
  const finalProperty = lastRow?.property ?? 0; // equity from time-series (loan paid down)

  // Portfolio CGT: held >12mo → 50% discount on gain (over the post-purchase basis)
  const portfolioGain = Math.max(0, finalPortfolio - effectiveStartLiquid);
  const portfolioCgt = portfolioGain * CGT_DISCOUNT * MARGINAL_RATE;
  const portfolioAfterCgt = finalPortfolio - portfolioCgt;

  // Property: PPOR is CGT-exempt in AU, so net = full equity. If investment, apply CGT
  // Assuming PPOR for the couple
  const propertyAfterTax = finalProperty;
  const finalLoanBalance = Math.max(0, finalPropertyValue - finalProperty);


  // Insurance value — compounds at the Other Asset growth rate.
  const insuranceAt = (yearN: number) => insuranceStartAud * Math.pow(1 + otherAssetGrowth / 100, yearN);
  const finalInsurance = insuranceAt(p.years);

  // Other asset value at year N (uses its own growth rate)
  // Component 1: "other" — the starting lump compounded
  // Component 2: "cash" — monthly savings × 12 deposited yearly, future value of annuity
  const otherStartingAtN = otherAssetValue * Math.pow(1 + otherAssetGrowth / 100, p.years);
  const annualSavingsContrib = monthlySavings * 12;
  const otherGrowthRate = otherAssetGrowth / 100;
  const cashFromSavings = otherGrowthRate === 0
    ? annualSavingsContrib * p.years
    : annualSavingsContrib * ((Math.pow(1 + otherGrowthRate, p.years) - 1) / otherGrowthRate);
  const finalOtherAsset = otherStartingAtN + cashFromSavings;

  // "Gross FIRE target" = user's spending target (set via the input, defaults to $2M).
  // CGT buffer = tax owed on the capital gain from startLiquid → grossFireTarget.
  const fireCgtBuffer = Math.max(0, (grossFireTarget - startPortfolioAud)) * CGT_DISCOUNT * MARGINAL_RATE;
  // FIRE TARGET REQUIRED = the total gross liquid you need (target + CGT buffer)
  const fireTargetRequired = grossFireTarget + fireCgtBuffer;
  // FIRE year = when projected NW reaches the required amount
  const displayedFireYear = (() => {
    let bal = startNw;
    const r = portReturn / 100;
    for (let y = 0; y < 60; y++) {
      if (bal >= fireTargetRequired) return new Date().getFullYear() + y;
      bal = bal * (1 + r);
    }
    return null;
  })();
  const totalNetWorth = portfolioAfterCgt + propertyAfterTax + finalInsurance + finalOtherAsset;
  const fireProgress = (totalNetWorth / fireTargetRequired) * 100;
  const fireReached = totalNetWorth >= fireTargetRequired;

  // Year-by-year component helpers (shared by the combined chart)
  const otherLumpAt = (yearN: number) => otherAssetValue * Math.pow(1 + otherGrowthRate, yearN);
  const cashAnnuityAt = (yearN: number) => otherGrowthRate === 0
    ? annualSavingsContrib * yearN
    : annualSavingsContrib * ((Math.pow(1 + otherGrowthRate, yearN) - 1) / otherGrowthRate);
  const finalOtherTotal = finalInsurance + finalOtherAsset; // insurance + lump + cash

  // Combined: every NW component on one timeline. Stacked areas sum to net worth;
  // property market value rides as a reference line above the equity slice.
  const combinedData = series.rows.map((r, i) => {
    const liquid = Math.round(purePortfolio(i));
    const equity = r.property;
    const insurance = Math.round(insuranceAt(i));
    const other = Math.round(otherLumpAt(i));
    const cash = Math.round(cashAnnuityAt(i));
    return {
      year: r.year,
      liquid,
      equity,
      insurance,
      other,
      cash,
      propertyValue: Math.round(propertyValueAt(i)),
      total: liquid + equity + insurance + other + cash,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-2">
        <div className="text-[11px] text-ink-300">Year-by-year tax + asset trajectory. All inputs persist across the app. <span className="text-brand font-semibold">AU CGT</span> assumes 12+ month holding (50% discount) at {(MARGINAL_RATE*100).toFixed(0)}% marginal. Property treated as PPOR (CGT-exempt).</div>
        <SaveButton />
      </div>

      <div className="grid lg:grid-cols-12 gap-3">
        {/* LEFT — INPUTS, distribute to fill height */}
        <Surface className="lg:col-span-3 p-3 flex flex-col">
          <h2 className="text-sm font-semibold text-ink-50 mb-2">Scenario</h2>

          <div className="flex-1 flex flex-col justify-between gap-1.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-300">Liquid asset</span>
                <NumInput value={Math.round(startPortfolioAud)} onChange={(n) => setLiquidOverride(n)} prefix="$" className="w-32" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-300">Property price to purchase</span>
                <NumInput value={p.price} onChange={(n) => setP({ price: n })} prefix="$" className="w-32" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-300">Insurance</span>
                <NumInput value={Math.round(insuranceStartAud)} onChange={(n) => setInsuranceOverride(n)} prefix="$" className="w-32" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-300">Other asset</span>
                <NumInput value={otherAssetValue} onChange={setOtherAssetValue} prefix="$" className="w-32" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-300">Monthly savings</span>
                <NumInput value={monthlySavings} onChange={setMonthlySavings} prefix="$" className="w-32" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-300">Gross FIRE target</span>
                <NumInput value={Math.round(grossFireTarget)} onChange={(n) => setGrossFireTarget(n)} prefix="$" className="w-32" />
              </div>
            </div>

            <Slider label="Hold period (years)" value={p.years} min={0} max={30} step={1} onChange={(n) => setP({ years: n })} fmt={v => v + ' yrs'} />

            <div className="pt-2 border-t border-white/[0.06] space-y-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-ink-400 font-semibold">Growth assumptions</div>
              <Slider label="Investment Return" value={portReturn} min={0} max={25} step={1} onChange={setExpectedReturn} fmt={v => v.toFixed(0) + '%'} />
              <Slider label="Property Growth" value={p.growth} min={0} max={20} step={1} onChange={(n) => setP({ growth: n })} fmt={v => v.toFixed(0) + '%'} />
              <Slider label="Other Asset Growth" value={otherAssetGrowth} min={0} max={20} step={1} onChange={setOtherAssetGrowth} fmt={v => v.toFixed(0) + '%'} />
              <Slider label="Inflation" value={inflation} min={0} max={10} step={1} onChange={setFireInflation} fmt={v => v.toFixed(0) + '%'} />
            </div>
          </div>
        </Surface>

        {/* MIDDLE — single combined trend chart */}
        <div className="lg:col-span-6">
          <CombinedTrendsChartCard
            data={combinedData}
            yearN={p.years}
            finalTotal={totalNetWorth}
          />
        </div>

        {/* RIGHT — SUMMARY AT YEAR N */}
        <Surface tone="hero" className="lg:col-span-3 p-4 relative overflow-hidden flex flex-col">
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-brand/[0.06] blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-brand font-semibold">Net position at year {p.years}</div>
            </div>

            {/* Liquid net of CGT and property purchase costs */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Liquid Asset Value · Net</div>
              <div className="num text-xl text-ink-50 font-semibold mt-0.5 leading-none">{fmtAud(portfolioAfterCgt, true)}</div>
              <div className="text-[10px] text-ink-500 mt-1 leading-relaxed">
                <div className="flex justify-between"><span>Starting basis: {fmtAud(startPortfolioAud, true)} − {fmtAud(a.upfront, true)}</span><span className="num text-ink-300">{fmtAud(effectiveStartLiquid, true)}</span></div>
                <div className="flex justify-between"><span>Gross at year {p.years}</span><span className="num text-ink-300">{fmtAud(finalPortfolio, true)}</span></div>
                <div className="flex justify-between"><span>CGT @ 47% × 50%</span><span className="num text-ink-300">{fmtAud(portfolioCgt, true)}</span></div>
              </div>
            </div>

            {/* Property — market value */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Property Asset Value</div>
              <div className="num text-xl text-ink-50 font-semibold mt-0.5 leading-none">{fmtAud(finalPropertyValue, true)}</div>
              <div className="text-[10px] text-ink-500 mt-1 leading-relaxed">
                <div className="flex justify-between"><span>Loan balance</span><span className="num text-ink-300">{fmtAud(finalLoanBalance, true)}</span></div>
                <div className="flex justify-between"><span>Net equity (added to NW)</span><span className="num text-ink-300">{fmtAud(finalProperty, true)}</span></div>
              </div>
            </div>

            {/* Other asset — compounded at Other Asset Growth rate (insurance + lump + monthly savings) */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Other asset</div>
              <div className="num text-xl text-ink-50 font-semibold mt-0.5 leading-none">{fmtAud(finalOtherTotal, true)}</div>
              <div className="text-[10px] text-ink-500 mt-1 leading-relaxed">
                <div className="flex justify-between"><span>Insurance</span><span className="num text-ink-300">{fmtAud(finalInsurance, true)}</span></div>
                <div className="flex justify-between"><span>Other</span><span className="num text-ink-300">{fmtAud(otherStartingAtN, true)}</span></div>
                <div className="flex justify-between"><span>Cash</span><span className="num text-ink-300">{fmtAud(cashFromSavings, true)}</span></div>
              </div>
            </div>

            {/* FIRE Target Required = Gross FIRE target + CGT buffer */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">FIRE TARGET REQUIRED</div>
              <div className="num text-xl text-ink-50 font-semibold mt-0.5 leading-none">{fmtAud(fireTargetRequired, true)}</div>
              <div className="text-[10px] text-ink-500 mt-1 leading-relaxed">
                <div className="flex justify-between"><span>Gross FIRE target (year {displayedFireYear ?? '—'})</span><span className="num text-ink-300">{fmtAud(grossFireTarget, true)}</span></div>
                <div className="flex justify-between"><span>CGT buffer needed</span><span className="num text-ink-300">{fmtAud(fireCgtBuffer, true)}</span></div>
              </div>
            </div>

            {/* Total NW + progress */}
            <div className="mt-auto pt-3 border-t border-white/[0.08]">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Total net worth</div>
                <span className={cn('text-[10px] font-semibold num', fireReached ? 'text-gain' : 'text-ink-300')}>
                  {fireReached ? '✓ ' : ''}{fireProgress.toFixed(0)}%
                </span>
              </div>
              <div className="num text-2xl text-brand font-semibold mt-0.5 leading-none">{fmtAud(totalNetWorth, true)}</div>
              <div className="text-[10px] text-ink-500 mt-1 leading-relaxed">
                <div className="flex justify-between"><span>Liquid (net)</span><span className="num text-ink-300">{fmtAud(portfolioAfterCgt, true)}</span></div>
                <div className="flex justify-between"><span>Property (equity)</span><span className="num text-ink-300">{fmtAud(propertyAfterTax, true)}</span></div>
                <div className="flex justify-between"><span>Other (incl. insurance)</span><span className="num text-ink-300">{fmtAud(finalOtherTotal, true)}</span></div>
              </div>
            </div>
          </div>
        </Surface>
      </div>

      <p className="text-[10px] text-ink-500 italic mt-1">Projection only · AU CGT assumes top marginal × 50% discount (12mo+) · PPOR exempt · doesn't model income growth.</p>
    </div>
  );
}

/* ───────── Combined trends — every NW component as its own line ───────── */
const LINE_SERIES: Array<{ key: string; name: string; color: string; dashed?: boolean; width?: number }> = [
  { key: 'liquid',        name: 'Liquid asset',          color: '#e8c890' },
  { key: 'equity',        name: 'Property equity',       color: '#c4b5fd' },
  { key: 'propertyValue', name: 'Property market value', color: '#a78bfa', dashed: true },
  { key: 'insurance',     name: 'Insurance',             color: '#c8cdd9' },
  { key: 'other',         name: 'Other',                 color: '#9aa3b8' },
  { key: 'cash',          name: 'Cash savings',          color: '#6b7691' },
];

function CombinedTrendsChartCard({ data, yearN, finalTotal }: { data: any[]; yearN: number; finalTotal: number }) {
  return (
    <Surface className="p-3 flex flex-col min-h-0 h-full">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Net Worth Trend</h3>
          <div className="text-[10px] text-ink-400">Each component as its own line · header shows total NW</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Y{yearN}</div>
          <div className="num text-sm font-semibold text-brand">{fmtAud(finalTotal, true)}</div>
        </div>
      </div>
      <div className="flex-1 min-h-[320px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="year" stroke="#6b7691" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7691" fontSize={9} tickFormatter={(v) => '$' + fmtCompact(v)} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: any, n: any) => [fmtAud(Number(v), true), n]}
              itemSorter={(item: any) => {
                const order: Record<string, number> = { liquid: 0, equity: 1, propertyValue: 2, insurance: 3, other: 4, cash: 5 };
                return order[item.dataKey] ?? 99;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={8} />
            {LINE_SERIES.map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.width ?? 1.5}
                strokeDasharray={s.dashed ? '4 3' : undefined}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}
