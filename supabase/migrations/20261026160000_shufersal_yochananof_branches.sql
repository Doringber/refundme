-- Shufersal and Yochananof exist in the demo dataset but were not in the
-- initial merchant seed. Seeded branches from 20260328180000 already have
-- lat/lng; this file does not rewrite them.
--
-- Coordinates below are approximate public locations, at the same precision
-- as the original seed. Acceptance stays unverified. Apply manually
-- (SQL editor or `npx supabase db push`). The app does not run migrations.

insert into public.merchants (id, name_he, slug, category, logo_color)
values
  ('11111111-1111-1111-1111-111111111107', 'שופרסל', 'shufersal', 'מזון', '#E53935'),
  ('11111111-1111-1111-1111-111111111108', 'יוחננוף', 'yochananof', 'מזון', '#1B5E20')
on conflict (slug) do nothing;

insert into public.merchant_branches (
  merchant_id, name_he, city, address_he, lat, lng, acceptance, notes_he
)
select m.id, v.name_he, v.city, v.address_he, v.lat, v.lng, v.acceptance, v.notes_he
from (
  values
    (
      'shufersal',
      'שופרסל דיל דיזנגוף',
      'תל אביב',
      'דיזנגוף 121',
      32.0804::double precision,
      34.7742::double precision,
      'unverified'::public.branch_acceptance,
      'קואורדינטות משוערות — הקבלה בסניף לא אומתה'
    ),
    (
      'shufersal',
      'שופרסל ביג באר שבע',
      'באר שבע',
      'דרך חברון 21',
      31.2445::double precision,
      34.7900::double precision,
      'unverified'::public.branch_acceptance,
      'קואורדינטות משוערות — הקבלה בסניף לא אומתה'
    ),
    (
      'yochananof',
      'יוחננוף חולון',
      'חולון',
      'ההסתדרות 100',
      32.0160::double precision,
      34.7790::double precision,
      'unverified'::public.branch_acceptance,
      'קואורדינטות משוערות — הקבלה בסניף לא אומתה'
    )
) as v(slug, name_he, city, address_he, lat, lng, acceptance, notes_he)
join public.merchants m on m.slug = v.slug
where not exists (
  select 1
  from public.merchant_branches b
  where b.merchant_id = m.id
    and b.name_he = v.name_he
);
