export interface ParsedListing {
  sourceUrl: string;
  title?: string;
  address?: string;
  price?: number;
  priceRaw?: string;
  bedrooms?: number;
  propertyType?: string;
  imageUrl?: string;
  /** Extra fields kept for debugging when a value couldn't be cleanly extracted. */
  rawExtract?: Record<string, unknown>;
}

export interface ParseResult {
  listings: ParsedListing[];
  /** Set when nothing could be extracted at all, to explain parseStatus='failed'. */
  error?: string;
}
