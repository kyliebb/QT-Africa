-- QT-Africa database schema
-- Run this in the Supabase SQL Editor (once, on a fresh project)

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Dealers ────────────────────────────────────────────────────────────────
create table if not exists dealers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  city              text,
  province          text,
  country           text default 'ZA',
  bank              text not null check (bank in ('wesbank', 'standardbank', 'nedbank')),
  audit_frequency   integer not null default 30,
  qty               integer,
  lat               double precision,
  lng               double precision,
  full_address      text,
  google_maps_url   text,
  place_id          text,
  enriched          boolean default false,
  is_duplicate      boolean default false,
  duplicate_tag     text,
  created_at        timestamptz default now()
);

create index if not exists dealers_bank_idx      on dealers(bank);
create index if not exists dealers_province_idx  on dealers(province);
create index if not exists dealers_enriched_idx  on dealers(enriched);

-- ─── Auditors ───────────────────────────────────────────────────────────────
create table if not exists auditors (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  primary_province text not null,
  colour           text not null default '#3b82f6',
  created_at       timestamptz default now()
);

-- ─── Assignments ────────────────────────────────────────────────────────────
create table if not exists assignments (
  dealer_id    uuid primary key references dealers(id) on delete cascade,
  auditor_id   uuid not null references auditors(id) on delete cascade,
  assigned_at  timestamptz default now()
);

create index if not exists assignments_auditor_idx on assignments(auditor_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Allow all operations with the anon key (single-user dashboard, not public-facing data).
-- If you later want to protect the dashboard, add Supabase Auth here.

alter table dealers     enable row level security;
alter table auditors    enable row level security;
alter table assignments enable row level security;

create policy "allow_all_dealers"     on dealers     for all using (true) with check (true);
create policy "allow_all_auditors"    on auditors    for all using (true) with check (true);
create policy "allow_all_assignments" on assignments for all using (true) with check (true);
