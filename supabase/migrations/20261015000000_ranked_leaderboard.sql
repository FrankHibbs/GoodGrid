create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_ci_unique
  on public.profiles (lower(username));

create table if not exists public.daily_challenges (
  challenge_date date not null,
  box_size smallint not null check (box_size in (3, 4, 5)),
  difficulty text not null default 'medium' check (difficulty = 'medium'),
  puzzle jsonb not null,
  solution jsonb not null,
  created_at timestamptz not null default now(),
  primary key (challenge_date, box_size)
);

create table if not exists public.ranked_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_date date not null,
  box_size smallint not null check (box_size in (3, 4, 5)),
  started_at timestamptz not null default now(),
  progress jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  elapsed_ms bigint,
  status text not null default 'started' check (status in ('started', 'completed')),
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date, box_size),
  check ((status = 'started' and completed_at is null and elapsed_ms is null)
      or (status = 'completed' and completed_at is not null and elapsed_ms > 0))
);

create table if not exists public.ranked_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.ranked_attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_date date not null,
  box_size smallint not null check (box_size in (3, 4, 5)),
  elapsed_ms bigint not null check (elapsed_ms > 0),
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date, box_size)
);

create index if not exists ranked_scores_daily_rank_idx
  on public.ranked_scores (challenge_date, box_size, elapsed_ms);
create index if not exists ranked_scores_all_time_rank_idx
  on public.ranked_scores (box_size, elapsed_ms);

alter table public.profiles enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.ranked_attempts enable row level security;
alter table public.ranked_scores enable row level security;

drop policy if exists "Usernames are public" on public.profiles;
create policy "Usernames are public"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Users can read their attempts" on public.ranked_attempts;
create policy "Users can read their attempts"
  on public.ranked_attempts for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Leaderboard scores are public" on public.ranked_scores;
create policy "Leaderboard scores are public"
  on public.ranked_scores for select to anon, authenticated using (true);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(new.raw_user_meta_data ->> 'username', '');
  if requested_username !~ '^[A-Za-z0-9_]{3,20}$' then
    requested_username := 'player_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.profiles (id, username)
  values (new.id, requested_username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_goodgrid on auth.users;
create trigger on_auth_user_created_goodgrid
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.finish_ranked_attempt(
  p_attempt_id uuid,
  p_user_id uuid,
  p_elapsed_ms bigint
)
returns table (challenge_date date, box_size smallint, elapsed_ms bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished public.ranked_attempts%rowtype;
begin
  update public.ranked_attempts as attempt
  set status = 'completed',
      completed_at = now(),
      elapsed_ms = p_elapsed_ms
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and attempt.status = 'started'
  returning attempt.* into finished;

  if not found then
    return;
  end if;

  insert into public.ranked_scores (attempt_id, user_id, challenge_date, box_size, elapsed_ms)
  values (finished.id, finished.user_id, finished.challenge_date, finished.box_size, p_elapsed_ms);

  return query select finished.challenge_date, finished.box_size, p_elapsed_ms;
end;
$$;

create or replace function public.get_ranked_leaderboard(
  p_box_size smallint,
  p_challenge_date date default null,
  p_all_time boolean default false
)
returns table (rank bigint, username text, elapsed_ms bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with per_player as (
    select scores.user_id, profiles.username, scores.elapsed_ms,
      row_number() over (partition by scores.user_id order by scores.elapsed_ms, scores.created_at) as best
    from public.ranked_scores as scores
    join public.profiles as profiles on profiles.id = scores.user_id
    where scores.box_size = p_box_size
      and (p_all_time or scores.challenge_date = p_challenge_date)
  ), ranked as (
    select dense_rank() over (order by per_player.elapsed_ms) as rank,
      per_player.username, per_player.elapsed_ms
    from per_player
    where per_player.best = 1
  )
  select ranked.rank, ranked.username, ranked.elapsed_ms
  from ranked
  order by ranked.elapsed_ms, ranked.username
  limit 100;
$$;

revoke all on function public.finish_ranked_attempt(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.finish_ranked_attempt(uuid, uuid, bigint) to service_role;
revoke all on function public.get_ranked_leaderboard(smallint, date, boolean) from public, anon, authenticated;
grant execute on function public.get_ranked_leaderboard(smallint, date, boolean) to service_role;
