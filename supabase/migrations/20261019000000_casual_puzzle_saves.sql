create table if not exists public.casual_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save_data jsonb not null check (jsonb_typeof(save_data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.casual_saves enable row level security;
grant select, insert, update on public.casual_saves to authenticated;

drop policy if exists "Users can read their casual saves" on public.casual_saves;
create policy "Users can read their casual saves"
  on public.casual_saves for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their casual saves" on public.casual_saves;
create policy "Users can create their casual saves"
  on public.casual_saves for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their casual saves" on public.casual_saves;
create policy "Users can update their casual saves"
  on public.casual_saves for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_casual_save_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_casual_save_updated_at on public.casual_saves;
create trigger set_casual_save_updated_at
  before update on public.casual_saves
  for each row execute function public.set_casual_save_updated_at();
