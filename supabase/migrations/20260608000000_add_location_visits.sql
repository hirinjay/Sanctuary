-- Add location_visits column that was added to saveRun payload after initial schema deployment
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

alter table runs
  add column if not exists location_visits jsonb default '{}'::jsonb;
