-- Core MVP schema for Phase A backlog.
-- Apply in Supabase SQL Editor or via `supabase db push`.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  verified_flag boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  region_id uuid not null references public.regions(id),
  category_id uuid not null references public.categories(id),
  title text not null check (char_length(title) between 5 and 140),
  body text not null check (char_length(body) between 20 and 5000),
  price_min numeric(12, 2),
  price_max numeric(12, 2),
  price_label text,
  obo_flag boolean not null default false,
  location_text text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'expired', 'archived')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_reputation (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  score numeric(5, 2) not null default 0,
  completed_transactions_reported integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_listings_region on public.listings(region_id);
create index if not exists idx_listings_category on public.listings(category_id);
create index if not exists idx_listings_status_created on public.listings(status, created_at desc);
create index if not exists idx_listing_images_listing on public.listing_images(listing_id, sort_order);

create index if not exists idx_listings_title_trgm on public.listings using gin (title gin_trgm_ops);
create index if not exists idx_listings_body_trgm on public.listings using gin (body gin_trgm_ops);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, verified_flag)
  values (new.id, new.email, split_part(new.email, '@', 1), coalesce(new.email_confirmed_at is not null, false))
  on conflict (id) do nothing;

  insert into public.user_reputation (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

alter table public.regions enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.listing_reports enable row level security;
alter table public.user_reputation enable row level security;

drop policy if exists "regions readable by all" on public.regions;
create policy "regions readable by all"
on public.regions for select
to anon, authenticated
using (true);

drop policy if exists "categories readable by all" on public.categories;
create policy "categories readable by all"
on public.categories for select
to anon, authenticated
using (true);

drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "active listings readable by all" on public.listings;
create policy "active listings readable by all"
on public.listings for select
to anon, authenticated
using (status = 'active' or auth.uid() = seller_id);

drop policy if exists "users can insert own listings" on public.listings;
create policy "users can insert own listings"
on public.listings for insert
to authenticated
with check (auth.uid() = seller_id);

drop policy if exists "users can update own listings" on public.listings;
create policy "users can update own listings"
on public.listings for update
to authenticated
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

drop policy if exists "users can delete own listings" on public.listings;
create policy "users can delete own listings"
on public.listings for delete
to authenticated
using (auth.uid() = seller_id);

drop policy if exists "listing images readable by all" on public.listing_images;
create policy "listing images readable by all"
on public.listing_images for select
to anon, authenticated
using (true);

drop policy if exists "users can manage own listing images" on public.listing_images;
create policy "users can manage own listing images"
on public.listing_images for all
to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id and l.seller_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id and l.seller_id = auth.uid()
  )
);

drop policy if exists "users read own favorites" on public.favorites;
create policy "users read own favorites"
on public.favorites for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users manage own favorites" on public.favorites;
create policy "users manage own favorites"
on public.favorites for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "authenticated can report listings" on public.listing_reports;
create policy "authenticated can report listings"
on public.listing_reports for insert
to authenticated
with check (auth.uid() = reporter_user_id);

drop policy if exists "users read own reputation" on public.user_reputation;
create policy "users read own reputation"
on public.user_reputation for select
to authenticated
using (auth.uid() = user_id);
