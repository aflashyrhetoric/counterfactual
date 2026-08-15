import { useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, Position, useEdges, useNodes, type Edge, type NodeProps } from '@xyflow/react';
import { useDebounce } from '@uidotdev/usehooks';
import { format, parseISO } from 'date-fns';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { type AnalysisNode as AnalysisNodeType, type AppNode, type StockTicker } from './types';
import { useAnalysis, useAnalysisStore } from '@/store/analysisNodes';
import { useHoldingSnapshotStore } from '@/store/holdingSnapshots';
import { fetchMarketOpenPrices } from '@/lib/massive';
import { valueOfSnapshot } from '@/lib/valuation';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

function useDebouncedField<T>(committedValue: T, commit: (value: T) => void, delay = 400) {
  const [local, setLocal] = useState(committedValue);
  const debounced = useDebounce(local, delay);

  useEffect(() => {
    if (debounced !== committedValue) commit(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setLocal(committedValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedValue]);

  return [local, setLocal] as const;
}

const currency = (n: number) => `$${n.toFixed(2)}`;

const chartConfig = {
  value: { label: 'Total value', color: 'var(--foreground)' },
} satisfies ChartConfig;

// Padding around the min/max value on the Y axis — scaling to the data's
// own range (instead of always starting at 0) is what makes real
// differences between snapshots visible.
const CHART_Y_PADDING = 5000;

// Walks backward from every node touching `id` — following incoming edges
// through HoldingActions nodes as well as HoldingSnapshot nodes — to find
// every HoldingSnapshot ancestor in the chain. This is how the "from" date
// (and the history chart) reflect the true start of the tracked history
// even when the Analysis node is attached several hops downstream of it,
// rather than just whatever snapshot it happens to touch directly.
function collectAncestorSnapshotIds(
  id: string,
  edges: Edge[],
  nodeTypeById: Map<string, string | undefined>
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const e of edges) {
    if (e.source === id) queue.push(e.target);
    else if (e.target === id) queue.push(e.source);
  }

  const snapshotIds: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    if (nodeTypeById.get(nodeId) === 'holding-snapshot') snapshotIds.push(nodeId);

    for (const e of edges) {
      if (e.target === nodeId) queue.push(e.source);
    }
  }

  return snapshotIds;
}

// Percent change per ticker from the earliest ancestor snapshot that had a
// recorded price for it, to today's live price — the basis for the
// up/down indicator in the holdings list.
function priceChangeByTicker(
  ancestorSnapshotIds: string[],
  snapshots: Record<string, { date: string; marketOpenPrices: Record<string, number> | null }>,
  currentPrices: Record<string, number> | null
): Map<string, number> {
  const earliestByTicker = new Map<string, { date: string; price: number }>();
  for (const sid of ancestorSnapshotIds) {
    const snap = snapshots[sid];
    if (!snap?.date || !snap.marketOpenPrices) continue;
    for (const [ticker, price] of Object.entries(snap.marketOpenPrices)) {
      const existing = earliestByTicker.get(ticker);
      if (!existing || snap.date < existing.date) earliestByTicker.set(ticker, { date: snap.date, price });
    }
  }

  const changes = new Map<string, number>();
  for (const [ticker, { price: fromPrice }] of earliestByTicker) {
    const toPrice = currentPrices?.[ticker];
    if (toPrice == null || fromPrice === 0) continue;
    changes.set(ticker, ((toPrice - fromPrice) / fromPrice) * 100);
  }
  return changes;
}

