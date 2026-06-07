-- Add columns that were added to saveRun payload after the initial schema was deployed
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

alter table runs
  add column if not exists travel_bag     jsonb default '{}'::jsonb,
  add column if not exists sanctuary_grid jsonb;
