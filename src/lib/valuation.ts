import type { HoldingSnapshotNodeData } from '@/nodes/types';

// A snapshot's total portfolio value on its own date: every held share
// priced at that snapshot's own recorded market-open price, plus cash.
// Returns null if any held ticker's price is unknown.
export function valueOfSnapshot(snap: HoldingSnapshotNodeData): number | null {
  let total = snap.settlement_fund;
  for (const holding of snap.holdings) {
    if (!holding.ticker) continue;
    const shares = holding.lots.reduce((sum, l) => sum + l.quantity, 0);
    if (shares === 0) continue;
    const price = snap.marketOpenPrices?.[holding.ticker];
    if (price == null) return null;
    total += shares * price;
  }
  return total;
}
