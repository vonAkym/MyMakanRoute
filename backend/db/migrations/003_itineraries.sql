-- MyMakanRoute 003: Food Hopping (Itinerary Planner, Itinerary Review and Customisation,
-- Past Food Hopping Visualisation).

create table if not exists itineraries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles (id) on delete cascade,
  title            text not null,
  travel_mode      text not null default 'walking' check (travel_mode in ('walking', 'driving')),
  total_time_s     numeric,
  total_distance_m numeric,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists itineraries_user_id_idx on itineraries (user_id);

create table if not exists itinerary_stops (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries (id) on delete cascade,
  place_id     uuid not null references places (id),
  position     integer not null check (position >= 0),
  -- Deferred so stops can be reordered inside one transaction without
  -- clashing on a temporary duplicate position.
  constraint itinerary_stops_position_key unique (itinerary_id, position)
    deferrable initially deferred
);

-- Same reason as in 002: keep these tables away from Supabase's public REST API.
alter table itineraries enable row level security;
alter table itinerary_stops enable row level security;

