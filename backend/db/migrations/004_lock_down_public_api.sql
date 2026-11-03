-- MyMakanRoute 004: lock down Supabase's public REST API.
--
-- Supabase automatically publishes every table and function in the "public" schema
-- through a REST API (/rest/v1) that anyone can call with the publishable (anon) key.
-- Our web and mobile apps never use that API: they only talk to our own backend,
-- which connects as the table owner (postgres). So the Supabase roles "anon" and
-- "authenticated" must not be able to change anything. Row level security (from
-- 001-003) stays on as a second layer of protection.
--
-- The roles only exist on Supabase. On plain PostgreSQL (a laptop or CI) this whole
-- migration does nothing.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then

    -- PostGIS lookup table in public; it has no RLS, so remove all access.
    revoke all on table spatial_ref_sys from anon, authenticated;

    -- Private tables: only the backend may read or write them.
    revoke all on table profiles, preferences, itineraries, itinerary_stops, schema_migrations
      from anon, authenticated;

    -- Places stay readable (matches the read-only RLS policy) but not writable.
    revoke insert, update, delete, truncate, references, trigger on table places
      from anon, authenticated;

    -- Nobody may call nearby_places through /rest/v1/rpc (e.g. with a huge radius).
    -- The backend, as the function owner, keeps access and validates the radius itself.
    revoke execute on function nearby_places(double precision, double precision, double precision)
      from public, anon, authenticated;

    -- Tables, functions and sequences created later by our migrations (run as postgres)
    -- must not get Supabase's default broad grants.
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;

    -- PostgreSQL also lets PUBLIC (every role) execute new functions by default. That
    -- default is global and cannot be removed per schema, so it is removed for objects
    -- created by the role running this migration.
    alter default privileges revoke execute on functions from public;
  end if;
end
$$;
