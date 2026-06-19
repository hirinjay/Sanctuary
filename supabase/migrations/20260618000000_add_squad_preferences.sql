-- Add Phase 1 squad selection preference storage.
-- Run in Supabase SQL Editor: Dashboard -> SQL Editor -> New query

alter table runs
  add column if not exists squad_preferences jsonb default '{}'::jsonb;

alter table runs
  add column if not exists location_resources jsonb default '{}'::jsonb;

alter table runs
  add column if not exists world_turn integer default 0;

alter table runs
  add column if not exists current_squad_ids jsonb default '[]'::jsonb;
