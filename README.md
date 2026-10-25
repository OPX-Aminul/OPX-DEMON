# OPX-DEMON

Portable multi-tool e-commerce storefront (flipper.net-style design) with a Supabase backend and admin panel.

## Stack
- Node.js + Express backend (serves static storefront + REST API)
- Supabase (Postgres) — products, orders, settings
- Vanilla JS storefront + admin panel

## Quick start

### 1. Set up Supabase
1. Create a Supabase project (https://supabase.com).
2. Open **SQL Editor** and paste the full contents of `supabase/setup.sql`, then run it.
   - This creates all tables (`products`, `orders`, `settings`), RLS policies, triggers, and seeds default products/settings.
3. Go to **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_KEY` (server-only)

### 2. Configure the server
```bash
cp .env.example .env
# edit .env with your Supabase credentials + admin password
```

### 3. Run
```bash
npm install
npm start
```
Open `http://localhost:3000`.

Admin panel: `http://localhost:3000/admin` (use `ADMIN_PASSWORD`).

## Features
- Storefront: products grid, cart drawer, checkout (bKash / Nagad / Cash on Delivery)
- Checkout shows the manual payment number (bKash/Nagad) and stores the order in Supabase
- Admin panel: login, view/confirm/cancel/manage orders, edit payment numbers & instructions, add/deactivate/delete products

## Environment variables
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (server only) |
| `ADMIN_PASSWORD` | Password for the admin panel |
| `PORT` | Server port (default 3000) |
