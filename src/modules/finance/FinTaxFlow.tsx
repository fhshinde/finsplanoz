import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '../../core/store';
import { propertyAnalysis, propertyTimeSeries, portfolioAud, insuranceAud } from '../../core/finance';
import { COUPLE } from '../../core/constants';
import { useDerived, fireYearInflated } from '../../core/useDerived';
import { Surface, Slider, NumInput, SaveButton, fmtAud, fmtCompact, cn } from '../../components/ui';

const MARGINAL_RATE = 0.47;      // top AU marginal incl. Medicare for the couple
const CGT_DISCOUNT = 0.5;        // 50% discount on assets held >12 months

export default function FinTaxFlow() {
  const {
    propertyInputs: p, setPropertyInputs: setP,
    holdings, cashUsd, fx,
    expectedReturn, setExpectedReturn,
    fireInflation, setFireInflation,
    fireMultiplier,
  } = useStore();
  const d = useDerived();

  const portReturn = expectedReturn;
  const inflation = fireInflation;
  const derivedPortfolioAud = portfolioAud(holdings, cashUsd, fx);
  const [liquidOverride, setLiquidOverride] = useState<number | null>(300_000);
  // Re-sync override when underlying holdings change (unless user explicitly typed a value)
  useEffect(() => { if (liquidOverride === null) return; }, [derivedPortfolioAud]);
  const startPortfolioAud = liquidOverride ?? derivedPortfolioAud;

  // Other asset (e.g. super, vested equity, second property) — user-scenario only
  const [otherAssetValue, setOtherAssetValue] = useState(100_000);
  const [otherAssetGrowth, setOtherAssetGrowth] = useState(5);
  const [monthlySavings, setMonthlySavings] = useState(30_000);
  const [insuranceOverride, setInsuranceOverride] = useState<number | null>(300_000);
  const [grossFireTargetOverride, setGrossFireTargetOverride] = useState<number | null>(2_000_000);

  // Year-by-year series
  const series = useMemo(() => {
    return propertyTimeSeries({
      inputs: p,
      startPortfolioAud,
      insuranceAud: insuranceAud(fx),
      netHouseholdIncome: d.netHouseholdIncome,
      totalTaxPaid: d.totalTaxPaid,
      annualLifestyle: COUPLE.lifestyleMonthlyAUD * 12,
      portfolioReturn: portReturn / 100,
      rentMonthly: COUPLE.rentMonthlyAUD,
      active: true,    // always model as if property purchased — this is a scenario tab
      inflation: inflation / 100,
    });
  }, [p, holdings, cashUsd, fx, startPortfolioAud, portReturn, inflation, d.totalTaxPaid, d.netHouseholdIncome]);

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


  // Insurance value — compounds at the Other Asset growth rate. Override defaults from SGD 600K → AUD.
  const derivedInsuranceAud = insuranceAud(fx);
  const insuranceStartAud = insuranceOverride ?? derivedInsuranceAud;
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

  // FIRE TARGET — standard FIRE formula: future expenses × multiplier (inflated to year you reach FIRE)
  // Iteratively find the FIRE year where pure-compounded NW catches the inflating target
  const fireTargetToday = d.annualExpensesToday * fireMultiplier;
  const fireCalc = fireYearInflated({
    startNw: d.nw,
    annualSavings: 0,
    nominalReturn: portReturn / 100,
    inflation: inflation / 100,
    todaysTarget: fireTargetToday,
  });
  const fireTargetNominal = fireCalc.nominalTarget;
  // "Gross FIRE target" = user's spending target (defaults to lifestyle-derived nominal)
  const grossFireTarget = grossFireTargetOverride ?? fireTargetNominal;
  // CGT buffer = tax owed on the capital gain from startLiquid → grossFireTarget
  const fireCgtBuffer = Math.max(0, (grossFireTarget - startPortfolioAud)) * CGT_DISCOUNT * MARGINAL_RATE;
  // FIRE TARGET REQUIRED = the total gross liquid you need (target + CGT buffer)
  const fireTargetRequired = grossFireTarget + fireCgtBuffer;
  // FIRE year = when projected NW reaches the required amount
  const displayedFireYear = (() => {
    let bal = d.nw;
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

  // Chart data
  const portfolioData = series.rows.map((r, i) => ({
    year: r.year,
    value: Math.round(purePortfolio(i)),
  }));

  // Other-assets year-by-year — 3 separate series
  const otherLumpAt = (yearN: number) => otherAssetValue * Math.pow(1 + otherGrowthRate, yearN);
  const cashAnnuityAt = (yearN: number) => otherGrowthRate === 0
    ? annualSavingsContrib * yearN
    : annualSavingsContrib * ((Math.pow(1 + otherGrowthRate, yearN) - 1) / otherGrowthRate);
  const otherAssetsData = series.rows.map((r, i) => ({
    year: r.year,
    insurance: Math.round(insuranceAt(i)),
    other: Math.round(otherLumpAt(i)),
    cash: Math.round(cashAnnuityAt(i)),
  }));
  const finalOtherTotal = finalInsurance + finalOtherAsset; // insurance + lump + cash
  const propertyData = series.rows.map((r, i) => ({
    year: r.year,
    value: Math.round(propertyValueAt(i)),   // market value (main line)
    equity: r.property,                       // equity (secondary line)
  }));
  const cashflowData = series.rows.map(r => ({
    year: r.year,
    income: r.NetIncome ?? 0,
    housing: Math.abs(r.Housing ?? 0),
    lifestyle: Math.abs(r.Lifestyle ?? 0),
    savings: (r.NetIncome ?? 0) - Math.abs(r.Housing ?? 0) - Math.abs(r.Lifestyle ?? 0),
  }));

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
                <span className="text-[11px] text-ink-300">Property price</span>
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
                <NumInput value={Math.round(grossFireTarget)} onChange={(n) => setGrossFireTargetOverride(n)} prefix="$" className="w-32" />
              </div>
            </div>

            <Slider label="Hold period (years)" value={p.years} min={5} max={30} step={1} onChange={(n) => setP({ years: n })} fmt={v => v + ' yrs'} />

            <div className="pt-2 border-t border-white/[0.06] space-y-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-ink-400 font-semibold">Growth assumptions</div>
              <Slider label="Investment Return" value={portReturn} min={7} max={25} step={1} onChange={setExpectedReturn} fmt={v => v.toFixed(0) + '%'} />
              <Slider label="Property Growth" value={p.growth} min={3} max={20} step={1} onChange={(n) => setP({ growth: n })} fmt={v => v.toFixed(0) + '%'} />
              <Slider label="Other Asset Growth" value={otherAssetGrowth} min={0} max={20} step={1} onChange={setOtherAssetGrowth} fmt={v => v.toFixed(0) + '%'} />
              <Slider label="Inflation" value={inflation} min={3} max={10} step={1} onChange={setFireInflation} fmt={v => v.toFixed(0) + '%'} />
            </div>
          </div>
        </Surface>

        {/* MIDDLE — 4 CHARTS in 2×2 grid */}
        <div className="lg:col-span-6 grid grid-cols-2 grid-rows-2 gap-2">
          <LiquidAssetChartCard
            data={portfolioData}
            yearN={p.years}
            growthRate={portReturn}
            finalLiquid={finalPortfolio}
          />
          <OtherAssetsChartCard
            data={otherAssetsData}
            yearN={p.years}
            growthRate={otherAssetGrowth}
            finalTotal={finalOtherTotal}
          />
          <PropertyChartCard
            data={propertyData}
            yearN={p.years}
            growthRate={p.growth}
          />
          <CashflowCard
            data={cashflowData}
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

/* ───────── Liquid Asset chart ───────── */
function LiquidAssetChartCard({ data, yearN, growthRate, finalLiquid }: { data: any[]; yearN: number; growthRate: number; finalLiquid: number }) {
  return (
    <Surface className="p-3 flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Liquid Asset</h3>
          <div className="text-[10px] text-ink-400">{growthRate}% p.a. · pure compounding</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Y{yearN}</div>
          <div className="num text-sm font-semibold text-brand">{fmtAud(finalLiquid, true)}</div>
        </div>
      </div>
      <div className="flex-1 min-h-[80px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="g-liquid-val" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c4a875" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#c4a875" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="year" stroke="#6b7691" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7691" fontSize={9} tickFormatter={(v) => '$' + fmtCompact(v)} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => fmtAud(Number(v), true)} />
            <Area type="monotone" dataKey="value" name="Liquid asset" stroke="#c4a875" strokeWidth={2} fill="url(#g-liquid-val)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}

/* ───────── Other Assets chart — 3 lines: insurance, other lump, cash savings ───────── */
function OtherAssetsChartCard({ data, yearN, growthRate, finalTotal }: { data: any[]; yearN: number; growthRate: number; finalTotal: number }) {
  return (
    <Surface className="p-3 flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Other Assets</h3>
          <div className="text-[10px] text-ink-400">{growthRate}% p.a. · insurance + other + monthly savings</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Y{yearN}</div>
          <div className="num text-sm text-ink-50 font-semibold">{fmtAud(finalTotal, true)}</div>
        </div>
      </div>
      <div className="flex-1 min-h-[80px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="year" stroke="#6b7691" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7691" fontSize={9} tickFormatter={(v) => '$' + fmtCompact(v)} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: any, n: any) => [fmtAud(Number(v), true), n]}
              itemSorter={(item: any) => ({ insurance: 0, other: 1, cash: 2 } as Record<string, number>)[item.dataKey] ?? 99}
            />
            <Area type="monotone" dataKey="cash"      name="Cash"      stroke="#6b7691" strokeWidth={1.5} fill="none" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="other"     name="Other"     stroke="#9aa3b8" strokeWidth={1.5} fill="none" strokeDasharray="5 3" />
            <Area type="monotone" dataKey="insurance" name="Insurance" stroke="#c8cdd9" strokeWidth={1.5} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}

/* ───────── Property chart — market value + equity line ───────── */
function PropertyChartCard({ data, yearN, growthRate }: { data: any[]; yearN: number; growthRate: number }) {
  const finalRow = data[data.length - 1];
  return (
    <Surface className="p-3 flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Property Growth</h3>
          <div className="text-[10px] text-ink-400">{growthRate}% p.a. · equity = value − remaining loan</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Y{yearN}</div>
          <div className="num text-sm text-dusk font-semibold">{fmtAud(finalRow?.value ?? 0, true)}</div>
        </div>
      </div>
      <div className="flex-1 min-h-[80px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="g-prop-val" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="year" stroke="#6b7691" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7691" fontSize={9} tickFormatter={(v) => '$' + fmtCompact(v)} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} formatter={(v: any, n: any) => [fmtAud(Number(v), true), n]} />
            <Area type="monotone" dataKey="value" name="Market value" stroke="#a78bfa" strokeWidth={2} fill="url(#g-prop-val)" />
            <Area type="monotone" dataKey="equity" name="Equity" stroke="#c4b5fd" strokeWidth={1.5} fill="none" strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}

/* ───────── Cashflow stacked bar ───────── */
function CashflowCard({ data }: { data: any[] }) {
  return (
    <Surface className="p-3 flex flex-col min-h-0">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-ink-50">Annual cashflow</h3>
        <div className="text-[10px] text-ink-400">Net income − housing − lifestyle, all inflated</div>
      </div>
      <div className="flex-1 min-h-[80px]">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} stackOffset="sign">
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="year" stroke="#6b7691" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7691" fontSize={9} tickFormatter={(v) => '$' + fmtCompact(v)} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#1c2230', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} formatter={(v: any, n: any) => [fmtAud(Math.abs(Number(v)), true), n]} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
            <Bar dataKey="housing" name="Housing" stackId="out" fill="#7c6fc4" />
            <Bar dataKey="lifestyle" name="Lifestyle" stackId="out" fill="#7dd3fc" />
            <Bar dataKey="income" name="Net income" stackId="in" fill="#88b59c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}
