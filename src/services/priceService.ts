import {
  PetrolimexItem,
  RawApiResponse,
  TodayPrices,
  HistoricalSnapshot,
  AlertResult,
  PriceAlert,
} from '../types/api.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://giaxanghomnay.com/api/pvdate';

/** Hard timeout per fetch. Unofficial API – can be slow or unresponsive. */
const FETCH_TIMEOUT_MS = 8_000;

/** Number of past days to look back for the fluctuation alert. */
const ALERT_WINDOW_DAYS = 10;

/** Minimum price delta (VNĐ) to trigger an alert. */
const ALERT_THRESHOLD_VND = 1_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a date string in "YYYY-MM-DD" format for a given offset from today.
 * @param offsetDays  0 = today, -1 = yesterday, -9 = 9 days ago, etc.
 */
function getDateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches and validates the raw API payload for a specific date.
 * Returns `null` on any error so callers can handle gracefully.
 */
async function fetchRawForDate(date: string): Promise<RawApiResponse | null> {
  const url = `${BASE_URL}/${date}`;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timerId);

    if (!response.ok) {
      console.warn(`[priceService] HTTP ${response.status} for date ${date}`);
      return null;
    }

    const text = await response.text();

    // Guard: empty or whitespace-only body
    if (!text.trim()) {
      console.warn(`[priceService] Empty body for date ${date}`);
      return null;
    }

    const parsed: unknown = JSON.parse(text);

    // Guard: must be an array with at least 4 elements
    if (!Array.isArray(parsed) || parsed.length < 4) {
      console.warn(`[priceService] Unexpected shape for date ${date}`, parsed);
      return null;
    }

    const raw = parsed as RawApiResponse;

    // Guard: each sub-array must also be an array
    for (let i = 0; i < 4; i++) {
      if (!Array.isArray(raw[i])) {
        console.warn(`[priceService] raw[${i}] is not an array for date ${date}`);
        return null;
      }
    }

    return raw;
  } catch (err) {
    clearTimeout(timerId);

    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[priceService] Timeout fetching data for date ${date}`);
    } else {
      console.error(`[priceService] Error fetching date ${date}:`, err);
    }

    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches today's gasoline prices.
 * Returns `null` if the API is unreachable or returns malformed data.
 */
export async function fetchTodayPrices(): Promise<TodayPrices | null> {
  const date = getDateString(0);
  const raw = await fetchRawForDate(date);
  if (!raw) return null;

  return {
    date,
    petrolimex: raw[0] as PetrolimexItem[],
  };
}

/**
 * Fetches historical snapshots for the last `days` days using `Promise.all`
 * so all requests fire concurrently instead of sequentially.
 *
 * Dates that fail are silently dropped – only successful snapshots are returned.
 */
export async function fetchHistoricalSnapshots(
  days: number = ALERT_WINDOW_DAYS
): Promise<HistoricalSnapshot[]> {
  // Build offset array: 0 = today, -(days-1) = oldest
  const offsets = Array.from({ length: days }, (_, i) => -i);

  const results = await Promise.all(
    offsets.map(async (offset): Promise<HistoricalSnapshot | null> => {
      const date = getDateString(offset);
      const raw = await fetchRawForDate(date);
      if (!raw) return null;

      return {
        date,
        petrolimex: raw[0] as PetrolimexItem[],
      };
    })
  );

  // Filter out failed fetches and sort chronologically (oldest → newest)
  const valid = results
    .filter((s): s is HistoricalSnapshot => s !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return valid;
}

/**
 * Runs the 10-day price fluctuation detection.
 *
 * Algorithm:
 *  1. Fetch all snapshots concurrently over the window.
 *  2. For each unique fuel title, compare the price at the oldest available
 *     date vs. the most recent date.
 *  3. If |delta| >= ALERT_THRESHOLD_VND, emit an alert.
 */
export async function detect10DayFluctuations(): Promise<AlertResult> {
  const snapshots = await fetchHistoricalSnapshots(ALERT_WINDOW_DAYS);

  const alerts: PriceAlert[] = [];

  if (snapshots.length < 2) {
    // Not enough data to compare
    return {
      alerts,
      windowDays: ALERT_WINDOW_DAYS,
      dateFrom: snapshots[0]?.date ?? 'N/A',
      dateTo: snapshots[snapshots.length - 1]?.date ?? 'N/A',
    };
  }

  const oldest = snapshots[0];
  const newest = snapshots[snapshots.length - 1];

  // ── Petrolimex ──────────────────────────────────────────────────────────
  for (const newItem of newest.petrolimex) {
    const oldItem = oldest.petrolimex.find((p) => p.title === newItem.title);
    if (!oldItem) continue;

    // Use Zone 1 price as the canonical comparison value
    const priceBefore = oldItem.zone1_price;
    const priceAfter = newItem.zone1_price;
    const delta = Math.abs(priceAfter - priceBefore);

    if (delta >= ALERT_THRESHOLD_VND) {
      alerts.push({
        fuelTitle: newItem.title,
        source: 'Petrolimex',
        priceBefore,
        priceAfter,
        delta,
        direction: priceAfter > priceBefore ? '+' : '-',
        dateFrom: oldest.date,
        dateTo: newest.date,
      });
    }
  }


  return {
    alerts,
    windowDays: ALERT_WINDOW_DAYS,
    dateFrom: oldest.date,
    dateTo: newest.date,
  };
}
