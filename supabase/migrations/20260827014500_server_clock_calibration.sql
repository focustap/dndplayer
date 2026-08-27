create or replace function public.wayfinder_server_now()
returns timestamptz
language sql
stable
security invoker
set search_path=''
as $$
  select now();
$$;

revoke all on function public.wayfinder_server_now() from public, anon;
grant execute on function public.wayfinder_server_now() to authenticated;
