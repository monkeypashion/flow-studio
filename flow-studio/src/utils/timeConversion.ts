/**
 * Time conversion utilities for converting between absolute ISO timestamps
 * and relative seconds (for rendering/calculations).
 *
 * Clips store absolute ISO timestamps, but all math happens in relative seconds.
 */

/**
 * Convert an ISO 8601 timestamp to relative seconds from a base time.
 * Used for rendering and calculations.
 *
 * @param isoTimestamp - ISO 8601 timestamp string (e.g., "2025-10-12T01:00:00.000Z")
 * @param baseTime - Base ISO 8601 timestamp (usually timeline.startTime)
 * @returns Relative seconds from baseTime
 *
 * @example
 * // If baseTime is "2025-10-12T00:00:00.000Z"
 * // and isoTimestamp is "2025-10-12T01:30:00.000Z"
 * // returns 5400 (1.5 hours in seconds)
 */
export const toRelativeSeconds = (isoTimestamp: string, baseTime: string): number => {
  const timestamp = new Date(isoTimestamp).getTime();
  const base = new Date(baseTime).getTime();
  return (timestamp - base) / 1000;
};

/**
 * Convert relative seconds from a base time to an absolute ISO 8601 timestamp.
 * Used for storing clip times.
 *
 * @param relativeSeconds - Seconds from baseTime
 * @param baseTime - Base ISO 8601 timestamp (usually timeline.startTime)
 * @returns ISO 8601 timestamp string
 *
 * @example
 * // If baseTime is "2025-10-12T00:00:00.000Z"
 * // and relativeSeconds is 3600 (1 hour)
 * // returns "2025-10-12T01:00:00.000Z"
 */
export const toAbsoluteTimestamp = (relativeSeconds: number, baseTime: string): string => {
  const baseDate = new Date(baseTime);
  const absoluteDate = new Date(baseDate.getTime() + relativeSeconds * 1000);
  return absoluteDate.toISOString();
};

/**
 * Calculate duration between two ISO timestamps in seconds.
 *
 * @param startISO - Start ISO 8601 timestamp
 * @param endISO - End ISO 8601 timestamp
 * @returns Duration in seconds
 *
 * @example
 * getDuration("2025-10-12T01:00:00.000Z", "2025-10-12T02:30:00.000Z")
 * // returns 5400 (1.5 hours in seconds)
 */
export const getDuration = (startISO: string, endISO: string): number => {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return (end - start) / 1000;
};

/**
 * Compare two ISO timestamps for sorting.
 *
 * @param a - First ISO 8601 timestamp
 * @param b - Second ISO 8601 timestamp
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export const compareTimestamps = (a: string, b: string): number => {
  return new Date(a).getTime() - new Date(b).getTime();
};

/**
 * Check if a timestamp falls within a time range.
 *
 * @param timestamp - ISO 8601 timestamp to check
 * @param rangeStart - Range start ISO 8601 timestamp
 * @param rangeEnd - Range end ISO 8601 timestamp
 * @returns true if timestamp is within [rangeStart, rangeEnd]
 */
export const isWithinRange = (timestamp: string, rangeStart: string, rangeEnd: string): boolean => {
  const time = new Date(timestamp).getTime();
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  return time >= start && time <= end;
};
