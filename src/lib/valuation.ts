import type { HoldingSnapshotNodeData, StockTicker } from '@/nodes/types';

// A snapshot's total portfolio value: every held share priced from
// `prices` (per-ticker), plus cash. `prices` is caller-supplied rather
// than always read off the snapshot itself, since "value" is ambiguous
// on its own — the snapshot's own recorded market-open price values it
// as of its own date, while today's live price values it right now, and
// those are genuinely different numbers (neither is lot cost/basis).
// Returns null if any held ticker's price is missing from `prices`.
export function valueOfSnapshot(
  snap: Pick<HoldingSnapshotNodeData, 'settlement_fund' | 'holdings'>,
  prices: Record<StockTicker, number> | null
): number | null {
  let total = snap.settlement_fund;
  for (const holding of snap.holdings) {
    if (!holding.ticker) continue;
    const shares = holding.lots.reduce((sum, l) => sum + l.quantity, 0);
    if (shares === 0) continue;
    const price = prices?.[holding.ticker];
    if (price == null) return null;
    total += shares * price;
  }
  return total;
}
