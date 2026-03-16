create extension if not exists pgcrypto;

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_id text not null,
  mechanic_name text not null,
  mechanic_id text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sales_customer_id_idx on sales (customer_id);
create index if not exists sales_created_at_idx on sales (created_at desc);
