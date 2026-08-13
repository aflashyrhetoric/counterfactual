import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { HoldingSnapshotNodeData, Lot, StockHolding } from '@/nodes/types';

// A lot as tracked inside a HoldingActions node. `originalQuantity` is the
// quantity this lot had when it was cloned in from the source snapshot —
// it's the ceiling the Plus button can restore up to after a Minus on that
// lot, and never rises above it, since buying more of a pre-existing
// position needs its own new lot/price (see `buyNewLot`) rather than being
// merged into one bought at a different price. Lots created via `buyNewLot`
// during this session have no such history to preserve, so their ceiling is
// `Infinity` — Plus/Minus trade freely on them (bounded only by funds).
export type ActionsLot = Lot & { originalQuantity: number };
export type ActionsHolding = { ticker: string; lots: ActionsLot[] };

export type HoldingActionsNodeData = Omit<HoldingSnapshotNodeData, 'holdings'> & {
  holdings: ActionsHolding[];
  // Frozen copy of what this session started with (never mutated after
  // initActions) — the basis for the locked diff view, since it survives
  // even if a fully-sold-down lot/holding later gets removed from `holdings`.
  initialHoldings: StockHolding[];
  initialSettlementFund: number;
  locked: boolean;
};

function emptyActionsLot(): ActionsLot {
  return { ticker: '', quantity: 0, purchasePrice: 0, originalQuantity: 0 };
}

function emptyHoldingActions(): HoldingActionsNodeData {
  return {
    label: '',
    date: '',
    holdings: [],
    settlement_fund: 0,
    marketOpenPrices: null,
    initialHoldings: [],
    initialSettlementFund: 0,
    locked: false,
  };
}

// A single shared reference, not a fresh object per call — the selector
// below must return a referentially stable fallback for unknown ids, or
// useSyncExternalStore sees a "changed" snapshot on every render and loops.
const EMPTY_HOLDING_ACTIONS = emptyHoldingActions();

type HoldingActionsStore = {
  actions: Record<string, HoldingActionsNodeData>;

  initActions: (id: string, seed: HoldingSnapshotNodeData) => void;
  removeActions: (id: string) => void;
  loadActions: (actions: Record<string, HoldingActionsNodeData>) => void;
  lock: (id: string) => void;

  updateLabel: (id: string, label: string) => void;
  updateDate: (id: string, date: string) => void;
  updateSettlementFund: (id: string, value: number) => void;
  setMarketOpenPrices: (id: string, prices: Record<string, number>) => void;

  addHolding: (id: string) => void;
  removeStockHolding: (id: string, holdingIndex: number) => void;
  updateHoldingTicker: (id: string, holdingIndex: number, ticker: string) => void;

  removeLot: (id: string, holdingIndex: number, lotIndex: number) => void;
  updateLot: (id: string, holdingIndex: number, lotIndex: number, partial: Partial<Lot>) => void;

  // Buys a brand-new lot for this holding at today's known price (the only
  // way to increase total shares held beyond what this session started with).
  buyNewLot: (id: string, holdingIndex: number) => void;
  // Plus: reverts a previous sellOneShare on this specific lot, capped at
  // the lot's originalQuantity.
  buyOneShare: (id: string, holdingIndex: number, lotIndex: number) => void;
  // Minus: sells one share from this specific lot, down to 0.
  sellOneShare: (id: string, holdingIndex: number, lotIndex: number) => void;
};

