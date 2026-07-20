export const KNOWN_SOURCES = ["daft", "rentie", "myhome"] as const;
export type ListingSource = (typeof KNOWN_SOURCES)[number] | "unknown";

export const SOURCE_SENDER_PATTERNS: Record<(typeof KNOWN_SOURCES)[number], RegExp[]> = {
  daft: [/@daft\.ie$/i],
  rentie: [/@rent\.ie$/i],
  myhome: [/@myhome\.ie$/i],
};

export const SOURCE_LISTING_URL_PATTERNS: Record<(typeof KNOWN_SOURCES)[number], RegExp> = {
  daft: /https?:\/\/(?:www\.)?daft\.ie\/for-rent\/[^\s"'<>]+/gi,
  rentie: /https?:\/\/(?:www\.)?rent\.ie\/renting\/[^\s"'<>]+/gi,
  myhome: /https?:\/\/(?:www\.)?myhome\.ie\/(?:rental|renting)\/[^\s"'<>]+/gi,
};

export const HEALTH_CHECK_SILENCE_HOURS = 48;
