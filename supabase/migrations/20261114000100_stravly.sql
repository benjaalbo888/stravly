begin;

create schema if not exists stravly_private;
revoke all on schema stravly_private from public, anon, authenticated, service_role;

create table public.business (
  id boolean primary key default true check (id),
  name text not null check (char_length(name) between 2 and 100),
  time_zone text not null default 'America/Santiago' check (time_zone = 'America/Santiago')
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 240),
  duration_minutes smallint not null check (duration_minutes between 15 and 180 and duration_minutes % 15 = 0),
  price_clp integer not null check (price_clp between 0 and 1000000),
  active boolean not null default true
);

create table public.working_hours (
  weekday smallint primary key check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  check (opens_at < closes_at and closes_at < time '24:00' and
         extract(second from opens_at) = 0 and extract(second from closes_at) = 0 and
         extract(minute from opens_at)::integer % 15 = 0 and
         extract(minute from closes_at)::integer % 15 = 0)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 100),
  check (ends_at > starts_at and ends_at - starts_at <= interval '26 hours')
);
create index blocks_during_idx on public.blocks using gist (tstzrange(starts_at, ends_at, '[)'));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('ST-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 16))),
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,
  price_clp integer not null,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_email text not null check (char_length(customer_email) between 5 and 160),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{8,15}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint bookings_no_overlap exclude using gist
    (tstzrange(starts_at, ends_at, '[)') with &&) where (status = 'confirmed')
);
create index bookings_starts_at_idx on public.bookings (starts_at);

