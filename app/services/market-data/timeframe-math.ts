// app/services/market-data/timeframe-math.ts

export type BaseTimeframe = '1s' | '1m' | '1d';
export type DerivedTimeframe = '5s' | '15s' | '30s' | '5m' | '15m' | '30m' | '1h' | '4h' | '1w' | '1M';
export type Timeframe = BaseTimeframe | DerivedTimeframe;

/**
 * Returns the duration of a timeframe in seconds.
 */
export function timeframeToSeconds(tf: Timeframe): number {
    const value = parseInt(tf.slice(0, -1));
    const unit = tf.slice(-1);

    if (unit === 's') return value;
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400;
    if (unit === 'w') return value * 604800;
    if (unit === 'M') return value * 2592000; // Approx 30 days
    return 86400;
}

/**
 * Determines the required base timeframe format to derive the requested timeframe.
 */
export function getBaseRequirement(tf: Timeframe): BaseTimeframe {
    const unit = tf.slice(-1);

    if (unit === 's') return '1s';
    if (unit === 'm' || unit === 'h') return '1m';
    if (unit === 'd' || unit === 'w' || unit === 'M') return '1d';

    return '1m'; // Default fallback
}

/**
 * Represents a raw financial bar.
 */
export interface RawBar {
    time: number; // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Aggregates a sorted array of base bars into derived bars.
 * Note: Assumes `baseBars` are already sorted chronologically.
 */
export function deriveBars(baseBars: RawBar[], targetTf: Timeframe): RawBar[] {
    if (baseBars.length === 0) return [];

    const targetIntervalSeconds = timeframeToSeconds(targetTf);

    // If the requested timeframe matches the base interval (e.g., asking for 1m derived from 1m), just return.
    // In reality, the orchestrator should not call deriveBars if base === target, but this is a safety net.
    if (targetIntervalSeconds <= 0) return baseBars;

    const derivedBars: RawBar[] = [];
    let currentBar: RawBar | null = null;
    let currentBucketStart = 0;

    for (const bar of baseBars) {
        // Calculate which time bucket this bar belongs to (aligned to UNIX epoch)
        const bucketStart = Math.floor(bar.time / targetIntervalSeconds) * targetIntervalSeconds;

        if (!currentBar || bucketStart > currentBucketStart) {
            // Push the completed aggregated bar to the result array
            if (currentBar) {
                derivedBars.push(currentBar);
            }

            // Start a new aggregation bucket
            currentBucketStart = bucketStart;
            currentBar = {
                time: bucketStart,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume
            };
        } else {
            // Aggregate into the current bucket
            currentBar.high = Math.max(currentBar.high, bar.high);
            currentBar.low = Math.min(currentBar.low, bar.low);
            currentBar.close = bar.close; // Latest close wins
            currentBar.volume += bar.volume;
        }
    }

    // Push the final lagging bar
    if (currentBar) {
        derivedBars.push(currentBar);
    }

    return derivedBars;
}
