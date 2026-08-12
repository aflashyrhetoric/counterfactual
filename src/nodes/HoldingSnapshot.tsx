import { useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useDebounce } from '@uidotdev/usehooks';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { type HoldingSnapshotNode, type Lot, type StockHolding } from './types';
import { useHoldingSnapshot, useHoldingSnapshotStore } from '@/store/holdingSnapshots';
import { fetchMarketOpenPrices } from '@/lib/massive';
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

  return [local, setLocal] as const;
}

export function HoldingSnapshot({ id }: NodeProps<HoldingSnapshotNode>) {
  const data = useHoldingSnapshot(id);
  const updateLabel = useHoldingSnapshotStore((s) => s.updateLabel);
  const updateDate = useHoldingSnapshotStore((s) => s.updateDate);
  const updateSettlementFund = useHoldingSnapshotStore((s) => s.updateSettlementFund);
  const addHolding = useHoldingSnapshotStore((s) => s.addHolding);
  const setMarketOpenPrices = useHoldingSnapshotStore((s) => s.setMarketOpenPrices);
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
      console.log('marketOpenPrices', prices);
    } finally {
      setFetchingPrices(false);
    }
  }, [id, data.holdings, data.date, setMarketOpenPrices]);

  const selectedDate = data.date ? parseISO(data.date) : undefined;

  return (
    <Card className="w-80 py-3 gap-3">
      <CardHeader className="flex flex-col gap-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Untitled snapshot"
            className="nodrag h-7 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:bg-input/50 focus-visible:px-2.5"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="nodrag shrink-0 text-muted-foreground"
            title="Fetch market open prices"
            onClick={handleFetchPrices}
            disabled={fetchingPrices || !data.date || data.holdings.length === 0}
          >
            <RefreshCw className={fetchingPrices ? 'animate-spin' : undefined} />
          </Button>
        </div>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="nodrag w-fit justify-start font-normal" />
            }
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
            <HoldingCard key={hIndex} nodeId={id} holdingIndex={hIndex} holding={holding} />
          ))}
        </div>
      </CardContent>

      <Handle type="source" position={Position.Right} />
    </Card>
  );
}

function HoldingCard({
  nodeId,
  holdingIndex,
  holding,
}: {
  nodeId: string;
  holdingIndex: number;
  holding: StockHolding;
}) {
  const updateHoldingTicker = useHoldingSnapshotStore((s) => s.updateHoldingTicker);
  const removeStockHolding = useHoldingSnapshotStore((s) => s.removeStockHolding);
  const addLot = useHoldingSnapshotStore((s) => s.addLot);

  const [ticker, setTicker] = useDebouncedField(
    holding.ticker,
    useCallback(
      (v: string) => updateHoldingTicker(nodeId, holdingIndex, v),
      [nodeId, holdingIndex, updateHoldingTicker]
    )
  );
  const handleRemove = useCallback(
    () => removeStockHolding(nodeId, holdingIndex),
    [nodeId, holdingIndex, removeStockHolding]
  );
  const handleAddLot = useCallback(() => addLot(nodeId, holdingIndex), [nodeId, holdingIndex, addLot]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker"
          className="nodrag h-7 uppercase"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="nodrag text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {holding.lots.map((lot, lIndex) => (
          <LotRow
            key={lIndex}
            nodeId={nodeId}
            holdingIndex={holdingIndex}
            lotIndex={lIndex}
            lot={lot}
            canRemove={holding.lots.length > 1}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="nodrag self-start text-xs text-muted-foreground"
          onClick={handleAddLot}
        >
          <Plus className="size-3.5" /> Add lot
        </Button>
      </div>
    </div>
  );
}

function LotRow({
  nodeId,
  holdingIndex,
  lotIndex,
  lot,
  canRemove,
}: {
  nodeId: string;
  holdingIndex: number;
  lotIndex: number;
  lot: Lot;
  canRemove: boolean;
}) {
  const updateLot = useHoldingSnapshotStore((s) => s.updateLot);
  const removeLot = useHoldingSnapshotStore((s) => s.removeLot);

  const [quantity, setQuantity] = useDebouncedField(
    lot.quantity,
    useCallback(
      (v: number) => updateLot(nodeId, holdingIndex, lotIndex, { quantity: v }),
      [nodeId, holdingIndex, lotIndex, updateLot]
    )
  );
  const [purchasePrice, setPurchasePrice] = useDebouncedField(
    lot.purchasePrice,
    useCallback(
      (v: number) => updateLot(nodeId, holdingIndex, lotIndex, { purchasePrice: v }),
      [nodeId, holdingIndex, lotIndex, updateLot]
    )
  );
  const handleRemove = useCallback(
    () => removeLot(nodeId, holdingIndex, lotIndex),
    [nodeId, holdingIndex, lotIndex, removeLot]
  );

  return (
    <div className="flex items-center gap-1.5">
      {/* <Input
        value={lot.ticker}
        onChange={(e) => updateLot(hIndex, lIndex, { ticker: e.target.value.toUpperCase() })}
        placeholder="Lot ticker"
        className="nodrag h-7 w-16 text-xs uppercase"
      /> */}
      <Input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value) || 0)}
        placeholder="Qty"
        className="nodrag h-7 w-14 text-xs"
      />
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
        size="icon-sm"
        className="nodrag text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
        onClick={handleRemove}
        disabled={!canRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
