# QT-Africa — Dealer Audit Planner

Planning dashboard for managing dealer audit assignments across South Africa and neighbouring countries.

## Features

- **Map view** — all dealers on OpenStreetMap, coloured by bank, with proximity clustering
- **Proximity tool** — click any dealer, see all within X km; bulk-assign to an auditor in one click
- **Dealer list** — filterable/sortable table with inline auditor assignment and duplicate flagging
- **Summary dashboard** — dealer counts by province and bank, auditor overview
- **Auditor management** — create/edit/delete placeholder auditors with province and colour
- **Online persistence** — all assignments saved to Supabase, accessible from any device

---

## One-time setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project → name it `qt-africa`
2. Open **SQL Editor** → paste contents of [`supabase/schema.sql`](supabase/schema.sql) → Run
3. Go to **Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (seeding only, never commit this)

### 2. Configure environment variables

```bash
cp .env.example .env
# Fill in your Supabase URL and keys
```

### 3. Enrich dealer GPS data (one-time, run locally)

```bash
GOOGLE_PLACES_API_KEY=your_key node scripts/enrich.mjs
# Output: output/dealers-wesbank.json
```

### 4. Seed Supabase

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=your_service_role_key \
BANK=wesbank \
node scripts/seed.mjs
```

Repeat steps 3–4 for `standardbank` and `nedbank` when ready.

---

## Local development

```bash
npm install
npm run dev   # requires .env to be filled in
```

---

## Deploy to GitHub Pages

1. Push repo to GitHub as `QT-Africa` (private)
2. **Settings → Pages** → Source: **GitHub Actions**
3. **Settings → Secrets → Actions** → add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` → deploys automatically

Live URL: `https://your-username.github.io/QT-Africa/`

---

## Adding Standard Bank / Nedbank later

1. Prepare CSV: `Dealer Name, City, FQ, Qty, Latitude, Longitude`
2. Update the CSV path in `scripts/enrich.mjs` for the new bank
3. `BANK=standardbank node scripts/enrich.mjs`
4. `BANK=standardbank node scripts/seed.mjs`

---

## Data fields

| Field | Values |
|-------|--------|
| `bank` | `wesbank` · `standardbank` · `nedbank` |
| `audit_frequency` | Days between audits: 7, 14, 30, 60, 90, 120, 180 |
| `province` | SA provinces + `Namibia`, `Botswana`, `Lesotho`, `Eswatini` |
| `is_duplicate` | Flagged as a duplicate location |
| `duplicate_tag` | `garage` · `separate entity` · `fleet` · `rental` · `branch` |
| `qty` | Vehicle count at dealer (future use) |
