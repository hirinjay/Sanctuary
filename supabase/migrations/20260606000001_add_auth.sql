-- Rebuild runs table with auth + save slots
-- Safe to run on a fresh project (no real data yet)

drop table if exists runs;

create table runs (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  slot          smallint    not null check (slot between 1 and 3),
  -- Game state (full save)
  vp            jsonb,
  roster        jsonb       default '[]'::jsonb,
  inv           jsonb       default '{}'::jsonb,
  nodes         jsonb       default '[]'::jsonb,
  book          jsonb,
  world         jsonb,
  world_pos     jsonb,
  sanctuary_pos jsonb,
  unlocked_locs jsonb       default '["town"]'::jsonb,
  log           jsonb       default '[]'::jsonb,
  -- Lightweight display metadata (used by save-slot summary query)
  varek_level   smallint    default 1,
  book_id       text,
  sanctuary_placed boolean  default false,
  started_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  primary key (user_id, slot)
);

alter table runs enable row level security;

-- Each user can only see and modify their own saves
create policy "users own their runs"
  on runs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on upsert
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger runs_touch_updated_at
  before update on runs
  for each row execute function touch_updated_at();
