import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { AnalysisNodeData, StockTicker } from '@/nodes/types';

export function emptyAnalysis(): AnalysisNodeData {
  return { label: '', comparison_from_date: '', comparison_to_date: '', marketPrices: null };
}

// A single shared reference, not a fresh object per call — the selector
// below must return a referentially stable fallback for unknown ids, or
// useSyncExternalStore sees a "changed" snapshot on every render and loops.
const EMPTY_ANALYSIS = emptyAnalysis();

type AnalysisStore = {
  analyses: Record<string, AnalysisNodeData>;

  initAnalysis: (id: string, initial?: Partial<AnalysisNodeData>) => void;
  removeAnalysis: (id: string) => void;
  loadAnalyses: (analyses: Record<string, AnalysisNodeData>) => void;

  updateLabel: (id: string, label: string) => void;
  // Derived from connected holding snapshots / today's date, not user input.
  setComparisonDates: (id: string, fromDate: string, toDate: string) => void;
  setMarketPrices: (id: string, prices: Record<StockTicker, number>) => void;
};

export const useAnalysisStore = create<AnalysisStore>()(
  immer((set) => ({
    analyses: {},

    initAnalysis: (id, initial) =>
      set((s) => {
        if (!s.analyses[id]) s.analyses[id] = { ...emptyAnalysis(), ...initial };
      }),

    removeAnalysis: (id) =>
      set((s) => {
        delete s.analyses[id];
      }),

    loadAnalyses: (analyses) =>
      set((s) => {
        s.analyses = analyses;
      }),

    updateLabel: (id, label) =>
      set((s) => {
        s.analyses[id].label = label;
      }),

    setComparisonDates: (id, fromDate, toDate) =>
      set((s) => {
        s.analyses[id].comparison_from_date = fromDate;
        s.analyses[id].comparison_to_date = toDate;
      }),

    setMarketPrices: (id, prices) =>
      set((s) => {
        s.analyses[id].marketPrices = {
          ...s.analyses[id].marketPrices,
          ...prices,
        };
      }),
  }))
);

export function useAnalysis(id: string): AnalysisNodeData {
  return useAnalysisStore((s) => s.analyses[id] ?? EMPTY_ANALYSIS);
}
