-- Add columns for persisting in-progress mission state and location boss flags
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

alter table runs
  add column if not exists location_bosses    jsonb default '{}'::jsonb,
  add column if not exists location_scavenges jsonb default '{}'::jsonb,
  add column if not exists mission_state       jsonb;
