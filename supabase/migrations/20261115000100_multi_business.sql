begin;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'Barbería' check (char_length(btrim(category)) between 2 and 60),
  location text not null default '' check (char_length(location) <= 160),
  phone text not null default '' check (char_length(phone) <= 30),
  email text not null default '' check (char_length(email) <= 160),
  time_zone text not null default 'America/Santiago' check (time_zone = 'America/Santiago')
);

create table public.business_members (
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin')),
  primary key (business_id,user_id)
);
create index business_members_user_idx on public.business_members(user_id);
create unique index business_one_owner on public.business_members(business_id) where role = 'owner';

create table public.workers (
  id bigint generated always as identity primary key check (id < 9007199254740991),
  business_id uuid not null references public.businesses(id),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  photo_url text not null default '' check (char_length(photo_url) <= 500 and (photo_url = '' or photo_url ~ '^https://')),
  active boolean not null default true,
  unique (business_id,id)
);

create table public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 240),
  duration_minutes smallint not null check (duration_minutes between 15 and 180 and duration_minutes % 15 = 0),
  price_clp integer not null check (price_clp between 0 and 1000000),
  active boolean not null default true,
  unique (business_id,id)
);

create table public.worker_services (
  business_id uuid not null,
  worker_id bigint not null,
  service_id uuid not null,
  primary key (business_id,worker_id,service_id),
  foreign key (business_id, worker_id) references public.workers(business_id,id),
  foreign key (business_id, service_id) references public.business_services(business_id,id)
);
create index worker_services_service_idx on public.worker_services(business_id,service_id);

create function stravly_private.valid_hours(p_from time, p_to time) returns boolean
language sql immutable set search_path = '' as $$
  select p_from < p_to and p_to < time '24:00' and
         extract(second from p_from) = 0 and extract(second from p_to) = 0 and
         extract(minute from p_from)::integer % 15 = 0 and extract(minute from p_to)::integer % 15 = 0;
$$;

create table public.business_hours (
  business_id uuid not null references public.businesses(id),
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  primary key (business_id,weekday),
  check (stravly_private.valid_hours(opens_at,closes_at))
);
create table public.worker_hours (
  business_id uuid not null,
  worker_id bigint not null,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  primary key (business_id,worker_id,weekday),
  foreign key (business_id, worker_id) references public.workers(business_id,id),
  check (stravly_private.valid_hours(opens_at,closes_at))
);

create table public.business_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  worker_id bigint,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 100),
  foreign key (business_id, worker_id) references public.workers(business_id,id),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at and ends_at - starts_at <= interval '26 hours')
);
create index business_blocks_date_idx on public.business_blocks(business_id,starts_at);

create table public.business_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  worker_id bigint not null,
  service_id uuid not null,
  code text not null unique default ('ST-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 16))),
  service_name text not null,
  price_clp integer not null,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_email text not null check (char_length(customer_email) between 5 and 160),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{8,15}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  foreign key (business_id,worker_id) references public.workers(business_id,id),
  foreign key (business_id,service_id) references public.business_services(business_id,id),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  -- A single-point range gives GiST worker equality without an extension.
  exclude using gist (int8range(worker_id,worker_id,'[]') with &&,
    tstzrange(starts_at,ends_at,'[)') with &&) where (status = 'confirmed')
);
create index business_bookings_date_idx on public.business_bookings(business_id,starts_at);

create table stravly_private.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  email text not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '48 hours',
  unique (business_id,email)
);
alter table stravly_private.business_invites enable row level security;
revoke all on stravly_private.business_invites from public, anon, authenticated, service_role;

