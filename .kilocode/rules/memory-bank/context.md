# Active Context: Shopify Expiry Manager

## Current State

**App Status**: ✅ Full application built and running

A Shopify product expiry tracking and reminder app. Users can add products (with SKU), attach multiple expiry date batches with quantities, configure reminder rules (e.g. 7/14/30 days before expiry), and view dashboard alerts when products are approaching expiry.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] SQLite database via Drizzle ORM (app-builder-db)
- [x] Database schema: `products`, `product_expiry`, `reminder_rules`, `alert_acknowledgements`
- [x] Migrations generated
- [x] API routes: `/api/products`, `/api/products/[id]`, `/api/products/[id]/expiry`, `/api/expiry/[id]`, `/api/reminder-rules`, `/api/reminder-rules/[id]`, `/api/alerts`, `/api/alerts/acknowledge`
- [x] Dashboard page with alert filtering, urgency colours, acknowledge/unacknowledge
- [x] Products page with search, add product form, expiry batch modal (add/edit/delete)
- [x] Reminder Rules page with CRUD, preset buttons, toggle active/inactive, email field
- [x] Sticky top nav with active link highlighting

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Dashboard | ✅ |
| `src/app/products/page.tsx` | Products management page | ✅ |
| `src/app/reminder-rules/page.tsx` | Reminder rules CRUD page | ✅ |
| `src/app/layout.tsx` | Root layout with Nav | ✅ |
| `src/app/api/products/route.ts` | GET all / POST product | ✅ |
| `src/app/api/products/[id]/route.ts` | PUT / DELETE product | ✅ |
| `src/app/api/products/[id]/expiry/route.ts` | GET / POST expiry batches | ✅ |
| `src/app/api/expiry/[id]/route.ts` | PUT / DELETE expiry batch | ✅ |
| `src/app/api/reminder-rules/route.ts` | GET all / POST rule | ✅ |
| `src/app/api/reminder-rules/[id]/route.ts` | PUT / DELETE rule | ✅ |
| `src/app/api/alerts/route.ts` | GET computed alerts | ✅ |
| `src/app/api/alerts/acknowledge/route.ts` | POST / DELETE acknowledgement | ✅ |
| `src/components/Nav.tsx` | Sticky navigation bar | ✅ |
| `src/components/Dashboard.tsx` | Alert dashboard with filters | ✅ |
| `src/components/ProductsManager.tsx` | Products list + expiry modal | ✅ |
| `src/components/ReminderRulesManager.tsx` | Rules CRUD + presets | ✅ |
| `src/db/schema.ts` | Drizzle schema (4 tables) | ✅ |
| `src/db/index.ts` | DB client | ✅ |
| `src/db/migrate.ts` | Migration runner | ✅ |
| `src/lib/types.ts` | Shared TypeScript interfaces | ✅ |

## Schema Tables

- **products** – SKU, name, optional Shopify product/variant IDs
- **product_expiry** – expiry date (YYYY-MM-DD), quantity, notes, FK to products
- **reminder_rules** – name, daysBeforeExpiry, isActive, emailEnabled, emailAddress
- **alert_acknowledgements** – FK to rule + expiry, tracks dismissed alerts

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-03-18 | Full Shopify Expiry Manager app built from scratch |
| 2026-09-23 | Fixed deployment build failures: lazy DB init via Proxy in `src/db/index.ts`, added `export const dynamic = "force-dynamic"` to all 15 API routes, added `turbopackUseSystemTlsCerts: true` to `next.config.ts` |
