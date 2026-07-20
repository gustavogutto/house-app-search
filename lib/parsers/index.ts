import type { ListingSource } from "../config";
import { SOURCE_SENDER_PATTERNS } from "../config";
import { parseDaft } from "./daft";
import { parseRentie } from "./rentie";
import { parseMyHome } from "./myhome";
import { parseGeneric } from "./generic";
import type { ParseResult } from "./types";

export function detectSource(fromEmail: string): ListingSource {
  const email = fromEmail.toLowerCase();
  for (const [source, patterns] of Object.entries(SOURCE_SENDER_PATTERNS)) {
    if (patterns.some((re) => re.test(email))) {
      return source as ListingSource;
    }
  }
  return "unknown";
}

const CONFIRMATION_KEYWORDS = [
  /confirm your (?:saved )?search/i,
  /confirm this alert/i,
  /verify your email/i,
  /activate your alert/i,
  /please confirm/i,
];

export function isConfirmationEmail(subject: string, html: string): boolean {
  return CONFIRMATION_KEYWORDS.some((re) => re.test(subject) || re.test(html));
}

export function extractConfirmationLink(html: string): string | undefined {
  const match = html.match(/https?:\/\/[^\s"'<>]*confirm[^\s"'<>]*/i);
  return match?.[0];
}

export function parseEmail(source: ListingSource, html: string): ParseResult {
  switch (source) {
    case "daft":
      return parseDaft(html);
    case "rentie":
      return parseRentie(html);
    case "myhome":
      return parseMyHome(html);
    default:
      return parseGeneric(html, "unknown");
  }
}

export * from "./types";
