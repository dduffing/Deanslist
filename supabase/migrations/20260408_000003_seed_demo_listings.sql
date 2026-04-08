-- Seed demo listings for local verification of listing feed.
-- Safe to run multiple times (idempotent by title check).
-- Requires at least one profile row from auth.users signup/admin create.

with seed_user as (
  select id
  from public.profiles
  order by created_at asc
  limit 1
),
seed_region as (
  select id
  from public.regions
  where slug = 'minneapolis-st-paul'
  limit 1
),
seed_furniture as (
  select id
  from public.categories
  where slug = 'furniture'
  limit 1
),
seed_electronics as (
  select id
  from public.categories
  where slug = 'electronics'
  limit 1
),
seed_apartments as (
  select id
  from public.categories
  where slug = 'apartments'
  limit 1
)
insert into public.listings (
  seller_id,
  region_id,
  category_id,
  title,
  body,
  price_min,
  price_max,
  price_label,
  obo_flag,
  location_text,
  status,
  expires_at
)
select
  u.id,
  r.id,
  c.id,
  v.title,
  v.body,
  v.price_min,
  v.price_max,
  v.price_label,
  v.obo_flag,
  v.location_text,
  'active',
  now() + interval '30 days'
from seed_user u
cross join seed_region r
join (
  values
    ('Vintage Leather Couch',
     'Clean and well-maintained couch. Pickup only.',
     350::numeric,
     null::numeric,
     '$350',
     true,
     'Bloomington',
     'furniture'),
    ('Mountain Bike - Like New',
     'Trek bike in excellent condition, lightly used.',
     600::numeric,
     null::numeric,
     '$600',
     true,
     'Edina',
     'electronics'),
    ('2BR Apartment - Downtown',
     'Bright 2BR with parking and in-unit laundry.',
     1800::numeric,
     null::numeric,
     '$1,800/mo',
     false,
     'Minneapolis',
     'apartments')
) as v(title, body, price_min, price_max, price_label, obo_flag, location_text, category_slug)
on true
join lateral (
  select id
  from public.categories c
  where c.slug = v.category_slug
  limit 1
) c on true
where not exists (
  select 1
  from public.listings existing
  where existing.title = v.title
);