create function public.business_role(p_business uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.business_members where business_id=p_business and user_id=(select auth.uid());
$$;
revoke all on function public.business_role(uuid) from public, anon, authenticated, service_role;
grant execute on function public.business_role(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['businesses','business_members','workers','business_services','worker_services','business_hours','worker_hours','business_blocks','business_bookings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
  foreach t in array array['workers','business_services','worker_services','business_hours','worker_hours','business_blocks'] loop
    execute format('create policy scoped_read on public.%I for select to authenticated using (public.business_role(business_id) is not null)',t);
    execute format('create policy scoped_write on public.%I for all to authenticated using (public.business_role(business_id) is not null) with check (public.business_role(business_id) is not null)',t);
  end loop;
end $$;

create policy own_business on public.businesses for select to authenticated using (public.business_role(id) is not null);
create policy owner_settings on public.businesses for update to authenticated
  using (public.business_role(id) = 'owner') with check (public.business_role(id) = 'owner');
create policy member_read on public.business_members for select to authenticated
  using (user_id = (select auth.uid()) or public.business_role(business_id) = 'owner');
create policy booking_read on public.business_bookings for select to authenticated using (public.business_role(business_id) is not null);
create policy booking_cancel on public.business_bookings for update to authenticated
  using (public.business_role(business_id) is not null and status='confirmed' and starts_at > now())
  with check (public.business_role(business_id) is not null and status='cancelled');

grant update (name,description,category,location,phone,email) on public.businesses to authenticated;
grant insert (business_id,name,description,photo_url,active), update (name,description,photo_url,active) on public.workers to authenticated;
grant insert (business_id,name,description,duration_minutes,price_clp,active),
  update (name,description,duration_minutes,price_clp,active) on public.business_services to authenticated;
grant insert, update (opens_at,closes_at,active) on public.business_hours, public.worker_hours to authenticated;
grant delete on public.business_blocks to authenticated;
grant update (status) on public.business_bookings to authenticated;

create function stravly_private.tenant_lock(p_business uuid) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended(p_business::text, 687531));
$$;
create function stravly_private.agenda_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform stravly_private.tenant_lock(old.business_id);
    return old;
  end if;
  perform stravly_private.tenant_lock(new.business_id);
  return new;
end;
$$;
-- The trigger needs schema access to call the internal lock for ordinary authenticated writes.
alter function stravly_private.agenda_change() security definer;
do $$
declare t text;
begin
  foreach t in array array['workers','business_services','worker_services','business_hours','worker_hours','business_blocks'] loop
    execute format('create trigger lock_agenda before insert or update or delete on public.%I for each row execute function stravly_private.agenda_change()',t);
  end loop;
end $$;

create function public.create_business(p_name text,p_slug text,p_description text,p_category text,
  p_location text,p_phone text,p_email text,p_worker text,p_hour_from time,p_hour_to time,p_days integer[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b uuid; w bigint; caller uuid := auth.uid();
begin
  if not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) then raise insufficient_privilege; end if;
  if p_slug = 'estudio-norte' or coalesce(cardinality(p_days),0) not between 1 and 7 or
    exists(select 1 from unnest(p_days) d where d is null or d not between 1 and 7) then
    raise exception 'invalid business setup' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text,687532));
  if (select count(*) from public.business_members where user_id=caller and role='owner') >= 10 then
    raise exception 'business limit' using errcode='22023';
  end if;
  insert into public.businesses(slug,name,description,category,location,phone,email)
    values(p_slug,btrim(p_name),btrim(p_description),btrim(p_category),btrim(p_location),btrim(p_phone),btrim(p_email)) returning id into b;
  insert into public.business_members values(b,caller,'owner');
  insert into public.workers(business_id,name) values(b,btrim(p_worker)) returning id into w;
  insert into public.business_hours select b,d,p_hour_from,p_hour_to,d=any(p_days) from generate_series(1,7) d;
  insert into public.worker_hours select b,w,d,p_hour_from,p_hour_to,d=any(p_days) from generate_series(1,7) d;
  return b;
end;
$$;

create function public.assign_worker_services(p_business uuid,p_worker bigint,p_services uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.business_role(p_business) is null then raise insufficient_privilege; end if;
  perform stravly_private.tenant_lock(p_business);
  if not exists(select 1 from public.workers where business_id=p_business and id=p_worker)
    or coalesce(cardinality(p_services),0)>100 then raise exception 'invalid worker or services' using errcode='22023'; end if;
  delete from public.worker_services where business_id=p_business and worker_id=p_worker;
  insert into public.worker_services select p_business,p_worker,id from (select distinct unnest(p_services) id) ids;
end;
$$;

create function public.save_business_hours(p_business uuid,p_worker bigint,p_hours jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.business_role(p_business) is null or (p_worker is null and public.business_role(p_business) <> 'owner')
    then raise insufficient_privilege; end if;
  if p_hours is null or jsonb_typeof(p_hours)<>'array' or jsonb_array_length(p_hours)<>7 or
    (select count(distinct weekday) from jsonb_to_recordset(p_hours) x(weekday smallint))<>7
    then raise exception 'invalid week' using errcode='22023'; end if;
  perform stravly_private.tenant_lock(p_business);
  if p_worker is null then
    insert into public.business_hours select p_business,weekday,opens_at,closes_at,active
      from jsonb_to_recordset(p_hours) x(weekday smallint,opens_at time,closes_at time,active boolean)
      on conflict (business_id,weekday) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at,active=excluded.active;
  else
    insert into public.worker_hours select p_business,p_worker,weekday,opens_at,closes_at,active
      from jsonb_to_recordset(p_hours) x(weekday smallint,opens_at time,closes_at time,active boolean)
      on conflict (business_id,worker_id,weekday) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at,active=excluded.active;
  end if;
end;
$$;
revoke insert,update on public.business_hours,public.worker_hours from authenticated;
revoke update (opens_at,closes_at,active) on public.business_hours,public.worker_hours from authenticated;

create function public.business_agenda_summary(p_business uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'today',count(*) filter (where status='confirmed' and (starts_at at time zone 'America/Santiago')::date=(now() at time zone 'America/Santiago')::date),
    'upcoming',count(*) filter (where status='confirmed' and starts_at>=now()),'total',count(*),
    'workers',coalesce((select jsonb_agg(to_jsonb(x)) from
      (select worker_id,count(*) as count from public.business_bookings
       where business_id=p_business and status='confirmed' and starts_at>=now() group by worker_id) x),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(to_jsonb(x) order by x.count desc,x.service_name) from
      (select service_name,count(*) as count from public.business_bookings where business_id=p_business and status='confirmed'
       group by service_name order by count desc, service_name limit 10) x),'[]'::jsonb))
  from public.business_bookings where business_id=p_business;
$$;

create function public.business_day_bounds(p_date date) returns table(day_start timestamptz,day_end timestamptz)
language sql stable set search_path = '' as $$
  select p_date::timestamp at time zone 'America/Santiago', (p_date+1)::timestamp at time zone 'America/Santiago' where isfinite(p_date);
$$;

create function public.business_catalog(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('business',to_jsonb(b)-'id',
    'services',coalesce((select jsonb_agg(to_jsonb(s)-'business_id' order by s.name) from public.business_services s
      where s.business_id=b.id and s.active),'[]'::jsonb),
    'workers',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'description',w.description,'photo_url',w.photo_url,
      'services',coalesce((select jsonb_agg(ws.service_id) from public.worker_services ws
        join public.business_services s on (s.business_id,s.id)=(ws.business_id,ws.service_id)
        where ws.business_id=b.id and ws.worker_id=w.id and s.active),'[]'::jsonb)) order by w.name)
      from public.workers w where w.business_id=b.id and w.active),'[]'::jsonb))
  from public.businesses b where b.slug=p_slug;
