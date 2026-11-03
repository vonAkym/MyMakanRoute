-- MyMakanRoute 002: User Management (Registration, Login, Profile and Preference Setup).
-- Login itself is handled by Supabase Auth. profiles.id is the Supabase Auth user id.
-- There is deliberately NO foreign key to auth.users, so this also runs on a plain
-- PostgreSQL database (laptop or CI).

create table if not exists profiles (
  id           uuid primary key,
  display_name text,
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists preferences (
  user_id         uuid primary key references profiles (id) on delete cascade,
  halal_only      boolean not null default false,
  max_price_level smallint check (max_price_level between 1 and 4),
  cuisines        text[] not null default '{}',
  dietary         text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

-- RLS on with no policies: nobody can reach these tables through Supabase's public
-- REST API with the publishable key. Only our backend (table owner) reads and writes them.
alter table profiles enable row level security;
alter table preferences enable row level security;
