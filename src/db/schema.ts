import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Products table - stores Shopify product info synced or manually entered
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopifyProductId: text("shopify_product_id"),
  shopifyVariantId: text("shopify_variant_id"),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Product expiry batches - each product can have multiple expiry date entries
export const productExpiry = sqliteTable("product_expiry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  expiryDate: text("expiry_date").notNull(), // ISO date string YYYY-MM-DD
  quantity: integer("quantity").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Reminder rules - e.g. "alert me 7 days before expiry"
export const reminderRules = sqliteTable("reminder_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // e.g. "7 Day Warning"
  daysBeforeExpiry: integer("days_before_expiry").notNull(), // e.g. 7, 14, 30
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(false),
  emailAddress: text("email_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Dashboard alerts log - tracks which rules have been "acknowledged"
export const alertAcknowledgements = sqliteTable("alert_acknowledgements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => reminderRules.id, { onDelete: "cascade" }),
  productExpiryId: integer("product_expiry_id")
    .notNull()
    .references(() => productExpiry.id, { onDelete: "cascade" }),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
