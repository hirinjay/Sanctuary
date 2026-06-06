-- Sanctuary: initial schema
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists runs (
  id          text primary key,           -- anonymous browser UUID
  vp          jsonb,                      -- Varek persistent stats
  roster      jsonb default '[]'::jsonb,  -- undead roster
  inv         jsonb default '{}'::jsonb,  -- inventory
  nodes       jsonb default '[]'::jsonb,  -- built sanctuary nodes
  book        jsonb,                      -- chosen grimoire
  world       jsonb,                      -- { seed, tiles, width, height }
  world_pos   jsonb,                      -- { col, row }
  sanctuary_pos jsonb,                    -- { col, row }
  unlocked_locs jsonb default '["town"]'::jsonb,
  log         jsonb default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- No auth for now — open anon read/write scoped to row by id.
-- Tighten with RLS once auth is added.
alter table runs enable row level security;

create policy "anon full access by id"
  on runs for all
  using (true)
  with check (true);