$$;

create function stravly_private.tenant_slots(p_business uuid,p_service uuid,p_worker bigint,p_date date)
returns table(worker_id bigint, starts_at timestamptz)
language sql stable set search_path = '' as $$
  select w.id, slot.at
  from public.businesses b
  join public.business_services s on s.business_id=b.id and s.id=p_service and s.active
  join public.worker_services ws on ws.business_id=b.id and ws.service_id=s.id
  join public.workers w on (w.business_id,w.id)=(ws.business_id,ws.worker_id) and w.active
  join public.business_hours h on h.business_id=b.id and h.weekday=extract(isodow from p_date) and h.active
  join public.worker_hours wh on (wh.business_id,wh.worker_id,wh.weekday)=(b.id,w.id,h.weekday) and wh.active
  cross join lateral generate_series((p_date + greatest(h.opens_at,wh.opens_at)) at time zone b.time_zone,
    ((p_date + least(h.closes_at,wh.closes_at)) at time zone b.time_zone) - make_interval(mins=>s.duration_minutes),
    interval '15 minutes') slot(at)
  cross join lateral (select tstzrange(slot.at,slot.at+make_interval(mins=>s.duration_minutes),'[)') span) r
  where b.id=p_business and (p_worker is null or w.id=p_worker) and slot.at>now()
    and p_date between (now() at time zone b.time_zone)::date and (now() at time zone b.time_zone)::date+60
    and (slot.at at time zone b.time_zone)::date=p_date
    and (slot.at at time zone b.time_zone)::time >= greatest(h.opens_at,wh.opens_at)
    and (upper(r.span) at time zone b.time_zone)::time <= least(h.closes_at,wh.closes_at)
    and not exists (select 1 from public.business_blocks x where x.business_id=b.id and (x.worker_id is null or x.worker_id=w.id)
      and tstzrange(x.starts_at,x.ends_at,'[)') && r.span)
    and not exists (select 1 from public.business_bookings a where a.business_id=b.id and a.worker_id=w.id and a.status='confirmed'
      and tstzrange(a.starts_at,a.ends_at,'[)') && r.span);
