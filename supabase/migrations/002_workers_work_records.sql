-- ============================================================
-- workers (作業員マスタ)
-- ============================================================
create table public.workers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  default_daily_wage numeric(12,2) not null,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.workers enable row level security;

create policy "workers: own rows only"
  on public.workers
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger workers_updated_at before update on public.workers
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- work_records (出勤記録)
-- ============================================================
create table public.work_records (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  worker_id   uuid references public.workers(id) on delete set null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  work_date   date not null,
  daily_wage  numeric(12,2) not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint  work_records_unique unique (project_id, worker_id, work_date)
);

alter table public.work_records enable row level security;

create policy "work_records: own rows only"
  on public.work_records
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger work_records_updated_at before update on public.work_records
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Trigger: line_items 変更時に projects.estimated_at を更新
-- ============================================================
create or replace function public.update_project_estimated_at_from_line_items()
returns trigger as $$
begin
  update public.projects
  set    estimated_at = current_date,
         updated_at   = now()
  where  id = coalesce(new.project_id, old.project_id);
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_line_items_estimated_at
after insert or update or delete on public.line_items
for each row execute function public.update_project_estimated_at_from_line_items();

-- ============================================================
-- Trigger: projects 自身の見積関連フィールド変更時に estimated_at を更新
-- ============================================================
create or replace function public.update_project_self_estimated_at()
returns trigger as $$
begin
  if  new.title                    is distinct from old.title
   or new.property_address         is distinct from old.property_address
   or new.tax_rate                 is distinct from old.tax_rate
   or new.rounding_mode            is distinct from old.rounding_mode
   or new.default_labor_unit_price is distinct from old.default_labor_unit_price
   or new.start_date               is distinct from old.start_date
   or new.end_date                 is distinct from old.end_date
   or new.description              is distinct from old.description
  then
    new.estimated_at = current_date;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_estimated_at
before update on public.projects
for each row execute function public.update_project_self_estimated_at();
