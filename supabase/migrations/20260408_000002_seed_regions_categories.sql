-- Seed pilot regions and categories for Phase A.

insert into public.regions (slug, display_name)
values
  ('minneapolis-st-paul', 'Minneapolis / St Paul')
on conflict (slug) do nothing;

insert into public.categories (slug, name, parent_id)
values
  ('housing', 'Housing', null),
  ('jobs', 'Jobs', null),
  ('for-sale', 'For Sale', null),
  ('services', 'Services', null),
  ('community', 'Community', null),
  ('gigs', 'Gigs', null)
on conflict (slug) do nothing;

insert into public.categories (slug, name, parent_id)
select 'furniture', 'Furniture', id from public.categories where slug = 'for-sale'
on conflict (slug) do nothing;

insert into public.categories (slug, name, parent_id)
select 'electronics', 'Electronics', id from public.categories where slug = 'for-sale'
on conflict (slug) do nothing;

insert into public.categories (slug, name, parent_id)
select 'apartments', 'Apartments / Housing', id from public.categories where slug = 'housing'
on conflict (slug) do nothing;