$$;

create function public.business_slots(p_slug text,p_service uuid,p_worker bigint,p_date date)
returns table(starts_at timestamptz) language sql stable security definer set search_path = '' as $$
  select distinct t.starts_at from public.businesses b
  cross join lateral stravly_private.tenant_slots(b.id,p_service,p_worker,p_date) t
  where b.slug=p_slug order by t.starts_at;
$$;

create function public.book_business(p_slug text,p_service uuid,p_worker bigint,p_start timestamptz,
  p_name text,p_email text,p_phone text,p_client_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.businesses%rowtype; s public.business_services%rowtype; w public.workers%rowtype;
  a_count integer; hour_bucket timestamptz := date_trunc('hour',now(),'UTC'); chosen bigint; confirmation text;
begin
  if p_start is null or not isfinite(p_start) or p_name is null or char_length(btrim(p_name)) not between 2 and 80
    or p_email is null or char_length(p_email) not between 5 and 160 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_phone is null or p_phone !~ '^\+?[0-9]{8,15}$' or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$'
    then return jsonb_build_object('status','invalid'); end if;
  select * into b from public.businesses where slug=p_slug;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  delete from stravly_private.booking_attempts where bucket<hour_bucket-interval '1 hour';
  insert into stravly_private.booking_attempts as a values(hour_bucket,p_client_hash,1)
    on conflict (bucket,client_hash) do update set attempts=a.attempts+1 where a.attempts<12 returning attempts into a_count;
  if a_count is null then return jsonb_build_object('status','limited'); end if;
  perform stravly_private.tenant_lock(b.id);
  select t.worker_id into chosen from stravly_private.tenant_slots(b.id,p_service,p_worker,(p_start at time zone b.time_zone)::date) t
    where t.starts_at=p_start and p_start>clock_timestamp() order by t.worker_id limit 1;
  if chosen is null then return jsonb_build_object('status','unavailable'); end if;
  select * into strict s from public.business_services where business_id=b.id and id=p_service;
  select * into strict w from public.workers where business_id=b.id and id=chosen;
  begin
    insert into public.business_bookings(business_id,worker_id,service_id,service_name,price_clp,customer_name,customer_email,customer_phone,starts_at,ends_at)
      values(b.id,w.id,s.id,s.name,s.price_clp,btrim(p_name),lower(p_email),p_phone,p_start,p_start+make_interval(mins=>s.duration_minutes))
      returning code into confirmation;
  exception when exclusion_violation then return jsonb_build_object('status','unavailable');
  end;
  return jsonb_build_object('status','confirmed','code',confirmation,'service',s.name,'worker',w.name,'startsAt',p_start,'duration',s.duration_minutes,'price',s.price_clp);
end;
$$;

create function public.add_business_block(p_business uuid,p_worker bigint,p_date date,p_from time,p_to time,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare zone text; t0 timestamptz; t1 timestamptz; block_id uuid;
begin
  if public.business_role(p_business) is null then raise insufficient_privilege; end if;
  select time_zone into strict zone from public.businesses where id=p_business;
  if p_date is null or p_date not between (now() at time zone zone)::date and (now() at time zone zone)::date+366
    or (p_from is null)<>(p_to is null) or (p_from is not null and not stravly_private.valid_hours(p_from,p_to))
  then raise exception 'invalid block' using errcode='22023'; end if;
  t0 := (p_date+coalesce(p_from,time '00:00')) at time zone zone;
  t1 := case when p_to is null then (p_date+1)::timestamp at time zone zone else (p_date+p_to) at time zone zone end;
  if t1<=now() or (p_from is not null and
    ((t0 at time zone zone)<>p_date+p_from or (t1 at time zone zone)<>p_date+p_to))
    then raise exception 'invalid block' using errcode='22023'; end if;
  perform stravly_private.tenant_lock(p_business);
  if exists(select 1 from public.business_bookings where business_id=p_business and (p_worker is null or worker_id=p_worker)
     and status='confirmed' and tstzrange(starts_at,ends_at,'[)') && tstzrange(t0,t1,'[)'))
    then raise exclusion_violation; end if;
  insert into public.business_blocks(business_id,worker_id,starts_at,ends_at,reason)
    values(p_business,p_worker,t0,t1,btrim(p_reason)) returning id into block_id;
  return block_id;
end;
$$;

create function public.list_business_access(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.business_role(p_business) is distinct from 'owner' then raise insufficient_privilege; end if;
  return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'role',m.role))
    from public.business_members m join auth.users u on u.id=m.user_id where m.business_id=p_business),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'expires_at',expires_at))
    from stravly_private.business_invites where business_id=p_business and expires_at>now()),'[]'::jsonb));
