alter table public.ranked_attempts
  add column if not exists resumed_at timestamptz;

alter table public.ranked_attempts
  drop constraint if exists ranked_attempts_status_check,
  drop constraint if exists ranked_attempts_check;

update public.ranked_attempts
set elapsed_ms = 0
where status = 'started' and elapsed_ms is null;

update public.ranked_attempts
set resumed_at = started_at
where status = 'started' and resumed_at is null;

update public.ranked_attempts
set resumed_at = null
where status = 'completed';

alter table public.ranked_attempts
  alter column elapsed_ms set default 0,
  alter column elapsed_ms set not null,
  alter column resumed_at set default now(),
  add constraint ranked_attempts_status_check
    check (status in ('started', 'paused', 'completed')),
  add constraint ranked_attempts_state_check
    check (
      (status = 'started' and completed_at is null and elapsed_ms >= 0 and resumed_at is not null)
      or (status = 'paused' and completed_at is null and elapsed_ms >= 0 and resumed_at is null)
      or (status = 'completed' and completed_at is not null and elapsed_ms > 0 and resumed_at is null)
    );

create or replace function public.pause_ranked_attempt(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (elapsed_ms bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempt public.ranked_attempts%rowtype;
  now_at timestamptz;
  segment_ms bigint;
  final_elapsed_ms bigint;
begin
  select * into current_attempt
  from public.ranked_attempts as attempt
  where attempt.id = p_attempt_id and attempt.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if current_attempt.status = 'paused' then
    return query select current_attempt.elapsed_ms;
    return;
  end if;

  if current_attempt.status <> 'started' then
    return;
  end if;

  now_at := clock_timestamp();
  segment_ms := greatest(0, floor(extract(epoch from (now_at - current_attempt.resumed_at)) * 1000)::bigint);

  update public.ranked_attempts as attempt
  set status = 'paused',
      elapsed_ms = current_attempt.elapsed_ms + segment_ms,
      resumed_at = null
  where attempt.id = current_attempt.id
  returning attempt.elapsed_ms into final_elapsed_ms;

  return query select final_elapsed_ms;
end;
$$;

create or replace function public.resume_ranked_attempt(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (elapsed_ms bigint, resumed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempt public.ranked_attempts%rowtype;
begin
  select * into current_attempt
  from public.ranked_attempts as attempt
  where attempt.id = p_attempt_id and attempt.user_id = p_user_id
  for update;

  if not found or current_attempt.status = 'completed' then
    return;
  end if;

  if current_attempt.status = 'paused' then
    update public.ranked_attempts as attempt
    set status = 'started', resumed_at = clock_timestamp()
    where attempt.id = current_attempt.id
    returning attempt.* into current_attempt;
  end if;

  return query select current_attempt.elapsed_ms, current_attempt.resumed_at;
end;
$$;

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
      elapsed_ms = p_elapsed_ms,
      resumed_at = null
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

revoke all on function public.pause_ranked_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pause_ranked_attempt(uuid, uuid) to service_role;
revoke all on function public.resume_ranked_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resume_ranked_attempt(uuid, uuid) to service_role;
