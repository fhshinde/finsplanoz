import { create } from 'zustand';
import { z } from 'zod';
import { load, save } from './storage';
import {
  HoldingZ, FxZ, SpendingZ, CheckinZ, JournalLogZ, HabitsZ, WeightsZ, PropertyInputsZ, PropertyOwnedZ, TaxInputsZ,
  type Holding, type Fx, type Checkin, type JournalLog, type HabitDay, type WeightEntry, type PropertyInputs, type PropertyOwned, type TaxInputs, type Person,
} from './types';
import {
  SEED_HOLDINGS, SEED_CASH_USD, SEED_FX, SEED_SPENDING_SGD,
} from './constants';

type State = {
  holdings: Holding[];
  cashUsd: number;
  fx: Fx;
  spending: Record<string, number[]>;
  spendingNotes: Record<string, string[]>;
  checkins: Checkin[];
  journalLog: JournalLog[];
  habits: Record<string, HabitDay>;
  weights: { her: WeightEntry[]; him: WeightEntry[] };
  superScenario: 'default' | 'moderate' | 'max';
  propertyInputs: PropertyInputs;
  propertyOwned: PropertyOwned;
  fireMultiplier: number;   // years of expenses for FIRE target
  fireInflation: number;    // % per year
  expectedReturn: number;   // nominal portfolio return % per year — shared by Projection + Property
  hasPHI: boolean;          // Private Hospital Insurance — drives Medicare Levy Surcharge
  taxInputs: TaxInputs;     // Tax & Super tab inputs, shared across app
  person: Person;

  setHolding: (sym: string, partial: Partial<Holding>) => void;
  addHolding: (h: Holding) => void;
  removeHolding: (sym: string) => void;
  setCashUsd: (n: number) => void;
  setFx: (fx: Partial<Fx>) => void;
  setSpending: (year: string, month: number, value: number) => void;
  setSpendingNote: (year: string, month: number, note: string) => void;
  addCheckin: (c: Checkin) => void;
  addJournal: (j: JournalLog) => void;
  toggleHabit: (date: string, key: keyof HabitDay) => void;
  addWeight: (who: 'her' | 'him', kg: number) => void;
  setSuperScenario: (s: 'default' | 'moderate' | 'max') => void;
  setPropertyInputs: (p: Partial<PropertyInputs>) => void;
  setPropertyOwned: (p: Partial<PropertyOwned>) => void;
  setFireMultiplier: (n: number) => void;
  setFireInflation: (n: number) => void;
  setExpectedReturn: (n: number) => void;
  setHasPHI: (b: boolean) => void;
  setTaxInputs: (t: Partial<TaxInputs>) => void;
  setPerson: (p: Person) => void;
};

const defaultProperty: PropertyInputs = {
  price: 300_000, depositPct: 20, rate: 6.2, growth: 3, years: 10, yieldPct: 3.5,
};
const defaultPropertyOwned: PropertyOwned = {
  active: false, valuation: 0, loanBalance: 0, monthlyCost: 0, rentalIncome: 0,
};

const initSpendingNotes = () => {
  const out: Record<string, string[]> = {};
  for (const y of Object.keys(SEED_SPENDING_SGD)) out[y] = Array(12).fill('');
  return out;
};