create table public.administrators (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table stravly_private.booking_attempts (
  bucket timestamptz not null,
  client_hash text not null check (client_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null check (attempts between 1 and 12),
  primary key (bucket, client_hash)
);

alter table public.business enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.blocks enable row level security;
alter table public.bookings enable row level security;
alter table public.administrators enable row level security;
alter table stravly_private.booking_attempts enable row level security;

revoke all on public.business, public.services, public.working_hours, public.blocks,
  public.bookings, public.administrators from public, anon, authenticated, service_role;
revoke all on stravly_private.booking_attempts from public, anon, authenticated, service_role;

create function public.is_stravly_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.administrators where user_id = (select auth.uid()));
$$;
revoke all on function public.is_stravly_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_stravly_admin() to authenticated;

grant select on public.business, public.services to anon, authenticated;
grant insert (name, description, duration_minutes, price_clp, active),
  update (name, description, duration_minutes, price_clp, active) on public.services to authenticated;
grant select, insert, update on public.working_hours to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, update (status) on public.bookings to authenticated;

create policy business_read on public.business for select to anon, authenticated using (true);
create policy services_list_anon on public.services for select to anon using (active);
create policy services_list_authenticated on public.services for select to authenticated
  using (active or (select public.is_stravly_admin()));
create policy services_add on public.services for insert to authenticated with check ((select public.is_stravly_admin()));
create policy services_edit on public.services for update to authenticated
  using ((select public.is_stravly_admin())) with check ((select public.is_stravly_admin()));
create policy hours_admin on public.working_hours for all to authenticated
  using ((select public.is_stravly_admin())) with check ((select public.is_stravly_admin()));
create policy blocks_admin on public.blocks for all to authenticated
  using ((select public.is_stravly_admin())) with check ((select public.is_stravly_admin()));
create policy bookings_read_admin on public.bookings for select to authenticated using ((select public.is_stravly_admin()));
create policy bookings_cancel_admin on public.bookings for update to authenticated
  using ((select public.is_stravly_admin()) and status = 'confirmed' and starts_at > now())
  with check ((select public.is_stravly_admin()) and status = 'cancelled');

-- Serialize changes that affect the single shared agenda. Take the lock before row locks.
create function stravly_private.lock_agenda() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(448011, 1);
  return null;
end;
$$;
revoke all on function stravly_private.lock_agenda() from public, anon, authenticated, service_role;
create trigger services_lock before insert or update on public.services
  for each statement execute function stravly_private.lock_agenda();
create trigger hours_lock before insert or update on public.working_hours
  for each statement execute function stravly_private.lock_agenda();
create trigger blocks_lock before insert or delete on public.blocks
  for each statement execute function stravly_private.lock_agenda();
create trigger bookings_lock before update on public.bookings
  for each statement execute function stravly_private.lock_agenda();

create function stravly_private.check_block() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.ends_at > new.starts_at and exists (
    select 1 from public.bookings b where b.status = 'confirmed'
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'stravly_block_overlaps_booking';
  end if;
  return new;
end;
$$;
revoke all on function stravly_private.check_block() from public, anon, authenticated, service_role;
create trigger blocks_check before insert on public.blocks for each row execute function stravly_private.check_block();

-- One source of truth for both the public calendar and the final booking decision.
create function public.stravly_slots(p_service uuid, p_date date) returns table (starts_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select slot.start_at
  from public.business b
  cross join public.services s
  join public.working_hours w on w.weekday = extract(isodow from p_date) and w.active
  cross join lateral generate_series(
    (p_date + w.opens_at) at time zone b.time_zone,
    ((p_date + w.closes_at) at time zone b.time_zone) - make_interval(mins => s.duration_minutes),
    interval '15 minutes'
  ) as slot(start_at)
  cross join lateral (select slot.start_at + make_interval(mins => s.duration_minutes) as end_at) finish
  where s.id = p_service and s.active
    and p_date between (now() at time zone b.time_zone)::date and (now() at time zone b.time_zone)::date + 60
    and slot.start_at > now()
    and (slot.start_at at time zone b.time_zone)::date = p_date
    and (slot.start_at at time zone b.time_zone)::time >= w.opens_at
    and (finish.end_at at time zone b.time_zone)::time <= w.closes_at
    and not exists (select 1 from public.blocks x where
      tstzrange(x.starts_at, x.ends_at, '[)') && tstzrange(slot.start_at, finish.end_at, '[)'))
    and not exists (select 1 from public.bookings a where a.status = 'confirmed' and
      tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(slot.start_at, finish.end_at, '[)'))
  order by slot.start_at;
$$;
revoke all on function public.stravly_slots(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.stravly_slots(uuid, date) to anon, authenticated;

create function public.stravly_book(
  p_service uuid, p_start timestamptz, p_name text, p_email text, p_phone text, p_client_hash text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_hour timestamptz := date_trunc('hour', now(), 'UTC');
  attempt_count integer;
  service public.services%rowtype;
  zone text;
  start_date date;
  confirmation text;
begin
  if p_service is null or p_start is null or not isfinite(p_start) or
     p_name is null or char_length(btrim(p_name)) not between 2 and 80 or
     p_email is null or char_length(p_email) not between 5 and 160 or
     p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
     p_phone is null or p_phone !~ '^\+?[0-9]{8,15}$' or
     p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$'
  then return jsonb_build_object('status', 'invalid'); end if;

  delete from stravly_private.booking_attempts where bucket < current_hour - interval '1 hour';
  insert into stravly_private.booking_attempts as a (bucket, client_hash, attempts)
    values (current_hour, p_client_hash, 1)
    on conflict (bucket, client_hash) do update set attempts = a.attempts + 1 where a.attempts < 12
    returning attempts into attempt_count;
  if attempt_count is null then return jsonb_build_object('status', 'limited'); end if;

  perform pg_catalog.pg_advisory_xact_lock(448011, 1);
  select b.time_zone into zone from public.business b where b.id;
  start_date := (p_start at time zone zone)::date;
  if p_start <= clock_timestamp() or
    not exists (select 1 from public.stravly_slots(p_service, start_date) a where a.starts_at = p_start)
  then return jsonb_build_object('status', 'unavailable'); end if;
  select * into strict service from public.services s where s.id = p_service;

  begin
    insert into public.bookings
      (service_id, service_name, price_clp, customer_name, customer_email, customer_phone, starts_at, ends_at)
    values (service.id, service.name, service.price_clp, btrim(p_name), lower(p_email), p_phone,
      p_start, p_start + make_interval(mins => service.duration_minutes))
    returning code into confirmation;
  exception when exclusion_violation then
    return jsonb_build_object('status', 'unavailable');
  end;
  return jsonb_build_object('status', 'confirmed', 'code', confirmation,
    'service', service.name, 'startsAt', p_start, 'duration', service.duration_minutes, 'price', service.price_clp);
end;
$$;
revoke all on function public.stravly_book(uuid, timestamptz, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.stravly_book(uuid, timestamptz, text, text, text, text) to service_role;

-- Both bounds use local calendar midnights, including 23/25-hour days.
create function public.stravly_day_bounds(p_date date) returns table (day_start timestamptz, day_end timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select p_date::timestamp at time zone b.time_zone, (p_date + 1)::timestamp at time zone b.time_zone
  from public.business b where b.id and isfinite(p_date);
$$;
revoke all on function public.stravly_day_bounds(date) from public, anon, authenticated, service_role;
grant execute on function public.stravly_day_bounds(date) to authenticated;

create function public.stravly_add_block(p_date date, p_from time, p_to time, p_reason text) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  zone text;
  start_at timestamptz;
  end_at timestamptz;
  block_id uuid;
begin
  if not public.is_stravly_admin() then raise insufficient_privilege; end if;
  select b.time_zone into strict zone from public.business b where b.id;
  if p_date is null or not isfinite(p_date) or p_date < (now() at time zone zone)::date or
    p_date > (now() at time zone zone)::date + 366 or (p_from is null) <> (p_to is null) or
    (p_from is not null and (p_from >= p_to or p_to >= time '24:00'))
  then raise exception using errcode = '22023', message = 'stravly_invalid_block'; end if;

  if p_from is null then
    select day_start, day_end into start_at, end_at from public.stravly_day_bounds(p_date);
  else
    start_at := (p_date + p_from) at time zone zone;
    end_at := (p_date + p_to) at time zone zone;
    if start_at at time zone zone <> p_date + p_from or end_at at time zone zone <> p_date + p_to then
      raise exception using errcode = '22023', message = 'stravly_invalid_block';
    end if;
  end if;
  if end_at <= now() then raise exception using errcode = '22023', message = 'stravly_invalid_block'; end if;
  -- The invoker can insert only if the block RLS policy authorizes them.
  block_id := gen_random_uuid();
  insert into public.blocks (id, starts_at, ends_at, reason) values (block_id, start_at, end_at, btrim(p_reason));
  return block_id;
end;
$$;
revoke all on function public.stravly_add_block(date, time, time, text) from public, anon, authenticated, service_role;
grant execute on function public.stravly_add_block(date, time, time, text) to authenticated;

insert into public.business (name) values ('Estudio Norte');
insert into public.services (name, description, duration_minutes, price_clp) values
  ('Corte clásico', 'Corte a tijera o máquina y peinado final.', 30, 12000),
  ('Perfilado de barba', 'Definición de contornos y cuidado de la barba.', 30, 8500),
  ('Corte y barba', 'Corte completo y perfilado de barba en una sola cita.', 60, 18500);
insert into public.working_hours (weekday, opens_at, closes_at, active)
  select d, time '10:00', case when d = 6 then time '15:00' else time '19:00' end, d <> 7
  from generate_series(1, 7) d;

commit;
