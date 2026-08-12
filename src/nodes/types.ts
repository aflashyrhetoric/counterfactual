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

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>;
export type HoldingSnapshotNode = Node<Record<string, never>, 'holding-snapshot'>;
export type AppNode = BuiltInNode | PositionLoggerNode | HoldingSnapshotNode;
