-- Wayfare bus ticket booking: run this entire file in Supabase SQL Editor.
-- Safe to re-run for schema/policies; sample data is inserted only when absent.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  operator text not null,
  registration_number text unique,
  bus_type text not null default 'AC Seater',
  total_seats integer not null check (total_seats between 1 and 80),
  amenities text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  bus_id uuid not null references public.buses(id) on delete restrict,
  origin text not null,
  destination text not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  fare numeric(10,2) not null check (fare >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  created_at timestamptz not null default now(),
  check (origin <> destination), check (arrival_at > departure_at)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,10)),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.booking_seats (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete restrict,
  seat_number integer not null check (seat_number > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  email text not null check (char_length(email) <= 320),
  phone text,
  country text not null default 'India',
  city text,
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  created_at timestamptz not null default now()
);

-- A cancelled booking releases its seats, so seat uniqueness applies to confirmed
-- bookings in the serialized booking function rather than to historical rows.
alter table public.booking_seats drop constraint if exists booking_seats_trip_id_seat_number_key;

create index if not exists trips_search_idx on public.trips (origin, destination, departure_at) where status='scheduled';
create index if not exists bookings_user_idx on public.bookings (user_id, created_at desc);
create index if not exists booking_seats_trip_idx on public.booking_seats (trip_id, seat_number);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''))
  on conflict (id) do update set full_name=excluded.full_name, updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_booking(p_trip_id uuid, p_seat_numbers integer[])
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_trip public.trips%rowtype; v_booking uuid; v_code text; v_count integer;
begin
  if v_user is null then raise exception 'Please sign in before booking.'; end if;
  if p_seat_numbers is null or cardinality(p_seat_numbers) < 1 or cardinality(p_seat_numbers) > 8 then raise exception 'Choose between 1 and 8 seats.'; end if;
  if cardinality(p_seat_numbers) <> (select count(distinct seat) from unnest(p_seat_numbers) as selected(seat)) then raise exception 'The same seat was selected more than once.'; end if;
  select * into v_trip from public.trips where id=p_trip_id and status='scheduled' and departure_at > now() for update;
  if not found then raise exception 'This trip is no longer available.'; end if;
  select total_seats into v_count from public.buses where id=v_trip.bus_id;
  if exists(select 1 from unnest(p_seat_numbers) as selected(seat) where seat < 1 or seat > v_count) then raise exception 'A selected seat number is invalid.'; end if;
  if exists(select 1 from public.booking_seats bs join public.bookings b on b.id=bs.booking_id where bs.trip_id=p_trip_id and bs.seat_number=any(p_seat_numbers) and b.status='confirmed') then raise exception 'One or more seats were just booked. Please choose again.'; end if;
  insert into public.bookings(user_id,trip_id,total_amount) values(v_user,p_trip_id,v_trip.fare*cardinality(p_seat_numbers)) returning id,booking_code into v_booking,v_code;
  insert into public.booking_seats(booking_id,trip_id,seat_number) select v_booking,p_trip_id,seat from unnest(p_seat_numbers) as selected(seat);
  return v_code;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_booking public.bookings%rowtype; v_departure timestamptz;
begin
  if v_user is null then raise exception 'Please sign in first.'; end if;
  select * into v_booking from public.bookings where id=p_booking_id and user_id=v_user for update;
  if not found then raise exception 'Booking not found.'; end if;
  if v_booking.status='cancelled' then raise exception 'This booking is already cancelled.'; end if;
  select departure_at into v_departure from public.trips where id=v_booking.trip_id;
  if v_departure <= now() then raise exception 'A trip that has departed cannot be cancelled.'; end if;
  update public.bookings set status='cancelled' where id=p_booking_id;
end;
$$;

create or replace view public.trip_availability as
select t.id,t.bus_id,t.origin,t.destination,t.departure_at,t.arrival_at,t.fare,t.status,t.created_at,
       b.name as bus_name,b.operator,b.bus_type,b.total_seats,b.amenities,
       b.total_seats-count(bk.id)::integer as available_seats
from public.trips t join public.buses b on b.id=t.bus_id
left join public.booking_seats bs on bs.trip_id=t.id
left join public.bookings bk on bk.id=bs.booking_id and bk.status='confirmed'
where t.status='scheduled'
group by t.id,b.id;

alter table public.profiles enable row level security;
alter table public.buses enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_seats enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner" on public.profiles for select to authenticated using ((select auth.uid())=id);
drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
drop policy if exists "Scheduled trip buses are public" on public.buses;
create policy "Scheduled trip buses are public" on public.buses for select to anon, authenticated using (exists(select 1 from public.trips t where t.bus_id=buses.id and t.status='scheduled'));
drop policy if exists "Scheduled trips are public" on public.trips;
create policy "Scheduled trips are public" on public.trips for select to anon, authenticated using (status='scheduled');
drop policy if exists "Bookings are readable by owner" on public.bookings;
create policy "Bookings are readable by owner" on public.bookings for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Booking seats are readable by booking owner" on public.booking_seats;
create policy "Booking seats are readable by booking owner" on public.booking_seats for select to authenticated using (exists(select 1 from public.bookings b where b.id=booking_seats.booking_id and b.user_id=(select auth.uid())));
drop policy if exists "Anyone can send a contact message" on public.contact_messages;
create policy "Anyone can send a contact message" on public.contact_messages for insert to anon,authenticated with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.buses,public.trips to anon,authenticated;
grant select on public.trip_availability to anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.bookings,public.booking_seats to authenticated;
grant insert on public.contact_messages to anon,authenticated;
grant execute on function public.create_booking(uuid,integer[]) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- Starter bus schedules (times are local Asia/Kolkata; edit destinations/times/fares as needed).
insert into public.buses(name,operator,registration_number,bus_type,total_seats,amenities)
values ('Coastal Cruiser','Wayfare Travels','WF-001','AC Sleeper',36,array['AC','USB charging','Water']),
       ('City Hopper','Greenline Coaches','WF-002','AC Seater',40,array['AC','Wi-Fi']),
       ('Night Owl Express','Roadstar India','WF-003','Volvo Sleeper',32,array['AC','Blanket','USB charging'])
on conflict (registration_number) do nothing;
insert into public.trips(bus_id,origin,destination,departure_at,arrival_at,fare)
select b.id,v.origin,v.destination,v.departure_at,v.arrival_at,v.fare from (values
 ('WF-001','Mumbai','Pune',now()+interval '2 days 8 hours',now()+interval '2 days 12 hours',650::numeric),
 ('WF-002','Mumbai','Pune',now()+interval '2 days 10 hours',now()+interval '2 days 14 hours',480::numeric),
 ('WF-003','Bengaluru','Chennai',now()+interval '3 days 21 hours',now()+interval '4 days 5 hours',950::numeric),
 ('WF-001','Delhi','Jaipur',now()+interval '4 days 7 hours',now()+interval '4 days 12 hours',720::numeric),
 ('WF-002','Pune','Goa',now()+interval '5 days 21 hours',now()+interval '6 days 7 hours',1100::numeric)
) as v(registration,origin,destination,departure_at,arrival_at,fare)
join public.buses b on b.registration_number=v.registration
where not exists(select 1 from public.trips t where t.bus_id=b.id and t.origin=v.origin and t.destination=v.destination and t.departure_at::date=v.departure_at::date);

-- After running: Authentication > URL Configuration should use your hosted frontend URL.
-- For local development serve the frontend folder over HTTP (for example: npx serve frontend).
