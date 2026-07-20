import * as cheerio from "cheerio";
import type { ParseResult, ParsedListing } from "./types";
import { KNOWN_SOURCES, SOURCE_LISTING_URL_PATTERNS, type ListingSource } from "../config";

const PRICE_RE = /€\s?([\d,]+(?:\.\d{2})?)/;
const BEDROOMS_RE = /(\d+)\s*(?:bed(?:room)?s?)\b/i;

function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.search = "";
    url.hash = "";
    // strip trailing slash for consistent dedupe
    return url.toString().replace(/\/$/, "");
  } catch {
    return rawUrl;
  }
}

function extractPrice(text: string): { price?: number; priceRaw?: string } {
  const match = text.match(PRICE_RE);
  if (!match) return {};
  const priceRaw = match[0];
  const price = Math.round(parseFloat(match[1].replace(/,/g, "")));
  return { price, priceRaw };
}

function extractBedrooms(text: string): number | undefined {
  const match = text.match(BEDROOMS_RE);
  if (!match) return undefined;
  return parseInt(match[1], 10);
}

function patternsForSource(source: ListingSource): RegExp[] {
  if (source !== "unknown" && source in SOURCE_LISTING_URL_PATTERNS) {
    return [SOURCE_LISTING_URL_PATTERNS[source as (typeof KNOWN_SOURCES)[number]]];
  }
  return Object.values(SOURCE_LISTING_URL_PATTERNS);
}

/**
 * Generic fallback parser: finds anchors whose href matches a known listing
 * URL pattern, then scans the anchor's own text plus its nearest block-level
 * ancestor for price/bedroom hints. Works without knowing the exact per-site
 * email template, at the cost of being less precise than a tuned parser.
 */
export function parseGeneric(html: string, source: ListingSource): ParseResult {
  if (!html || html.trim().length === 0) {
    return { listings: [], error: "empty html body" };
  }

  const $ = cheerio.load(html);
  const patterns = patternsForSource(source);
  const seen = new Set<string>();
  const listings: ParsedListing[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const matchesKnownPattern = patterns.some((re) => {
      re.lastIndex = 0;
      return re.test(href);
    });
    if (!matchesKnownPattern) return;

    const sourceUrl = normalizeUrl(href);
    if (seen.has(sourceUrl)) return;
    seen.add(sourceUrl);

    const anchorText = $(el).text().trim();
    // walk up a couple ancestors to gather surrounding context (price/bedrooms
    // are often in a sibling element, not the anchor itself)
    const container = $(el).closest("td, tr, div, li").length
      ? $(el).closest("td, tr, div, li")
      : $(el).parent();
    const containerText = container.text().replace(/\s+/g, " ").trim();

    const { price, priceRaw } = extractPrice(containerText || anchorText);
    const bedrooms = extractBedrooms(containerText || anchorText);
    const imageUrl = container.find("img[src]").first().attr("src");

    listings.push({
      sourceUrl,
      title: anchorText || undefined,
      address: anchorText || undefined,
      price,
      priceRaw,
      bedrooms,
      imageUrl,
      rawExtract: { anchorText, containerTextSnippet: containerText.slice(0, 300) },
    });
  });

  if (listings.length === 0) {
    return { listings: [], error: "no known listing URL pattern matched" };
  }

  return { listings };
}