end;
$$;
create function public.invite_business_admin(p_business uuid,p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
begin
  if public.business_role(p_business) is distinct from 'owner' then raise insufficient_privilege; end if;
  if p_email is null or char_length(p_email)>160 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then raise exception 'invalid email' using errcode='22023'; end if;
  perform stravly_private.tenant_lock(p_business);
  delete from stravly_private.business_invites where business_id=p_business and expires_at<=now();
  if (select count(*) from stravly_private.business_invites where business_id=p_business)>=25 then
    raise exception 'invite limit' using errcode='22023'; end if;
  insert into stravly_private.business_invites(business_id,email,token_hash) values(p_business,lower(p_email),sha256(convert_to(token,'UTF8')))
    on conflict(business_id,email) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return token;
end;
$$;
create function public.accept_business_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare recipient text; target uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select lower(email) into recipient from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if recipient is null then return null; end if;
  delete from stravly_private.business_invites where token_hash=sha256(convert_to(p_token,'UTF8'))
    and email=recipient and expires_at>now() returning business_id into target;
  if target is not null then insert into public.business_members values(target,auth.uid(),'admin') on conflict do nothing; end if;
  return target;
end;
$$;
create function public.remove_business_access(p_business uuid,p_target uuid,p_invite boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.business_role(p_business) is distinct from 'owner' then raise insufficient_privilege; end if;
  if p_invite then delete from stravly_private.business_invites where business_id=p_business and id=p_target;
  else delete from public.business_members where business_id=p_business and user_id=p_target and role='admin'; end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['create_business(text,text,text,text,text,text,text,text,time,time,integer[])',
    'assign_worker_services(uuid,bigint,uuid[])','save_business_hours(uuid,bigint,jsonb)',
    'business_day_bounds(date)','business_agenda_summary(uuid)','add_business_block(uuid,bigint,date,time,time,text)',
    'list_business_access(uuid)','invite_business_admin(uuid,text)','accept_business_invite(text)','remove_business_access(uuid,uuid,boolean)'] loop
    execute 'revoke all on function public.'||f||' from public, anon, authenticated, service_role';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
end $$;
revoke all on function public.business_catalog(text), public.business_slots(text,uuid,bigint,date),
  public.book_business(text,uuid,bigint,timestamptz,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_catalog(text), public.business_slots(text,uuid,bigint,date) to anon,authenticated;
grant execute on function public.book_business(text,uuid,bigint,timestamptz,text,text,text,text) to service_role;
commit;
