import { useCallback, useEffect, useState } from 'react';
import { addEdge, Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { useDebounce } from '@uidotdev/usehooks';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { type HoldingActionsNode } from './types';
import {
  useHoldingActions,
  useHoldingActionsStore,
  type ActionsHolding,
  type ActionsLot,
} from '@/store/holdingActions';
import { useHoldingSnapshotStore } from '@/store/holdingSnapshots';
import { fetchMarketOpenPrices } from '@/lib/massive';
import { DEFAULT_NODE_WIDTH, NODE_SPACING, findOpenSpot, getNodeId } from '@/lib/flow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';

function useDebouncedField<T>(committedValue: T, commit: (value: T) => void, delay = 400) {
  const [local, setLocal] = useState(committedValue);
  const debounced = useDebounce(local, delay);

  useEffect(() => {
    if (debounced !== committedValue) commit(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Resync when the store changes from outside this field (e.g. the buy/sell
  // buttons mutating quantity directly) rather than through our own commit.
  useEffect(() => {
    setLocal(committedValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedValue]);

  return [local, setLocal] as const;
}

export function HoldingActions({ id }: NodeProps<HoldingActionsNode>) {
  const data = useHoldingActions(id);
  const updateLabel = useHoldingActionsStore((s) => s.updateLabel);
  const updateDate = useHoldingActionsStore((s) => s.updateDate);
  const updateSettlementFund = useHoldingActionsStore((s) => s.updateSettlementFund);
  const addHolding = useHoldingActionsStore((s) => s.addHolding);
  const lock = useHoldingActionsStore((s) => s.lock);
  const setMarketOpenPrices = useHoldingActionsStore((s) => s.setMarketOpenPrices);
  const initHolding = useHoldingSnapshotStore((s) => s.initHolding);
  const { getNode, getIntersectingNodes, setNodes, setEdges } = useReactFlow();
  const [fetchingPrices, setFetchingPrices] = useState(false);

  const [label, setLabel] = useDebouncedField(
    data.label,
    useCallback((v: string) => updateLabel(id, v), [id, updateLabel])
  );
  const [settlementFund, setSettlementFund] = useDebouncedField(
    data.settlement_fund,
    useCallback((v: number) => updateSettlementFund(id, v), [id, updateSettlementFund])
  );

  const handleDateSelect = useCallback(
    (date: Date | undefined) => date && updateDate(id, format(date, 'yyyy-MM-dd')),
    [id, updateDate]
  );
  const handleAddHolding = useCallback(() => addHolding(id), [id, addHolding]);

  const handleFetchPrices = useCallback(async () => {
    if (data.locked) return;
    const tickers = [...new Set(data.holdings.map((h) => h.ticker).filter(Boolean))];
    if (tickers.length === 0 || !data.date) return;

    setFetchingPrices(true);
    try {
      const results = await fetchMarketOpenPrices(tickers, data.date);
      const prices: Record<string, number> = {};
      const failed: string[] = [];
      for (const r of results) {
        if (typeof r.open === 'number') prices[r.ticker] = r.open;
        else failed.push(r.ticker);
      }
      if (Object.keys(prices).length > 0) setMarketOpenPrices(id, prices);
      if (failed.length > 0) toast.error(`Couldn't fetch prices for ${failed.join(', ')}`);
    } finally {
      setFetchingPrices(false);
    }
  }, [id, data.locked, data.holdings, data.date, setMarketOpenPrices]);

  const handleCreateSnapshot = useCallback(() => {
    if (data.locked) return;

    const self = getNode(id);
    const origin = self
      ? { x: self.position.x + DEFAULT_NODE_WIDTH + NODE_SPACING, y: self.position.y }
      : { x: 0, y: 0 };
    const position = findOpenSpot(getIntersectingNodes, origin);
    const newId = getNodeId();

    initHolding(newId, {
      label: data.label,
      date: data.date,
      holdings: data.holdings.map((h) => ({
        ticker: h.ticker,
        lots: h.lots.map((l) => ({ ticker: l.ticker, quantity: l.quantity, purchasePrice: l.purchasePrice })),
      })),
      settlement_fund: data.settlement_fund,
      marketOpenPrices: data.marketOpenPrices ? structuredClone(data.marketOpenPrices) : null,
    });

    setNodes((nodes) => nodes.concat({ id: newId, type: 'holding-snapshot', position, data: {} }));
    setEdges((edges) => addEdge({ source: id, target: newId, sourceHandle: null, targetHandle: null }, edges));

    lock(id);
  }, [id, data, getNode, getIntersectingNodes, setNodes, setEdges, initHolding, lock]);

  const selectedDate = data.date ? parseISO(data.date) : undefined;

  if (data.locked) {
    return (
      <Card className="w-80 bg-pink-50 py-3 gap-3">
        <Handle type="target" position={Position.Left} />

        <CardHeader className="flex flex-col gap-1 px-3">
          {/* <span className="text-base font-medium">{data.label || 'Untitled actions'}</span> */}
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Untitled actions"
            className="nodrag h-7 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:bg-input/50 focus-visible:px-2.5"
          />
          <span className="text-xs text-muted-foreground">
            {selectedDate ? format(selectedDate, 'PPP') : 'No date'}
          </span>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-3">
          <ActionsDiffView data={data} />
        </CardContent>

        <Handle type="source" position={Position.Right} />
      </Card>
    );
  }

  return (
    <Card className="w-80 py-3 gap-3">
      <Handle type="target" position={Position.Left} />

      <CardHeader className="flex flex-col gap-2 px-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Untitled actions"
          className="nodrag h-7 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:bg-input/50 focus-visible:px-2.5"
        />

        <Button
          variant="outline"
          size="sm"
          className="nodrag w-fit"
          onClick={handleFetchPrices}
          disabled={fetchingPrices || !data.date || data.holdings.length === 0}
        >
          <RefreshCw className={fetchingPrices ? 'animate-spin' : undefined} />
          {fetchingPrices ? 'Fetching…' : 'Fetch Prices'}
        </Button>

        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" size="sm" className="nodrag w-fit justify-start font-normal" />}
          >
            <CalendarIcon className="opacity-60" />
            {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
          </PopoverTrigger>
          <PopoverContent className="nodrag w-auto p-0">
            <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} />
          </PopoverContent>
        </Popover>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-settlement`} className="text-xs text-muted-foreground">
            Settlement fund
          </Label>
          <div className="relative w-28">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`${id}-settlement`}
              type="number"
              step="1"
              min="0"
              value={settlementFund}
              onChange={(e) => setSettlementFund(Math.round(Number(e.target.value) || 0))}
              className="nodrag pl-5"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Holdings</span>
            <Button variant="ghost" size="icon-sm" className="nodrag" onClick={handleAddHolding}>
              <Plus />
            </Button>
          </div>

          {data.holdings.map((holding, hIndex) => (
            <ActionsHoldingCard key={hIndex} nodeId={id} holdingIndex={hIndex} holding={holding} />
          ))}
        </div>

        {data.marketOpenPrices && (
          <>
            <Separator />
            <ActionsMarketOpenPrices prices={data.marketOpenPrices} />
          </>
        )}

        <Separator />

        <Button className="nodrag" onClick={handleCreateSnapshot}>
          Create New Snapshot
        </Button>
      </CardContent>

      <Handle type="source" position={Position.Right} />
    </Card>
  );
}

function computeHoldingDiffs(
  initial: { ticker: string; lots: { quantity: number }[] }[],
  current: { ticker: string; lots: { quantity: number }[] }[]
): { ticker: string; delta: number }[] {
  const totals = new Map<string, { initial: number; current: number }>();

  for (const h of initial) {
    const t = totals.get(h.ticker) ?? { initial: 0, current: 0 };
    t.initial += h.lots.reduce((sum, l) => sum + l.quantity, 0);
    totals.set(h.ticker, t);
  }
  for (const h of current) {
    const t = totals.get(h.ticker) ?? { initial: 0, current: 0 };
    t.current += h.lots.reduce((sum, l) => sum + l.quantity, 0);
    totals.set(h.ticker, t);
  }

  return [...totals.entries()]
    .map(([ticker, { initial, current }]) => ({ ticker, delta: current - initial }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function ActionsDiffView({ data }: { data: ReturnType<typeof useHoldingActions> }) {
  const diffs = computeHoldingDiffs(data.initialHoldings, data.holdings);
  const fundDelta = data.settlement_fund - data.initialSettlementFund;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Trades made</span>
        {diffs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No share changes.</p>
        ) : (
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/40 p-2.5">
            {diffs.map((d) => (
              <div key={d.ticker} className="flex items-center justify-between text-xs">
                <span className="font-medium uppercase">{d.ticker}</span>
                <span className={d.delta < 0 ? 'text-destructive' : undefined}>
                  {d.delta > 0 ? `+${d.delta} bought` : `${Math.abs(d.delta)} sold`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">Settlement fund</span>
        <span className={fundDelta < 0 ? 'text-destructive' : undefined}>
          ${data.initialSettlementFund.toFixed(2)} → ${data.settlement_fund.toFixed(2)} (
          {fundDelta >= 0 ? '+' : ''}
          {fundDelta.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

function ActionsMarketOpenPrices({ prices }: { prices: Record<string, number> }) {
  const entries = Object.entries(prices);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Market open prices</span>
      <div className="flex flex-col gap-1 rounded-2xl bg-muted/40 p-2.5">
        {entries.map(([ticker, price]) => (
          <div key={ticker} className="flex items-center justify-between text-xs">
            <span className="font-medium uppercase">{ticker}</span>
            <span className="text-muted-foreground">${price.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionsHoldingCard({
  nodeId,
  holdingIndex,
  holding,
}: {
  nodeId: string;
  holdingIndex: number;
  holding: ActionsHolding;
}) {
  const updateHoldingTicker = useHoldingActionsStore((s) => s.updateHoldingTicker);
  const removeStockHolding = useHoldingActionsStore((s) => s.removeStockHolding);
  const buyNewLot = useHoldingActionsStore((s) => s.buyNewLot);
  const sellAllLots = useHoldingActionsStore((s) => s.sellAllLots);
  const data = useHoldingActions(nodeId);

  const [ticker, setTicker] = useDebouncedField(
    holding.ticker,
    useCallback(
      (v: string) => updateHoldingTicker(nodeId, holdingIndex, v),
      [nodeId, holdingIndex, updateHoldingTicker]
    )
  );
  const canRemoveHolding = holding.lots.every((l) => l.quantity <= 0);
  const handleRemove = useCallback(
    () => removeStockHolding(nodeId, holdingIndex),
    [nodeId, holdingIndex, removeStockHolding]
  );
  const handleAddLot = useCallback(() => buyNewLot(nodeId, holdingIndex), [nodeId, holdingIndex, buyNewLot]);
  const handleSellAllLots = useCallback(
    () => sellAllLots(nodeId, holdingIndex),
    [nodeId, holdingIndex, sellAllLots]
  );

  const price = data.marketOpenPrices?.[holding.ticker];
  const canAddLot = price != null && data.settlement_fund >= price;
  const canSellAllLots = price != null && holding.lots.some((l) => l.quantity > 0);

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-2.5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="nodrag text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
          onClick={handleSellAllLots}
          title="Sell all lots in this holding"
          disabled={!canSellAllLots}
        >
          <Minus className="size-3.5" />
        </Button>
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker"
          className="nodrag h-7 uppercase"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="nodrag text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
          onClick={handleRemove}
          disabled={!canRemoveHolding}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {holding.lots.map((lot, lIndex) => (
          <ActionsLotRow key={lIndex} nodeId={nodeId} holdingIndex={holdingIndex} lotIndex={lIndex} lot={lot} />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="nodrag self-start text-xs text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
          onClick={handleAddLot}
          disabled={!canAddLot}
        >
          <Plus className="size-3.5" /> Add lot (buy at ${price?.toFixed(2) ?? '—'})
        </Button>
      </div>
    </div>
  );
}

function ActionsLotRow({
  nodeId,
  holdingIndex,
  lotIndex,
  lot,
}: {
  nodeId: string;
  holdingIndex: number;
  lotIndex: number;
  lot: ActionsLot;
}) {
  const updateLot = useHoldingActionsStore((s) => s.updateLot);
  const buyOneShare = useHoldingActionsStore((s) => s.buyOneShare);
  const sellOneShare = useHoldingActionsStore((s) => s.sellOneShare);
  const sellAllShares = useHoldingActionsStore((s) => s.sellAllShares);
  const data = useHoldingActions(nodeId);

  const [purchasePrice, setPurchasePrice] = useDebouncedField(
    lot.purchasePrice,
    useCallback(
      (v: number) => updateLot(nodeId, holdingIndex, lotIndex, { purchasePrice: v }),
      [nodeId, holdingIndex, lotIndex, updateLot]
    )
  );
  const handleBuy = useCallback(
    () => buyOneShare(nodeId, holdingIndex, lotIndex),
    [nodeId, holdingIndex, lotIndex, buyOneShare]
  );
  const handleSell = useCallback(
    () => sellOneShare(nodeId, holdingIndex, lotIndex),
    [nodeId, holdingIndex, lotIndex, sellOneShare]
  );
  const handleSellAll = useCallback(
    () => sellAllShares(nodeId, holdingIndex, lotIndex),
    [nodeId, holdingIndex, lotIndex, sellAllShares]
  );

  const price = data.marketOpenPrices?.[lot.ticker];
  const canSell = lot.quantity > 0 && price != null;
  const canBuy = lot.quantity < lot.originalQuantity && price != null && data.settlement_fund >= price;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="nodrag text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
        onClick={handleSell}
        title="Sell one share"
        disabled={!canSell}
      >
        <Minus className="size-3.5" />
      </Button>
      <Input
        type="number"
        value={lot.quantity}
        readOnly
        disabled
        title={
          Number.isFinite(lot.originalQuantity)
            ? `Up to ${lot.originalQuantity} from this session's starting position`
            : 'Bought this session — trades freely'
        }
        placeholder="Qty"
        className="nodrag h-7 w-14 text-xs"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="nodrag text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
        onClick={handleBuy}
        title="Undo a sell (buy back up to this session's starting quantity)"
        disabled={!canBuy}
      >
        <Plus className="size-3.5" />
      </Button>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          $
        </span>
        <Input
          type="number"
          step="1"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(Math.round(Number(e.target.value) || 0))}
          placeholder="Price"
          className="nodrag h-7 pl-4 text-xs"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="nodrag h-7 px-2 text-xs text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
        onClick={handleSellAll}
        title="Sell all shares in this lot"
        disabled={!canSell}
      >
        Sell All
      </Button>
    </div>
  );
}
