// Centralised derivation of the household financial picture.
// Both Overview and Projection use this so numbers ALWAYS line up.
import { useMemo } from 'react';
import { useStore } from './store';
import {
  portfolioUsd, portfolioAud, insuranceAud, netWorthAud,
  propertyEquityAud, auTax,
} from './finance';
import { COUPLE } from './constants';

export function useDerived() {
  const { holdings, cashUsd, fx, spending, propertyOwned, taxInputs, hasPHI } = useStore();

  return useMemo(() => {
    // FX-converted values
    const pUsd = portfolioUsd(holdings, cashUsd);
    const pAud = portfolioAud(holdings, cashUsd, fx);
    const ins = insuranceAud(fx);
    const propEquity = propertyEquityAud(propertyOwned);
    const nw = netWorthAud(holdings, cashUsd, fx, propertyOwned);

    // Recent SGD spend (kept for reference in the Spending charts only)
    const years = Object.keys(spending).sort();
    const latest = spending[years[years.length - 1]] ?? [];
    const nz = latest.filter(x => x > 0);
    const avgMonthlySgd = nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : COUPLE.monthlySpendTargetSGD;

    // Tax — uses Tax & Super tab inputs from store (single source of truth)
    const grossHousehold = taxInputs.herIncome + taxInputs.himIncome;
    const taxableHer = Math.max(0, taxInputs.herIncome - taxInputs.herSacrifice);
    const taxableHim = Math.max(0, taxInputs.himIncome - taxInputs.himSacrifice);
    const mlsCtx = { hasPHI, mlsHouseholdIncome: grossHousehold, isFamily: true };
    const taxHer = auTax(taxableHer, mlsCtx);
    const taxHim = auTax(taxableHim, mlsCtx);
    const netHouseholdIncome = taxHer.net + taxHim.net;
    const totalTaxPaid = taxHer.total + taxHim.total;
    const effectiveTaxRate = grossHousehold > 0 ? totalTaxPaid / grossHousehold : 0;
    const superSacrifice = taxInputs.herSacrifice + taxInputs.himSacrifice;
    const superNetContributed = superSacrifice * 0.85; // 15% super contributions tax

    // Housing
    const annualHousing = propertyOwned.active
      ? (propertyOwned.monthlyCost - propertyOwned.rentalIncome / 12) * 12
      : COUPLE.rentMonthlyAUD * 12;

    // Lifestyle — fixed AUD figure (matches user's actual non-housing spend)
    const annualLifestyle = COUPLE.lifestyleMonthlyAUD * 12;
    const totalAnnualSpend = annualLifestyle + COUPLE.rentMonthlyAUD * 12;

    // The single source of truth for annual expenses
    const annualExpensesToday = annualHousing + annualLifestyle;
    const annualSavings = netHouseholdIncome - annualExpensesToday;

    return {
      pUsd, pAud, ins, propEquity, nw,
      avgMonthlySgd,
      grossHousehold,
      taxHer, taxHim, netHouseholdIncome, totalTaxPaid, effectiveTaxRate,
      superSacrifice, superNetContributed,
      annualHousing, annualLifestyle, annualExpensesToday, annualSavings,
      totalAnnualSpend,
      fx, propertyOwned,
    };
  }, [holdings, cashUsd, fx, spending, propertyOwned, taxInputs, hasPHI]);
}

// Compute FIRE year given a target today + assumptions.
export function fireYearInflated(opts: {
  startNw: number;
  annualSavings: number;
  nominalReturn: number;      // e.g. 0.07
  inflation: number;          // e.g. 0.03
  todaysTarget: number;
}) {
  const { startNw, annualSavings, nominalReturn, inflation, todaysTarget } = opts;
  let bal = startNw;
  for (let y = 0; y < 60; y++) {
    const target = todaysTarget * Math.pow(1 + inflation, y);
    if (bal >= target) {
      return {
        fireYear: new Date().getFullYear() + y,
        yearsToFire: y,
        nominalTarget: target,
      };
    }
    bal = bal * (1 + nominalReturn) + annualSavings;
  }
  return { fireYear: null, yearsToFire: null, nominalTarget: todaysTarget * Math.pow(1 + inflation, 60) };
}
