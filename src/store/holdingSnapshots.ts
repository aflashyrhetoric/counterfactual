import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { HoldingSnapshotNodeData, StockHolding, Lot } from '@/nodes/types';

function emptyLot(): Lot {
  return { ticker: '', quantity: 0, purchasePrice: 0 };
}

function emptyHolding(): StockHolding {
  return { ticker: '', lots: [emptyLot()] };
}

export function emptyHoldingSnapshot(): HoldingSnapshotNodeData {
  return { label: '', date: '', holdings: [], settlement_fund: 0, marketOpenPrices: null };
}

// TEMP: hard-coded so other components have something real to read while
// we build them out. Delete once snapshots are created for real.
export const DEMO_HOLDING_SNAPSHOT_ID = 'holding-demo';

function demoHoldingSnapshot(): HoldingSnapshotNodeData {
  return {
    label: 'Demo Snapshot',
    date: '2026-08-11',
    settlement_fund: 5000,
    marketOpenPrices: null,
    holdings: [
      {
        ticker: 'AAPL',
        lots: [
          { ticker: 'AAPL', quantity: 10, purchasePrice: 150 },
          { ticker: 'AAPL', quantity: 5, purchasePrice: 170 },
        ],
      },
      {
        ticker: 'VTI',
        lots: [{ ticker: 'VTI', quantity: 20, purchasePrice: 220 }],
      },
    ],
  };
}

type HoldingSnapshotStore = {
  snapshots: Record<string, HoldingSnapshotNodeData>;

  initHolding: (id: string, initial?: Partial<HoldingSnapshotNodeData>) => void;
  removeHolding: (id: string) => void;
  loadSnapshots: (snapshots: Record<string, HoldingSnapshotNodeData>) => void;

  updateLabel: (id: string, label: string) => void;
  updateDate: (id: string, date: string) => void;
  updateSettlementFund: (id: string, value: number) => void;
  setMarketOpenPrices: (id: string, prices: Record<string, number>) => void;

  addHolding: (id: string) => void;
  removeStockHolding: (id: string, holdingIndex: number) => void;
  updateHoldingTicker: (id: string, holdingIndex: number, ticker: string) => void;

  addLot: (id: string, holdingIndex: number) => void;
  removeLot: (id: string, holdingIndex: number, lotIndex: number) => void;
  updateLot: (id: string, holdingIndex: number, lotIndex: number, partial: Partial<Lot>) => void;
};

export const useHoldingSnapshotStore = create<HoldingSnapshotStore>()(
  immer((set) => ({
    snapshots: {
      [DEMO_HOLDING_SNAPSHOT_ID]: demoHoldingSnapshot(),
    },

    initHolding: (id, initial) =>
      set((s) => {
        if (!s.snapshots[id]) s.snapshots[id] = { ...emptyHoldingSnapshot(), ...initial };
      }),

    removeHolding: (id) =>
      set((s) => {
        delete s.snapshots[id];
      }),

    loadSnapshots: (snapshots) =>
      set((s) => {
        s.snapshots = snapshots;
      }),

    updateLabel: (id, label) =>
      set((s) => {
        s.snapshots[id].label = label;
      }),

    updateDate: (id, date) =>
      set((s) => {
        s.snapshots[id].date = date;
      }),

    updateSettlementFund: (id, value) =>
      set((s) => {
        s.snapshots[id].settlement_fund = value;
      }),

    setMarketOpenPrices: (id, prices) =>
      set((s) => {
        s.snapshots[id].marketOpenPrices = {
          ...s.snapshots[id].marketOpenPrices,
          ...prices,
        };
      }),

    addHolding: (id) =>
      set((s) => {
        s.snapshots[id].holdings.push(emptyHolding());
      }),

    removeStockHolding: (id, holdingIndex) =>
      set((s) => {
        s.snapshots[id].holdings.splice(holdingIndex, 1);
      }),

    updateHoldingTicker: (id, holdingIndex, ticker) =>
      set((s) => {
        const h = s.snapshots[id].holdings[holdingIndex];
        h.ticker = ticker;
        h.lots.forEach((l) => {
          l.ticker = ticker;
        });
      }),

    addLot: (id, holdingIndex) =>
      set((s) => {
        s.snapshots[id].holdings[holdingIndex].lots.push(emptyLot());
      }),

    removeLot: (id, holdingIndex, lotIndex) =>
      set((s) => {
        const h = s.snapshots[id].holdings[holdingIndex];
        if (h.lots.length > 1) h.lots.splice(lotIndex, 1);
      }),

    updateLot: (id, holdingIndex, lotIndex, partial) =>
      set((s) => {
        Object.assign(s.snapshots[id].holdings[holdingIndex].lots[lotIndex], partial);
      }),
  }))
);

export function useHoldingSnapshot(id: string): HoldingSnapshotNodeData {
  return useHoldingSnapshotStore((s) => s.snapshots[id] ?? emptyHoldingSnapshot());
}
