import { parseGeneric } from "./generic";
import type { ParseResult } from "./types";

/**
 * Rent.ie alert emails haven't been sampled yet — this delegates to the
 * generic pattern-matching parser. Once real alert emails are captured
 * (see /dashboard/[emailId]/raw), tighten this against the actual template
 * and re-run `npm run reparse` to backfill.
 */
export function parseRentie(html: string): ParseResult {
  return parseGeneric(html, "rentie");
}
