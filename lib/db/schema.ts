import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const inboundEmails = pgTable("inbound_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull().default("unknown"), // daft | rentie | myhome | unknown
  messageId: text("message_id"),
  fromEmail: text("from_email"),
  subject: text("subject"),
  textBody: text("text_body"),
  htmlBody: text("html_body"),
  rawPayload: jsonb("raw_payload").notNull(),
  parseStatus: text("parse_status").notNull().default("pending"), // pending|parsed|partial|failed|confirmation_email|ignored
  parseError: text("parse_error"),
  confirmationLink: text("confirmation_link"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull().unique(),
  inboundEmailId: uuid("inbound_email_id").references(() => inboundEmails.id),
  title: text("title"),
  address: text("address"),
  price: integer("price"),
  priceRaw: text("price_raw"),
  bedrooms: integer("bedrooms"),
  propertyType: text("property_type"),
  imageUrl: text("image_url"),
  rawExtract: jsonb("raw_extract"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const filterCriteria = pgTable("filter_criteria", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),
  areas: jsonb("areas").$type<string[]>().notNull().default([]),
  minBedrooms: integer("min_bedrooms"),
  maxBedrooms: integer("max_bedrooms"),
  propertyTypes: jsonb("property_types").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listingMatches = pgTable(
  "listing_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").notNull().references(() => listings.id),
    filterCriteriaId: uuid("filter_criteria_id").notNull().references(() => filterCriteria.id),
    matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.listingId, t.filterCriteriaId)]
);

export const recipients = pgTable("recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone"), // E.164
  passwordHash: text("password_hash"), // bcrypt hash; this recipient's own dashboard login
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifySms: boolean("notify_sms").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const notificationLog = pgTable("notification_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").references(() => listings.id),
  recipientId: uuid("recipient_id").references(() => recipients.id),
  channel: text("channel").notNull(), // push|sms|email
  status: text("status").notNull(), // sent|failed|skipped
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const systemEvents = pgTable("system_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
