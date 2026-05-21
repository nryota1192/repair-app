-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- customers
-- ============================================================
create table public.customers (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  contact_name text,
  phone        text,
  email        text,
  postal_code  text,
  address      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy "customers: own rows only"
  on public.customers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- projects
-- ============================================================
create table public.projects (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  customer_id              uuid not null references public.customers(id) on delete restrict,
  title                    text not null,
  property_address         text,
  status                   text not null default 'estimating'
                             check (status in ('estimating','won','in_progress','completed','lost')),
  estimated_at             date,
  start_date               date,
  end_date                 date,
  description              text,
  tax_rate                 numeric(5,4) not null default 0.10,
  rounding_mode            text not null default 'floor'
                             check (rounding_mode in ('floor','round','ceil')),
  default_labor_unit_price numeric(12,2),
  received_amount          numeric(12,2),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects: own rows only"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- line_items
-- ============================================================
create table public.line_items (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null
                  check (category in ('material','labor','transport','other')),
  sort_order    int not null default 0,
  name          text not null,
  quantity      numeric(12,2),
  unit          text,
  unit_price    numeric(12,2),
  actual_amount numeric(12,2),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.line_items enable row level security;

create policy "line_items: own rows only"
  on public.line_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_updated_at before update on public.customers
  for each row execute procedure public.set_updated_at();

create trigger projects_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();

create trigger line_items_updated_at before update on public.line_items
  for each row execute procedure public.set_updated_at();
