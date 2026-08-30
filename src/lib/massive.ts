import { restClient, GetStocksAggregatesTimespanEnum } from '@massive.com/client-js';

const apiKey = import.meta.env.VITE_MASSIVE_API_KEY as string | undefined;

export const massive = apiKey ? restClient(apiKey) : null;

export type MarketOpenPriceResult =
  | { ticker: string; open: number; error?: undefined }
  | { ticker: string; open?: undefined; error: string };

// Fetches the market open price for each ticker on `date` (yyyy-mm-dd).
// One bad ticker doesn't abort the batch; failures come back inline.
export async function fetchMarketOpenPrices(
  tickers: string[],
  date: string
): Promise<MarketOpenPriceResult[]> {
  if (!massive) {
    return tickers.map((ticker) => ({ ticker, error: 'Missing VITE_MASSIVE_API_KEY' }));
  }

  return Promise.all(
    tickers.map(async (ticker) => {
      try {
        const resp = await massive.getStocksAggregates({
          stocksTicker: ticker,
          multiplier: 1,
          timespan: GetStocksAggregatesTimespanEnum.Day,
          from: date,
          to: date,
        });
        const bar = resp.results?.[0];
        if (!bar || typeof bar.o !== 'number') {
          return { ticker, error: 'No open price returned for that date' };
        }
        return { ticker, open: bar.o };
      } catch (e) {
        return { ticker, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );
}

export type LiveStockPriceResult =
  | { ticker: string; price: number; error?: undefined }
  | { ticker: string; price?: undefined; error: string };

// Fetches the most recent trade price for each ticker, right now — falls
// back to the latest minute/day/prev-day close if no trade is available
// (e.g. market closed). One request covers every ticker.
export async function fetchLiveStockPrices(tickers: string[]): Promise<LiveStockPriceResult[]> {
  if (!massive) {
    return tickers.map((ticker) => ({ ticker, error: 'Missing VITE_MASSIVE_API_KEY' }));
  }
  if (tickers.length === 0) return [];

  try {
    // The client's array serializer repeats `tickers=A&tickers=B&...`, but
    // this endpoint actually wants one comma-joined value (per its own doc
    // comment) — repeated params silently return only the first ticker
    // with a 200 OK, no error, so this isn't optional.
    const resp = await massive.getStocksSnapshotTickers({ tickers: [tickers.join(',')] });
    const byTicker = new Map((resp.tickers ?? []).map((t) => [t.ticker, t]));

    return tickers.map((ticker) => {
      const snap = byTicker.get(ticker);
      const price = snap?.lastTrade?.p ?? snap?.min?.c ?? snap?.day?.c ?? snap?.prevDay?.c;
      if (typeof price !== 'number') return { ticker, error: 'No live price available' };
      return { ticker, price };
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return tickers.map((ticker) => ({ ticker, error }));
  }
}
