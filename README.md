# SikaTrack Ghana

Sales, stock and expenditure management for small Ghanaian retail businesses (provision shops,
cosmetics, clothing, pharmacy-style retail, spare parts). Built as a real, persistent, working
application — not a prototype.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **PostgreSQL via Supabase**, accessed through **Prisma ORM 6** with tracked migrations
  (`prisma/migrations/`). Connects through Supabase's connection **pooler** (not the direct
  `db.xxx.supabase.co` host, which is often IPv6-only and unreachable from some networks/ISPs) —
  see [Connecting to Supabase](#8-connecting-to-supabase) below. SQLite also works for fully
  offline, zero-setup local dev; see [Using SQLite instead](#9-using-sqlite-instead).
- **Auth.js (NextAuth v5)** — credentials login, JWT sessions, role-based access control
- **Recharts** for charts, **react-to-print** for receipt printing, **exceljs** for Excel export

## 1. Setup

### 1.1 Install dependencies

```bash
npm install
```

### 1.2 Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` and `DIRECT_URL` with your Supabase pooler connection strings — see
[Connecting to Supabase](#8-connecting-to-supabase) for exactly where to find them.

Generate an `AUTH_SECRET`:

```bash
npx auth secret
```

### 1.3 Create the database schema

```bash
npx prisma migrate deploy
```

This applies the tracked migrations in [prisma/migrations](prisma/migrations) to your Supabase
database, creating every table defined in [prisma/schema.prisma](prisma/schema.prisma). Use
`npx prisma migrate dev` instead during development when you're actively changing the schema.

### 1.4 Load demo data

```bash
npm run db:seed
```

This creates one demo business ("Adjoa's Provision Store"), five test user accounts (one per
role), a product catalogue of common provision-shop items, ~5 weeks of realistic historical sales
and expenses (so the dashboard, weekly trend and daily outlook have real data to show), and a
starter set of expense categories.

**To remove demo data before going live**, see [Removing demo data](#removing-demo-data) below.

### 1.5 Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 2. Test accounts

All demo accounts use the password **`Sika@2026`**.

| Role | Email | Can do |
|---|---|---|
| Owner/Administrator | `owner@sikatrack.demo` | Everything |
| Manager | `manager@sikatrack.demo` | Sales, stock, expenditure, discounts, cancellations, returns |
| Cashier/Sales Attendant | `cashier@sikatrack.demo` | Record sales, print receipts, view stock |
| Stock Keeper | `stockkeeper@sikatrack.demo` | Manage products, receive/adjust stock |
| Bookkeeper | `bookkeeper@sikatrack.demo` | View sales, expenditure and financial figures |

## 3. What's implemented in this release

This first release focuses on the core transactional workflow end-to-end, fully wired to the
database — every button saves real data:

- **Authentication & RBAC** — credentials login, 5 roles, protected routes, 8-hour session expiry.
- **Products & Stock** — add/edit products, categories, opening stock, receive stock, record
  damaged/expired/missing stock, manual corrections; every change writes a `StockMovement` row.
- **Point of Sale** — search/browse products, cart, live stock checks, discretionary discounts
  (owner/manager only), cash/MoMo/bank/mixed payment, automatic change calculation, optional
  customer details, atomic sale completion (stock deduction + receipt number + audit log all in
  one database transaction).
- **Receipts** — 58mm / 80mm / A4 layouts, print, reprint (with a REPRINT watermark), print-to-PDF.
  A completed sale is saved to the database *before* printing is attempted, so a printer fault
  never loses the sale.
- **Sales History** — filter by date, payment method, status; cancel a sale (reason required,
  restocks items) and process partial/full returns (reason required, restocks items) — both
  restricted to Owner/Manager; a completed sale can never be hard-deleted.
- **Expenditure** — categorised expense recording, personal withdrawals tracked separately from
  operating expenses (as required, they do not reduce estimated net profit).
- **Dashboard** — today's revenue, transactions, expenditure, COGS, gross profit, estimated net
  profit, average sale value, cash/MoMo/bank breakdown, Daily Revenue Outlook (a clearly-labelled
  projection that only appears once there's enough trading time/data), weekly trend chart,
  best/slow sellers, low/out-of-stock alerts, recent transactions, day-over-day comparison.

### Deliberately out of scope for this release

To ship a solid, fully-working core rather than a wide but shallow feature set, the following
pages from the full specification are **not** built yet: Users & Permissions management UI (roles
are fixed and seeded directly in the database for now), Business & Receipt Settings UI (defaults
are seeded; edit via `prisma studio` or the `/api/business` endpoint), Stock Movements as a
standalone page (movements are visible on the Stock page), Reports & Analytics as a dedicated
export-heavy page (the underlying data and calculations all exist and are exercised on the
Dashboard), End-of-Day Reconciliation, and the Audit Log viewer (audit records are already being
written to the `AuditLog` table for every sale, cancellation, return, stock change and login — the
data trail exists, only the viewing page is pending). None of these are simulated or faked; they
simply aren't built yet, and the data model (`prisma/schema.prisma`) already has the tables needed
to add them without any redesign.

## 4. Removing demo data

Demo data lives entirely under one `Business` row. To remove it before going live, either:

- Run `npx prisma studio`, open the `Business` table, and delete the "Adjoa's Provision Store"
  row (cascading deletes remove everything under it), then create your real business and first
  Owner user directly in the database, **or**
- Edit `prisma/seed.ts` with your real business/product/user data and re-run `npm run db:seed`
  (it wipes all existing data first — do this only before go-live, never on a live database).

## 5. Deployment

1. Push this repository to GitHub.
2. Deploy to [Vercel](https://vercel.com) (or any Node.js host that supports Next.js 16).
3. Set the same environment variables from `.env` in your host's environment variable settings —
   including `DATABASE_URL` and `DIRECT_URL` pointed at Supabase. **Never commit `.env`** — it's
   already git-ignored.
4. Run `npx prisma migrate deploy` against your production Supabase database before the first
   deploy (or as part of your CI/CD pipeline).
5. Set `NEXTAUTH_URL` to your production domain.

Since Supabase is already Postgres and reachable over the network, this works the same on a
serverless host (Vercel, etc.) or a traditional server — no database-specific deployment caveats,
unlike the SQLite fallback described below.

## 6. User guide

### For the business owner

- **Sign in** at `/login` with your email and password.
- **Dashboard** is your home page — check it each morning and each evening. The "Daily Revenue
  Outlook" card gives an estimate of today's likely closing revenue once enough sales have come
  in; it is always labelled as an estimate, never a guarantee.
- **Add products** from the Products page before your team starts selling. Set the *reorder
  level* for each product — the Dashboard and Stock page will flag it as low stock automatically
  once it reaches that level.
- **Record every expense** (stock purchases, transport, rent, wages, etc.) from the Expenditure
  page as it happens — the "Estimated Net Profit" figure on the Dashboard depends on it. If you
  take money out of the till for personal use, tick **"personal withdrawal"** — this keeps it out
  of your expense/profit figures, which only a business owner can authorise this way.
- **Only you and your manager** can apply discounts, cancel a sale, or approve a return — this
  protects your stock and cash from being given away without your knowledge.

### For the cashier

- Go to **New Sale**. Search or tap products to add them to the cart, adjust quantities with the
  +/− buttons, choose the payment method, enter the amount the customer hands over, and the change
  due is calculated for you automatically.
- Tap **Complete Sale** — this is final and always saves, even if the receipt printer is off or
  out of paper. You can always print or reprint the receipt afterwards from Sales History.
- You **cannot** delete a sale or give a discount yourself — ask your manager or the owner if a
  customer needs one.

## 7. Database schema

See [prisma/schema.prisma](prisma/schema.prisma) for the full schema: `Business`,
`BusinessSettings`, `User`, `Category`, `Supplier`, `Product`, `StockMovement`, `Sale`,
`SaleItem`, `Payment`, `Expense`, `ExpenseCategory`, `Return`, `ReturnItem`, `Reconciliation`,
`AuditLog`. Money fields are `Decimal` in GHS; quantity fields are `Decimal` too, to support both
whole units (pieces) and fractional units (kg, litres). The schema already includes tables for
reconciliation, returns and audit logging so those features can be added without a schema
redesign (barcode scanning uses the existing `barcode` field, multi-branch would add a `branchId`
foreign key, WhatsApp receipts would reuse the existing receipt data).

## 8. Connecting to Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → Database → Connect**, copy two connection strings — use the **pooler** host
   (`aws-<n>-<region>.pooler.supabase.com`), not the direct `db.xxx.supabase.co` host, which is
   often IPv6-only and unreachable from some networks/ISPs:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`. Append `?pgbouncer=true`.
   - **Session pooler** (port `5432`) → `DIRECT_URL`. Prisma needs this non-pooled connection to
     run migrations.
   - The username in both is `postgres.<project-ref>` and the password is the one you set when
     creating the project (reset it under **Settings → Database** if you don't remember it).
     URL-encode any special characters in the password (e.g. `@` → `%40`, `!` → `%21`).
3. From **Settings → API**, the `anon` and `service_role` keys are also in `.env` as
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — not used by the app yet, kept
   for future Supabase Storage use (product images, receipt logos).
4. Run `npx prisma migrate deploy` (first time) or `npx prisma migrate dev` (while developing) to
   apply the schema, then `npm run db:seed` to load demo data.

## 9. Using SQLite instead

For fully offline, zero-setup local development, SQLite works too — useful if you don't want to
create a Supabase project just to try the app out. It is **not** suitable for serverless hosts
(Vercel, etc.) where the filesystem is ephemeral, so switch to Supabase before deploying there.

1. In [prisma/schema.prisma](prisma/schema.prisma), change the datasource block to:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
   and remove every `@db.Decimal(...)` / `@db.Date` native-type attribute in the file (SQLite
   syntax doesn't support them — the plain `Decimal` / `DateTime` types still work).
2. Set `DATABASE_URL="file:./dev.db"` in `.env` (remove `DIRECT_URL`, it's unused).
3. Run `npm run db:push` (SQLite has no migration history) then `npm run db:seed`.

No other application code changes are needed — every query goes through Prisma's generated
client, which works identically against either database.
