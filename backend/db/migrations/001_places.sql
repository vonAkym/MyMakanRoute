-- MyMakanRoute 001: food places (Food Discovery, Food Hopping, Food Stalls Analytics).
-- Folds in the old sql/001_places.sql and sql/002_places_osm.sql.
-- Safe to run on a fresh database AND on the existing Supabase database that already
-- has the places table: everything uses "if not exists" / "create or replace".

create extension if not exists postgis;

create table if not exists places (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  cuisine       text,
  address       text,
  area          text,
  location      geography(Point, 4326) not null,
  is_halal      boolean,
  price_level   smallint check (price_level between 1 and 4),
  avg_rating    numeric(2, 1) check (avg_rating between 0 and 5),
  review_count  integer not null default 0 check (review_count >= 0),
  opening_hours jsonb,
  image_url     text,
  source        text not null default 'manual',
  osm_id        text unique,
  dietary       text[] not null default '{}',
  is_sample     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Columns added after the first version of the table (no-ops on a fresh database).
alter table places add column if not exists source text not null default 'manual';
alter table places add column if not exists osm_id text;
-- Separate statement: "add column if not exists ... unique" can create a duplicate
-- unique index on some PostgreSQL versions. places_osm_id_key is the name PostgreSQL
-- gives the "osm_id text unique" constraint, so this is a no-op when it already exists.
-- "on conflict (osm_id)" in the seed and import scripts needs this unique index.
create unique index if not exists places_osm_id_key on places (osm_id);
alter table places add column if not exists dietary text[] not null default '{}';
alter table places add column if not exists is_sample boolean not null default false;

-- Halal status can be unknown (null): most OSM places are not tagged either way.
alter table places alter column is_halal drop not null;
alter table places alter column is_halal drop default;

-- opening_hours format: {"mon":[["08:00","15:00"]], "tue":[...], ...}
-- The original OpenStreetMap string, if any, is kept under the key "osm".

create index if not exists places_location_idx on places using gist (location);

-- Supabase exposes tables to its public REST API. Row level security keeps them
-- read-only there; our backend connects as the table owner, which is not limited by RLS.
alter table places enable row level security;
drop policy if exists "Places are readable by everyone" on places;
create policy "Places are readable by everyone" on places for select using (true);

-- Places within radius_m metres of a point, nearest first.
-- Dropped first because "create or replace" cannot change a function's result columns.
drop function if exists nearby_places(double precision, double precision, double precision);
create function nearby_places(lat double precision, lng double precision, radius_m double precision default 2000)
returns table (
  id uuid,
  name text,
  cuisine text,
  area text,
  is_halal boolean,
  price_level smallint,
  avg_rating numeric,
  review_count integer,
  lat double precision,
  lng double precision,
  distance_m double precision
)
language sql stable
as $$
  select
    p.id, p.name, p.cuisine, p.area, p.is_halal, p.price_level, p.avg_rating, p.review_count,
    st_y(p.location::geometry) as lat,
    st_x(p.location::geometry) as lng,
    st_distance(p.location, st_point(lng, lat)::geography) as distance_m
  from places p
  where st_dwithin(p.location, st_point(lng, lat)::geography, radius_m)
  order by distance_m;
$$;