export const useStore = create<State>((set) => ({
  holdings: load('holdings', z.array(HoldingZ), SEED_HOLDINGS),
  cashUsd: load('cashUsd', z.number(), SEED_CASH_USD),
  fx: load('fx', FxZ, SEED_FX),
  spending: load('spending', SpendingZ, SEED_SPENDING_SGD),
  spendingNotes: load('spendingNotes', z.record(z.string(), z.array(z.string())), initSpendingNotes()),
  checkins: load('checkins', z.array(CheckinZ), []),
  journalLog: load('journalLog', z.array(JournalLogZ), []),
  habits: load('habits', HabitsZ, {}),
  weights: load('weights', WeightsZ, { her: [{ date: new Date().toISOString().slice(0,10), kg: 80 }], him: [{ date: new Date().toISOString().slice(0,10), kg: 98 }] }),
  superScenario: load('superScenario', z.enum(['default','moderate','max']), 'moderate'),
  propertyInputs: load('propertyInputs_v2', PropertyInputsZ, defaultProperty),
  propertyOwned: load('propertyOwned', PropertyOwnedZ, defaultPropertyOwned),
  fireMultiplier: load('fireMultiplier', z.number().int().min(15).max(60), 25),
  fireInflation: load('fireInflation', z.number().min(0).max(15), 5),
  expectedReturn: load('expectedReturn', z.number().min(0).max(25), 10),
  hasPHI: load('hasPHI', z.boolean(), true),
  taxInputs: load('taxInputs', TaxInputsZ, { herIncome: 250_000, herSacrifice: 0, himIncome: 250_000, himSacrifice: 0 }),
  person: load('person', z.enum(['together','her','him']), 'together'),

  setHolding: (sym, partial) => set((s) => {
    const holdings = s.holdings.map(h => h.symbol === sym ? { ...h, ...partial } : h);
    save('holdings', holdings); return { holdings };
  }),
  addHolding: (h) => set((s) => {
    const holdings = [...s.holdings, h];
    save('holdings', holdings); return { holdings };
  }),
  removeHolding: (sym) => set((s) => {
    const holdings = s.holdings.filter(h => h.symbol !== sym);
    save('holdings', holdings); return { holdings };
  }),
  setCashUsd: (n) => { save('cashUsd', n); set({ cashUsd: n }); },
  setFx: (fx) => set((s) => { const next = { ...s.fx, ...fx }; save('fx', next); return { fx: next }; }),
  setSpending: (year, month, value) => set((s) => {
    const arr = [...(s.spending[year] ?? Array(12).fill(0))];
    arr[month] = value;
    const next = { ...s.spending, [year]: arr };
    save('spending', next); return { spending: next };
  }),
  setSpendingNote: (year, month, note) => set((s) => {
    const arr = [...(s.spendingNotes[year] ?? Array(12).fill(''))];
    arr[month] = note;
    const next = { ...s.spendingNotes, [year]: arr };
    save('spendingNotes', next); return { spendingNotes: next };
  }),
  addCheckin: (c) => set((s) => {
    const checkins = [...s.checkins.filter(x => !(x.date === c.date && x.person === c.person)), c];
    save('checkins', checkins); return { checkins };
  }),
  addJournal: (j) => set((s) => {
    const journalLog = [...s.journalLog, j];
    save('journalLog', journalLog); return { journalLog };
  }),
  toggleHabit: (date, key) => set((s) => {
    const cur = s.habits[date] ?? { walk: false, strength: false, water: false, sleep: false };
    const habits = { ...s.habits, [date]: { ...cur, [key]: !cur[key] } };
    save('habits', habits); return { habits };
  }),
  addWeight: (who, kg) => set((s) => {
    const entry = { date: new Date().toISOString().slice(0,10), kg };
    const weights = { ...s.weights, [who]: [...s.weights[who], entry] };
    save('weights', weights); return { weights };
  }),
  setSuperScenario: (sc) => { save('superScenario', sc); set({ superScenario: sc }); },
  setPropertyInputs: (p) => set((s) => {
    const next = { ...s.propertyInputs, ...p };
    save('propertyInputs_v2', next); return { propertyInputs: next };
  }),
  setPropertyOwned: (p) => set((s) => {
    const next = { ...s.propertyOwned, ...p };
    save('propertyOwned', next); return { propertyOwned: next };
  }),
  setFireMultiplier: (n) => { save('fireMultiplier', n); set({ fireMultiplier: n }); },
  setFireInflation: (n) => { save('fireInflation', n); set({ fireInflation: n }); },
  setExpectedReturn: (n) => { save('expectedReturn', n); set({ expectedReturn: n }); },
  setHasPHI: (b) => { save('hasPHI', b); set({ hasPHI: b }); },
  setTaxInputs: (t) => set((s) => {
    const next = { ...s.taxInputs, ...t };
    save('taxInputs', next); return { taxInputs: next };
  }),
  setPerson: (p) => { save('person', p); set({ person: p }); },
}));
