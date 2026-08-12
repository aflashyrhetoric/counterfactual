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
