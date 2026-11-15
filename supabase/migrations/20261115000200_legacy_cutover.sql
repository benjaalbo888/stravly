begin;

create function stravly_private.legacy_read_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'La agenda de Estudio Norte se gestiona en Stravly 2.0.' using errcode='55000';
end;
$$;

-- Deliberately called separately from applying the migration, after backup and Preview.
create function stravly_private.import_estudio_norte(p_confirmed_owner uuid) returns uuid
language plpgsql set search_path = '' as $$
declare b uuid; w bigint; t text;
begin
  if not exists(select 1 from auth.users where id=p_confirmed_owner and email_confirmed_at is not null)
    then raise exception 'An explicitly confirmed owner is required.' using errcode='22023'; end if;
  if not pg_try_advisory_xact_lock(448011,1) then raise lock_not_available; end if;
  lock table public.business,public.administrators,public.services,public.working_hours,public.blocks,public.bookings
    in access exclusive mode nowait;
  if exists(select 1 from public.businesses where slug='estudio-norte') then
    raise exception 'Estudio Norte already migrated.' using errcode='55000';
  end if;
  insert into public.businesses(slug,name,time_zone)
    select 'estudio-norte',name,time_zone from public.business where id returning id into strict b;
  insert into public.business_members values(b,p_confirmed_owner,'owner');
  insert into public.business_members select b,user_id,'admin' from public.administrators
    where user_id<>p_confirmed_owner;
  insert into public.workers(business_id,name,description) values(b,'Agenda original','Conserva las citas de Estudio Norte anteriores a Stravly 2.0.') returning id into w;
  insert into public.business_services(id,business_id,name,description,duration_minutes,price_clp,active)
    select id,b,name,description,duration_minutes,price_clp,active from public.services;
  insert into public.worker_services select b,w,id from public.services;
  insert into public.business_hours select b,weekday,opens_at,closes_at,active from public.working_hours;
  insert into public.worker_hours select b,w,weekday,opens_at,closes_at,active from public.working_hours;
  insert into public.business_blocks(id,business_id,starts_at,ends_at,reason)
    select id,b,starts_at,ends_at,reason from public.blocks;
  insert into public.business_bookings(id,business_id,worker_id,service_id,code,service_name,price_clp,
    customer_name,customer_email,customer_phone,starts_at,ends_at,status,created_at)
    select id,b,w,service_id,code,service_name,price_clp,customer_name,customer_email,customer_phone,
      starts_at,ends_at,status,created_at from public.bookings;
  foreach t in array array['business','services','working_hours','blocks','bookings'] loop
    execute format('create trigger v2_archive before insert or update or delete or truncate on public.%I for each statement execute function stravly_private.legacy_read_only()',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
  end loop;
  revoke all on public.administrators from public, anon, authenticated, service_role;
  revoke execute on function public.stravly_slots(uuid,date),public.is_stravly_admin(),
    public.stravly_day_bounds(date),public.stravly_add_block(date,time,time,text) from anon,authenticated;
  revoke execute on function public.stravly_book(uuid,timestamptz,text,text,text,text) from service_role;
  return b;
end;
$$;
revoke all on function stravly_private.legacy_read_only(),stravly_private.import_estudio_norte(uuid)
  from public,anon,authenticated,service_role;
commit;
