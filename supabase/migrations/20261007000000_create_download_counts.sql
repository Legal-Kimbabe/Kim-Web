create table if not exists public.download_counts (
  download_id text primary key,
  download_count bigint not null default 0 check (download_count >= 0)
);

alter table public.download_counts enable row level security;

revoke all on table public.download_counts from anon, authenticated;
grant select on table public.download_counts to anon, authenticated;

drop policy if exists "Public download counts are readable" on public.download_counts;
create policy "Public download counts are readable"
  on public.download_counts
  for select
  to anon, authenticated
  using (true);

insert into public.download_counts (download_id)
values
  ('lawyer-up-wallpaper'),
  ('brba-wallpaper'),
  ('sale-agreement'),
  ('nda'),
  ('loan-agreement'),
  ('meeting-background'),
  ('shining-carpet'),
  ('pink-desert-wallpaper')
on conflict (download_id) do nothing;

create or replace function public.increment_download_count(p_download_id text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint;
begin
  update public.download_counts
  set download_count = download_count + 1
  where download_id = p_download_id
  returning download_count into v_count;

  if v_count is null then
    raise exception 'Unknown download id' using errcode = '22023';
  end if;

  return v_count;
end;
$$;

revoke all on function public.increment_download_count(text) from public;
grant execute on function public.increment_download_count(text) to anon, authenticated;
