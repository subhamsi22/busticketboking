-- Run this after supabase_setup.sql in the Supabase SQL Editor.
-- First create the one administrator in Supabase Dashboard > Authentication > Users.
-- Use that account's email as the Admin ID and set its password in the dashboard.
-- Replace the value below with that exact email, then run this script.

create table if not exists public.app_admins (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  admin_id text not null unique
);
alter table public.app_admins enable row level security;
drop policy if exists "Administrator can read own role" on public.app_admins;
create policy "Administrator can read own role" on public.app_admins for select to authenticated using (user_id = (select auth.uid()));
grant select on public.app_admins to authenticated;

-- Keep the profile email in sync so the admin table can show customer details.
alter table public.profiles add column if not exists email text;
update public.profiles p set email=u.email from auth.users u where p.id=u.id and p.email is distinct from u.email;
alter table public.bookings drop constraint if exists bookings_user_profile_fkey;
alter table public.bookings add constraint bookings_user_profile_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), new.email)
  on conflict (id) do update set full_name=excluded.full_name, email=excluded.email, updated_at=now();
  return new;
end;
$$;

-- Exactly one admin can exist. The primary-key singleton constraint enforces this.
insert into public.app_admins (singleton,user_id,admin_id)
select true,id,email from auth.users where lower(email)=lower('subhamsinghkk34@gmail.com')
on conflict (singleton) do update set user_id=excluded.user_id, admin_id=excluded.admin_id;

drop policy if exists "Administrator can view customer profiles" on public.profiles;
create policy "Administrator can view customer profiles" on public.profiles for select to authenticated using (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Administrator can view all bookings" on public.bookings;
create policy "Administrator can view all bookings" on public.bookings for select to authenticated using (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Administrator can view all booking seats" on public.booking_seats;
create policy "Administrator can view all booking seats" on public.booking_seats for select to authenticated using (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Administrator can add buses" on public.buses;
create policy "Administrator can add buses" on public.buses for insert to authenticated with check (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Administrator can add trips" on public.trips;
create policy "Administrator can add trips" on public.trips for insert to authenticated with check (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Administrator can view all scheduled trip records" on public.trips;
create policy "Administrator can view all scheduled trip records" on public.trips for select to authenticated using (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Administrator can view all bus records" on public.buses;
create policy "Administrator can view all bus records" on public.buses for select to authenticated using (exists(select 1 from public.app_admins a where a.user_id=(select auth.uid())));
grant insert on public.buses,public.trips to authenticated;
grant select on public.profiles,public.bookings,public.booking_seats,public.buses,public.trips to authenticated;

-- Sample bus services and upcoming trips. Re-running this block does not duplicate them.
insert into public.buses(name,operator,registration_number,bus_type,total_seats,amenities)
values ('Sunrise Express','TouristStar','TS-DEMO-001','AC Seater',36,array['AC','USB charging','Water']),
       ('Western Ghats Sleeper','Deccan Travels','TS-DEMO-002','AC Sleeper',36,array['AC','Blanket','USB charging']),
       ('Pink City Rider','RajWay','TS-DEMO-003','AC Seater',40,array['AC','Wi-Fi']),
       ('Night Owl','Southern Lines','TS-DEMO-004','AC Sleeper',32,array['AC','Blanket','USB charging']),
       ('Coastal Connect','TouristStar','TS-DEMO-005','AC Seater',40,array['AC','Water'])
on conflict (registration_number) do nothing;

insert into public.trips(bus_id,origin,destination,departure_at,arrival_at,fare)
select b.id,v.origin,v.destination,v.departure_at,v.arrival_at,v.fare
from (values
 ('TS-DEMO-001','Mumbai','Pune',now()+interval '1 day 7 hours',now()+interval '1 day 10 hours',650::numeric),
 ('TS-DEMO-002','Mumbai','Pune',now()+interval '1 day 15 hours',now()+interval '1 day 18 hours',820::numeric),
 ('TS-DEMO-003','Delhi','Jaipur',now()+interval '1 day 6 hours',now()+interval '1 day 11 hours',540::numeric),
 ('TS-DEMO-004','Bengaluru','Chennai',now()+interval '2 days 21 hours',now()+interval '3 days 5 hours',990::numeric),
 ('TS-DEMO-005','Hyderabad','Vijayawada',now()+interval '2 days 9 hours',now()+interval '2 days 14 hours',480::numeric)
) as v(registration,origin,destination,departure_at,arrival_at,fare)
join public.buses b on b.registration_number=v.registration
where not exists(select 1 from public.trips t where t.bus_id=b.id and t.origin=v.origin and t.destination=v.destination and t.departure_at::date=v.departure_at::date);

-- After adding a bus schedule in the admin panel, routes appear in bus search.