export function AnalysisNode({ id }: NodeProps<AnalysisNodeType>) {
  const data = useAnalysis(id);
  const updateLabel = useAnalysisStore((s) => s.updateLabel);
  const setComparisonDates = useAnalysisStore((s) => s.setComparisonDates);
  const setMarketPrices = useAnalysisStore((s) => s.setMarketPrices);
  const snapshots = useHoldingSnapshotStore((s) => s.snapshots);
  const allNodes = useNodes<AppNode>();
  const allEdges = useEdges();
  const [fetchingPrices, setFetchingPrices] = useState(false);

  const [label, setLabel] = useDebouncedField(
    data.label,
    useCallback((v: string) => updateLabel(id, v), [id, updateLabel])
  );

  const nodeTypeById = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const n of allNodes) m.set(n.id, n.type);
    return m;
  }, [allNodes]);

  // Holdings/value come from whatever snapshot(s) are directly attached —
  // each snapshot already carries the full current position, not a delta.
  const connectedSnapshots = useMemo(() => {
    const ids = new Set<string>();
    for (const e of allEdges) {
      if (e.source === id && nodeTypeById.get(e.target) === 'holding-snapshot') ids.add(e.target);
      else if (e.target === id && nodeTypeById.get(e.source) === 'holding-snapshot') ids.add(e.source);
    }
    return [...ids].map((sid) => snapshots[sid]).filter(Boolean);
  }, [allEdges, id, nodeTypeById, snapshots]);

  // The "from" date, though, walks all the way back through the chain —
  // not just the directly attached snapshot(s).
  const ancestorSnapshotIds = useMemo(
    () => collectAncestorSnapshotIds(id, allEdges, nodeTypeById),
    [id, allEdges, nodeTypeById]
  );
  const earliestDate = useMemo(
    () =>
      ancestorSnapshotIds
        .map((sid) => snapshots[sid]?.date)
        .filter((d): d is string => Boolean(d))
        .sort()[0] ?? '',
    [ancestorSnapshotIds, snapshots]
  );
  const today = format(new Date(), 'yyyy-MM-dd');

  // comparison_from_date tracks the earliest connected snapshot;
  // comparison_to_date is always today. Neither is user-editable.
  useEffect(() => {
    if (earliestDate !== data.comparison_from_date || today !== data.comparison_to_date) {
      setComparisonDates(id, earliestDate, today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, earliestDate, today]);

  // Total shares held per ticker, summed across every lot in every
  // connected snapshot.
  const sharesByTicker = useMemo(() => {
    const totals = new Map<StockTicker, number>();
    for (const snap of connectedSnapshots) {
      for (const holding of snap.holdings) {
        if (!holding.ticker) continue;
        const shares = holding.lots.reduce((sum, l) => sum + l.quantity, 0);
        totals.set(holding.ticker, (totals.get(holding.ticker) ?? 0) + shares);
      }
    }
    return totals;
  }, [connectedSnapshots]);

  const tickers = useMemo(() => [...sharesByTicker.keys()].sort(), [sharesByTicker]);
  const totalSettlementFund = useMemo(
    () => connectedSnapshots.reduce((sum, s) => sum + s.settlement_fund, 0),
    [connectedSnapshots]
  );

  // Auto-fetch today's prices whenever the set of held tickers changes.
  const tickerKey = tickers.join(',');
  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;

    setFetchingPrices(true);
    fetchMarketOpenPrices(tickers, today)
      .then((results) => {
        if (cancelled) return;
        const prices: Record<string, number> = {};
        const failed: string[] = [];
        for (const r of results) {
          if (typeof r.open === 'number') prices[r.ticker] = r.open;
          else failed.push(r.ticker);
        }
        if (Object.keys(prices).length > 0) setMarketPrices(id, prices);
        if (failed.length > 0) toast.error(`Couldn't fetch prices for ${failed.join(', ')}`);
      })
      .finally(() => {
        if (!cancelled) setFetchingPrices(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tickerKey, today, setMarketPrices]);

  const holdingsValue = tickers.reduce((sum, ticker) => {
    const price = data.marketPrices?.[ticker];
    if (price == null) return sum;
    return sum + price * (sharesByTicker.get(ticker) ?? 0);
  }, 0);
  const allPricesKnown = tickers.every((t) => data.marketPrices?.[t] != null);
  const totalValue = holdingsValue + totalSettlementFund;

  const priceChanges = useMemo(
    () => priceChangeByTicker(ancestorSnapshotIds, snapshots, data.marketPrices),
    [ancestorSnapshotIds, snapshots, data.marketPrices]
  );

  // One point per ancestor snapshot (valued at its own recorded prices),
  // plus today's live total — the history this Analysis node can chart.
  const chartData = useMemo(() => {
    const points: { date: string; value: number }[] = [];
    for (const sid of ancestorSnapshotIds) {
      const snap = snapshots[sid];
      if (!snap?.date) continue;
      const value = valueOfSnapshot(snap);
      if (value != null) points.push({ date: snap.date, value });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    if (allPricesKnown && connectedSnapshots.length > 0) {
      points.push({ date: today, value: totalValue });
    }
    return points;
  }, [ancestorSnapshotIds, snapshots, allPricesKnown, connectedSnapshots.length, totalValue, today]);

  const yDomain = useMemo((): [number, number] | undefined => {
    if (chartData.length === 0) return undefined;
    const values = chartData.map((p) => p.value);
    return [Math.min(...values) - CHART_Y_PADDING, Math.max(...values) + CHART_Y_PADDING];
  }, [chartData]);

  return (
    <Card className="w-80 py-3 gap-3">
      <Handle type="target" position={Position.Left} />

      <CardHeader className="flex flex-col gap-2 px-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Untitled analysis"
          className="nodrag h-7 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:bg-input/50 focus-visible:px-2.5"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.comparison_from_date || '—'}</span>
          <span>→</span>
          <span>{data.comparison_to_date || today}</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-3">
        {connectedSnapshots.length === 0 ? (
          <p className="text-xs text-muted-foreground">Connect a holding snapshot to analyze it.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Holdings</span>
                {fetchingPrices && <span className="text-xs text-muted-foreground">Fetching prices…</span>}
              </div>
              {tickers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No shares held.</p>
              ) : (
                <div className="flex flex-col gap-1 rounded-2xl bg-muted/40 p-2.5">
                  {tickers.map((ticker) => {
                    const change = priceChanges.get(ticker);
                    const color =
                      change == null
                        ? undefined
                        : change > 5
                          ? 'text-emerald-600'
                          : change < -5
                            ? 'text-destructive'
                            : undefined;
                    return (
                      <div key={ticker} className="flex items-center justify-between text-xs">
                        <span className="font-medium uppercase">{ticker}</span>
                        <span className={color}>
                          {change != null ? `${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Settlement fund</span>
              <span className="text-muted-foreground">{currency(totalSettlementFund)}</span>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total value</span>
                <span className="text-sm font-semibold">{allPricesKnown ? currency(totalValue) : '—'}</span>
              </div>
              {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="nodrag aspect-auto h-20 w-full">
                  <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`analysis-value-${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      minTickGap={32}
                      fontSize={10}
                      tickFormatter={(value: string) => format(parseISO(value), 'MMM d')}
                    />
                    <YAxis hide domain={yDomain} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(value) => format(parseISO(value as string), 'PPP')}
                          formatter={(value) => currency(value as number)}
                        />
                      }
                    />
                    <Area
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      fill={`url(#analysis-value-${id})`}
                      dot={false}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <p className="text-xs text-muted-foreground">Not enough priced history to chart yet.</p>
              )}
            </div>
          </>
        )}
      </CardContent>

      <Handle type="source" position={Position.Right} />
    </Card>
  );
}