export const useHoldingActionsStore = create<HoldingActionsStore>()(
  immer((set) => ({
    actions: {},

    initActions: (id, seed) =>
      set((s) => {
        if (s.actions[id]) return;
        s.actions[id] = {
          ...seed,
          holdings: seed.holdings.map((h) => ({
            ticker: h.ticker,
            lots: h.lots.map((l) => ({ ...l, originalQuantity: l.quantity })),
          })),
          initialHoldings: seed.holdings.map((h) => ({
            ticker: h.ticker,
            lots: h.lots.map((l) => ({ ...l })),
          })),
          initialSettlementFund: seed.settlement_fund,
          locked: false,
        };
      }),

    removeActions: (id) =>
      set((s) => {
        delete s.actions[id];
      }),

    loadActions: (actions) =>
      set((s) => {
        s.actions = actions;
      }),

    lock: (id) =>
      set((s) => {
        s.actions[id].locked = true;
      }),

    updateLabel: (id, label) =>
      set((s) => {
        if (s.actions[id].locked) return;
        s.actions[id].label = label;
      }),

    updateDate: (id, date) =>
      set((s) => {
        if (s.actions[id].locked) return;
        s.actions[id].date = date;
      }),

    updateSettlementFund: (id, value) =>
      set((s) => {
        if (s.actions[id].locked) return;
        s.actions[id].settlement_fund = value;
      }),

    setMarketOpenPrices: (id, prices) =>
      set((s) => {
        if (s.actions[id].locked) return;
        s.actions[id].marketOpenPrices = {
          ...s.actions[id].marketOpenPrices,
          ...prices,
        };
      }),

    addHolding: (id) =>
      set((s) => {
        if (s.actions[id].locked) return;
        s.actions[id].holdings.push({ ticker: '', lots: [emptyActionsLot()] });
      }),

    removeStockHolding: (id, holdingIndex) =>
      set((s) => {
        if (s.actions[id].locked) return;
        const h = s.actions[id].holdings[holdingIndex];
        if (h.lots.some((l) => l.quantity > 0)) return; // would destroy a cash-backed position
        s.actions[id].holdings.splice(holdingIndex, 1);
      }),

    updateHoldingTicker: (id, holdingIndex, ticker) =>
      set((s) => {
        if (s.actions[id].locked) return;
        const h = s.actions[id].holdings[holdingIndex];
        h.ticker = ticker;
        h.lots.forEach((l) => {
          l.ticker = ticker;
        });
      }),

    removeLot: (id, holdingIndex, lotIndex) =>
      set((s) => {
        if (s.actions[id].locked) return;
        const h = s.actions[id].holdings[holdingIndex];
        const lot = h.lots[lotIndex];
        if (h.lots.length <= 1 || lot.quantity > 0) return; // would destroy a cash-backed position
        h.lots.splice(lotIndex, 1);
      }),

    updateLot: (id, holdingIndex, lotIndex, partial) =>
      set((s) => {
        if (s.actions[id].locked) return;
        Object.assign(s.actions[id].holdings[holdingIndex].lots[lotIndex], partial);
      }),

    buyNewLot: (id, holdingIndex) =>
      set((s) => {
        const entry = s.actions[id];
        if (entry.locked) return;
        const holding = entry.holdings[holdingIndex];
        const price = entry.marketOpenPrices?.[holding.ticker];
        if (price == null || entry.settlement_fund < price) return;
        holding.lots.push({
          ticker: holding.ticker,
          quantity: 1,
          purchasePrice: price,
          originalQuantity: Infinity,
        });
        entry.settlement_fund -= price;
      }),

    buyOneShare: (id, holdingIndex, lotIndex) =>
      set((s) => {
        const entry = s.actions[id];
        if (entry.locked) return;
        const holding = entry.holdings[holdingIndex];
        const lot = holding.lots[lotIndex];
        const price = entry.marketOpenPrices?.[holding.ticker];
        if (price == null || lot.quantity >= lot.originalQuantity || entry.settlement_fund < price) return;
        lot.quantity += 1;
        entry.settlement_fund -= price;
      }),

    sellOneShare: (id, holdingIndex, lotIndex) =>
      set((s) => {
        const entry = s.actions[id];
        if (entry.locked) return;
        const holding = entry.holdings[holdingIndex];
        const lot = holding.lots[lotIndex];
        const price = entry.marketOpenPrices?.[holding.ticker];
        if (lot.quantity <= 0 || price == null) return;
        lot.quantity -= 1;
        entry.settlement_fund += price;
      }),
  }))
);

export function useHoldingActions(id: string): HoldingActionsNodeData {
  return useHoldingActionsStore((s) => s.actions[id] ?? EMPTY_HOLDING_ACTIONS);
}
