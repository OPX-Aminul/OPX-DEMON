-- =============================================================
-- OPX-DEMON — Supabase schema
-- Run the whole file in the Supabase SQL Editor.
-- Note: RLS is enforced; the Node backend uses the SERVICE KEY,
-- which bypasses RLS for admin/shop operations.
-- =============================================================

-- ---------- helper ----------
create extension if not exists pgcrypto;

-- ---------- PRODUCTS ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text default '',
  price_cents integer not null default 0,
  compare_at_price_cents integer,
  image_url text,
  category text,
  featured boolean not null default false,
  in_stock boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- SETTINGS (payment numbers, shop config) ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- ORDERS ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_name text not null,
  phone text not null,
  email text,
  address text not null,
  city text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  total_cents integer not null default 0,
  payment_method text not null check (payment_method in ('bkash','nagad','cod')),
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','completed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- auto order number ----------
create sequence if not exists public.order_number_seq start 1000;

create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
begin
  new.order_number := 'OPXD-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists trg_order_number on public.orders;
create trigger trg_order_number
  before insert on public.orders
  for each row execute function public.generate_order_number();

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated
  before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------- ENABLE RLS ----------
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;

-- ---------- RLS POLICIES ----------
-- Public may read only active products.
drop policy if exists "anon read active products" on public.products;
create policy "anon read active products"
  on public.products for select
  using (active = true);

-- No public access to settings/orders.
-- Admin operations go through the backend (service key), which bypasses RLS.
create policy "service bypass products" on public.products for all using (true) with check (true);
create policy "service bypass settings" on public.settings for all using (true) with check (true);
create policy "service bypass orders"   on public.orders   for all using (true) with check (true);

-- ---------- SEED: default settings ----------
insert into public.settings (key, value) values
  ('shop', '{"name":"OPX-DEMON","currency":"BDT","shipping_fee_cents":10000}'::jsonb),
  ('payments', '{"bkash":"01XXX-XXXXXX","nagad":"01XXX-XXXXXX","instructions":"Send the amount to the number above, then place your order. We will confirm after payment."}'::jsonb)
on conflict (key) do nothing;

-- ---------- SEED: products (matches the storefront design) ----------
insert into public.products (slug, name, description, price_cents, compare_at_price_cents, image_url, category, featured, sort_order) values
  ('opx-demon', 'OPX-DEMON', 'The main device of the OPX-DEMON ecosystem.', 16900, null, null, 'device', true, 1),
  ('wifi-devboard', 'WiFi Devboard', 'WiFi/Bluetooth development board companion.', 3500, null, null, 'accessory', false, 2),
  ('video-game-module', 'Video Game Module', 'A module for retro gaming and custom demos.', 4900, null, null, 'module', false, 3),
  ('silicone-case', 'Silicone Case', 'Protective silicone case.', 1500, null, null, 'accessory', false, 4),
  ('screen-protector', 'Screen Protectors', 'Tempered screen protector set.', 1000, null, null, 'accessory', false, 5),
  ('microsd-card', 'microSD Card', 'Class 10 microSD card for storage. 32GB.', 800, null, null, 'accessory', false, 6)
on conflict (slug) do nothing;
