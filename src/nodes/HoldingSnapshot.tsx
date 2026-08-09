import { useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';

import { type HoldingSnapshotNode, type HoldingSnapshotNodeData, type Lot, type StockHolding } from './types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';

function emptyLot(): Lot {
  return { ticker: '', quantity: 0, purchasePrice: 0 };
}

function emptyHolding(): StockHolding {
  return { ticker: '', lots: [emptyLot()] };
}

export function HoldingSnapshot({ id, data }: NodeProps<HoldingSnapshotNode>) {
  const { updateNodeData } = useReactFlow<HoldingSnapshotNode>();

  const patch = useCallback(
    (updater: (data: HoldingSnapshotNodeData) => Partial<HoldingSnapshotNodeData>) => {
      updateNodeData(id, (node) => updater(node.data));
    },
    [id, updateNodeData]
  );

  const updateHolding = (index: number, partial: Partial<StockHolding>) =>
    patch((data) => ({
      holdings: data.holdings.map((h, i) => (i === index ? { ...h, ...partial } : h)),
    }));

  const updateHoldingTicker = (index: number, ticker: string) =>
    patch((data) => ({
      holdings: data.holdings.map((h, i) =>
        i === index ? { ...h, ticker, lots: h.lots.map((l) => ({ ...l, ticker })) } : h
      ),
    }));

  const updateLot = (holdingIndex: number, lotIndex: number, partial: Partial<Lot>) =>
    patch((data) => ({
      holdings: data.holdings.map((h, i) =>
        i === holdingIndex
          ? { ...h, lots: h.lots.map((l, j) => (j === lotIndex ? { ...l, ...partial } : l)) }
          : h
      ),
    }));

  const addHolding = () => patch((data) => ({ holdings: [...data.holdings, emptyHolding()] }));

  const removeHolding = (index: number) =>
    patch((data) => ({ holdings: data.holdings.filter((_, i) => i !== index) }));

  const addLot = (holdingIndex: number) =>
    patch((data) => ({
      holdings: data.holdings.map((h, i) =>
        i === holdingIndex ? { ...h, lots: [...h.lots, emptyLot()] } : h
      ),
    }));

  const removeLot = (holdingIndex: number, lotIndex: number) =>
    patch((data) => ({
      holdings: data.holdings.map((h, i) =>
        i === holdingIndex && h.lots.length > 1
          ? { ...h, lots: h.lots.filter((_, j) => j !== lotIndex) }
          : h
      ),
    }));

  const selectedDate = data.date ? parseISO(data.date) : undefined;

  return (
    <Card className="w-80 py-3 gap-3">
      <CardHeader className="flex flex-col gap-2 px-3">
        <Input
          value={data.label}
          onChange={(e) => patch(() => ({ label: e.target.value }))}
          placeholder="Untitled snapshot"
          className="nodrag h-7 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:bg-input/50 focus-visible:px-2.5"
        />

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
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && patch(() => ({ date: format(date, 'yyyy-MM-dd') }))}
            />
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
              value={data.settlement_fund}
              onChange={(e) => patch(() => ({ settlement_fund: Math.round(Number(e.target.value) || 0) }))}
              className="nodrag pl-5"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Holdings</span>
            <Button variant="ghost" size="icon-sm" className="nodrag" onClick={addHolding}>
              <Plus />
            </Button>
          </div>

          {data.holdings.map((holding, hIndex) => (
            <div key={hIndex} className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={holding.ticker}
                  onChange={(e) => updateHoldingTicker(hIndex, e.target.value.toUpperCase())}
                  placeholder="Ticker"
                  className="nodrag h-7 uppercase"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="nodrag text-muted-foreground hover:text-destructive"
                  onClick={() => removeHolding(hIndex)}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                {holding.lots.map((lot, lIndex) => (
                  <div key={lIndex} className="flex items-center gap-1.5">
                    {/* <Input
                      value={lot.ticker}
                      onChange={(e) => updateLot(hIndex, lIndex, { ticker: e.target.value.toUpperCase() })}
                      placeholder="Lot ticker"
                      className="nodrag h-7 w-16 text-xs uppercase"
                    /> */}
                    <Input
                      type="number"
                      value={lot.quantity}
                      onChange={(e) => updateLot(hIndex, lIndex, { quantity: Number(e.target.value) || 0 })}
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
                        value={lot.purchasePrice}
                        onChange={(e) =>
                          updateLot(hIndex, lIndex, { purchasePrice: Math.round(Number(e.target.value) || 0) })
                        }
                        placeholder="Price"
                        className="nodrag h-7 pl-4 text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="nodrag text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => removeLot(hIndex, lIndex)}
                      disabled={holding.lots.length <= 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="nodrag self-start text-xs text-muted-foreground"
                  onClick={() => addLot(hIndex)}
                >
                  <Plus className="size-3.5" /> Add lot
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}
