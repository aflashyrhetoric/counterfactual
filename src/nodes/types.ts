import type { Node, BuiltInNode } from '@xyflow/react';

export type StockTicker = string
export type Lot = {
    ticker: StockTicker;
    quantity: number;
    purchasePrice: number;
}

export type StockHolding = {
    ticker: StockTicker;
    lots: Lot[];
}

export type HoldingSnapshotNodeData = {
    label: string;
    date: string; // yyyy-mm-dd, the date of the snapshot
    holdings: StockHolding[];
    settlement_fund: number; // cash available for trading (rounded to dollars)
    marketOpenPrices: Record<StockTicker, number> | null; // dollar price of each ticker at market open on `date`
}

export type AnalysisNodeData = {
    label: string;
    // yyyy-mm-dd, derived from the earliest `date` among connected holding
    // snapshots — not user-editable.
    comparison_from_date: string;
    // yyyy-mm-dd, always today — not user-editable.
    comparison_to_date: string;
    // dollar price of each held ticker as of `comparison_to_date`
    marketPrices: Record<StockTicker, number> | null;
}

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>;
export type HoldingSnapshotNode = Node<Record<string, never>, 'holding-snapshot'>;
export type HoldingActionsNode = Node<Record<string, never>, 'holding-actions'>;
export type AnalysisNode = Node<Record<string, never>, 'analysis-node'>;
export type AppNode = BuiltInNode | PositionLoggerNode | HoldingSnapshotNode | HoldingActionsNode | AnalysisNode;
