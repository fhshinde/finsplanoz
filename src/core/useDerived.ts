// Centralised derivation of the household financial picture.
// Returns only what the Tax tab actually consumes.
import { useMemo } from 'react';
import { useStore } from './store';
import { netWorthAud, auTax } from './finance';

// Lifestyle (discretionary AUD/mo, excludes rent) and rent — formerly COUPLE.*
const LIFESTYLE_MONTHLY_AUD = 13_000;
const RENT_MONTHLY_AUD = 5_000;

export function useDerived() {
  const { holdings, cashUsd, fx, taxInputs, hasPHI } = useStore();

  return useMemo(() => {
    const nw = netWorthAud(holdings, cashUsd, fx);

    // Tax — uses Tax & Super tab inputs from store (single source of truth)
    const grossHousehold = taxInputs.herIncome + taxInputs.himIncome;
    const taxableHer = Math.max(0, taxInputs.herIncome - taxInputs.herSacrifice);
    const taxableHim = Math.max(0, taxInputs.himIncome - taxInputs.himSacrifice);
    const mlsCtx = { hasPHI, mlsHouseholdIncome: grossHousehold, isFamily: true };
    const taxHer = auTax(taxableHer, mlsCtx);
    const taxHim = auTax(taxableHim, mlsCtx);
    const netHouseholdIncome = taxHer.net + taxHim.net;
    const totalTaxPaid = taxHer.total + taxHim.total;

    // Single source of truth for annual expenses (rent baseline + lifestyle)
    const annualExpensesToday = (RENT_MONTHLY_AUD + LIFESTYLE_MONTHLY_AUD) * 12;

    return { nw, netHouseholdIncome, totalTaxPaid, annualExpensesToday };
  }, [holdings, cashUsd, fx, taxInputs, hasPHI]);
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
