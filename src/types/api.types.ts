// ─── Petrolimex (Array[0] and Array[2] from API) ─────────────────────────────

/**
 * A single fuel product entry from Petrolimex.
 * Zone 1 is typically the South, Zone 2 is the North (prices may differ slightly).
 */
export interface PetrolimexItem {
  title: string;
  zone1_price: number;
  zone2_price: number;
  /** ISO date string, e.g. "2024-06-01" – present in history records */
  date?: string;
  /** Some records expose a change delta vs. previous period */
  change?: number;
  [key: string]: unknown; // allow extra fields without breaking typing
}

// ─── Raw API response ─────────────────────────────────────────────────────────

/**
 * The raw tuple returned by the giaxanghomnay.com API endpoint.
 * We only consume index 0 (Petrolimex today); the rest are ignored.
 * Index 0 → petrolimex today
 * Index 1 → pvoil today        (unused)
 * Index 2 → petrolimex history (unused – we re-fetch per-date for history)
 * Index 3 → pvoil history      (unused)
 */
export type RawApiResponse = [PetrolimexItem[], unknown, unknown, unknown];

// ─── Processed / normalised structures ───────────────────────────────────────

export interface TodayPrices {
  date: string;
  petrolimex: PetrolimexItem[];
}

export interface HistoricalSnapshot {
  date: string;
  petrolimex: PetrolimexItem[];
}

/**
 * A detected price fluctuation alert.
 */
export interface PriceAlert {
  fuelTitle: string;
  source: 'Petrolimex';
  /** Price at the oldest date in the window */
  priceBefore: number;
  /** Price at today / most recent date */
  priceAfter: number;
  /** Absolute delta (always positive) */
  delta: number;
  /** '+' for increase, '-' for decrease */
  direction: '+' | '-';
  dateFrom: string;
  dateTo: string;
}

export interface AlertResult {
  alerts: PriceAlert[];
  windowDays: number;
  dateFrom: string;
  dateTo: string;
}
