-- Thaw core schema: profiles, server-authoritative progression, leaderboards.
--
-- Security model
--  * Every table has RLS. Clients (role `authenticated`) can only SELECT their own rows.
--  * Clients cannot INSERT/UPDATE/DELETE game data directly. All writes go through
--    `public.complete_quest`, which computes XP, streaks, pins and daily totals on the
--    server, is idempotent per (user, quest), validates inputs and rate-limits.
--  * The only direct client write is profiles(display_name, avatar_hue) for the owner.
--  * SECURITY DEFINER code lives in the unexposed `private` schema; the public API
--    functions are SECURITY INVOKER wrappers.
--  * `anon` gets nothing.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Explorer'
    constraint profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 24)
    constraint profiles_display_name_chars check (display_name !~ '[[:cntrl:]]'),
  avatar_hue smallint not null default 28
    constraint profiles_avatar_hue_range check (avatar_hue between 0 and 359),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  quests_completed integer not null default 0 check (quests_completed >= 0),
  landmarks_visited integer not null default 0 check (landmarks_visited >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_active_day date,
  last_completion_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quest_id text not null check (char_length(quest_id) between 1 and 200),
  landmark_id text not null check (char_length(landmark_id) between 1 and 120),
  landmark_name text not null check (char_length(landmark_name) between 1 and 80),
  quest_title text not null check (char_length(quest_title) between 1 and 80),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  mode text not null check (mode in ('solo', 'social', 'party')),
  party_size smallint not null check (party_size between 1 and 4),
  xp integer not null check (xp between 0 and 500),
  collectible_id text,
  day date not null,
  completed_at timestamptz not null default now(),
  constraint completions_user_quest_unique unique (user_id, quest_id)
);

create table public.visited_landmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  landmark_id text not null check (char_length(landmark_id) between 1 and 120),
  first_visited_at timestamptz not null default now(),
  primary key (user_id, landmark_id)
);

create table public.collectibles (
  user_id uuid not null references auth.users (id) on delete cascade,
  collectible_id text not null check (char_length(collectible_id) between 1 and 200),
  name text not null check (char_length(name) between 1 and 40),
  theme text not null check (theme in ('botanical', 'architecture', 'culture', 'hidden', 'cooperative', 'neighborhood')),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'legendary')),
  landmark_name text not null check (char_length(landmark_name) between 1 and 80),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, collectible_id)
);

create table public.daily_xp (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  xp integer not null default 0 check (xp >= 0),
  primary key (user_id, day)
);

-- Indexes for per-user history and leaderboard ordering.
create index completions_user_completed_idx on public.completions (user_id, completed_at desc);
create index player_stats_total_xp_idx on public.player_stats (total_xp desc);
create index player_stats_quests_idx on public.player_stats (quests_completed desc);
create index player_stats_landmarks_idx on public.player_stats (landmarks_visited desc);
create index daily_xp_day_xp_idx on public.daily_xp (day, xp desc);

-- ---------------------------------------------------------------------------
-- Privileges + RLS (explicit; do not rely on project default grants)
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.player_stats, public.completions,
  public.visited_landmarks, public.collectibles, public.daily_xp from anon, authenticated;

grant select on public.profiles, public.player_stats, public.completions,
  public.visited_landmarks, public.collectibles, public.daily_xp to authenticated;
grant update (display_name, avatar_hue) on public.profiles to authenticated;

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.completions enable row level security;
alter table public.visited_landmarks enable row level security;
alter table public.collectibles enable row level security;
alter table public.daily_xp enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "player_stats: owner can read" on public.player_stats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "completions: owner can read" on public.completions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "visited_landmarks: owner can read" on public.visited_landmarks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "collectibles: owner can read" on public.collectibles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_xp: owner can read" on public.daily_xp
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- updated_at + new-user bootstrap
-- ---------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Display name comes from sign-up metadata. It's display-only (never used for authorization).
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '[[:cntrl:]]', '', 'g'));
begin
  if char_length(v_name) = 0 then
    v_name := 'Explorer';
  end if;
  insert into public.profiles (id, display_name) values (new.id, left(v_name, 24));
  insert into public.player_stats (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Game rules (must match src/game/progression.ts)
-- ---------------------------------------------------------------------------

create function private.base_xp(p_difficulty text) returns integer
language sql immutable set search_path = '' as $$
  select case p_difficulty when 'easy' then 60 when 'medium' then 90 when 'hard' then 130 end;
$$;

-- Server-authoritative completion. Returns a JSON reward summary.
create function private.complete_quest_impl(
  p_quest_id text,
  p_landmark_id text,
  p_landmark_name text,
  p_quest_title text,
  p_difficulty text,
  p_mode text,
  p_party_size integer,
  p_collectible_theme text,
  p_collectible_rarity text,
  p_collectible_name text,
  p_time_zone text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_day date;
  v_stats public.player_stats%rowtype;
  v_party integer;
  v_new_landmark boolean;
  v_xp integer;
  v_streak integer;
  v_collectible_id text;
  v_collectible_new boolean := false;
  v_today_count integer;
  v_inserted bigint;
  c_min_interval constant interval := interval '20 seconds';
  c_daily_cap constant integer := 40;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Input validation (CHECK constraints are the backstop; these give clean errors).
  if p_quest_id is null or char_length(p_quest_id) not between 1 and 200
     or p_landmark_id is null or char_length(p_landmark_id) not between 1 and 120
     or p_landmark_name is null or char_length(btrim(p_landmark_name)) not between 1 and 80
     or p_quest_title is null or char_length(btrim(p_quest_title)) not between 1 and 80
     or p_difficulty is null or p_difficulty not in ('easy', 'medium', 'hard')
     or p_mode is null or p_mode not in ('solo', 'social', 'party')
     or p_collectible_theme is null or p_collectible_theme not in ('botanical', 'architecture', 'culture', 'hidden', 'cooperative', 'neighborhood')
     or p_collectible_rarity is null or p_collectible_rarity not in ('common', 'uncommon', 'rare', 'legendary')
     or p_collectible_name is null or char_length(btrim(p_collectible_name)) not between 1 and 40 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- The player's local day (for daily XP + streaks). Unknown zones fall back to UTC.
  select name into v_tz from pg_catalog.pg_timezone_names where name = p_time_zone;
  v_tz := coalesce(v_tz, 'UTC');
  v_day := (now() at time zone v_tz)::date;

  -- Serialise this user's completions.
  select * into v_stats from public.player_stats where user_id = v_uid for update;
  if not found then
    insert into public.player_stats (user_id) values (v_uid) returning * into v_stats;
  end if;

  -- Idempotency: a quest can only ever be rewarded once.
  if exists (select 1 from public.completions where user_id = v_uid and quest_id = p_quest_id) then
    return jsonb_build_object(
      'duplicate', true, 'xp_gained', 0, 'total_xp', v_stats.total_xp,
      'streak', v_stats.streak, 'new_landmark', false, 'collectible', null, 'day', v_stats.last_active_day);
  end if;

  -- Rate limits.
  if v_stats.last_completion_at is not null and now() - v_stats.last_completion_at < c_min_interval then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Wait a few seconds between quests.';
  end if;
  select count(*) into v_today_count from public.completions where user_id = v_uid and day = v_day;
  if v_today_count >= c_daily_cap then
    raise exception 'daily_limit' using errcode = 'P0001', hint = 'Daily quest limit reached.';
  end if;

  -- XP: base + capped party bonus + first-visit bonus. Solo quests never get a party bonus.
  v_party := case when p_mode = 'solo' then 1 else greatest(1, least(4, coalesce(p_party_size, 1))) end;
  v_new_landmark := not exists (select 1 from public.visited_landmarks where user_id = v_uid and landmark_id = p_landmark_id);
  v_xp := private.base_xp(p_difficulty) + least(30, (v_party - 1) * 10) + case when v_new_landmark then 20 else 0 end;

  -- Streak in the player's local calendar.
  v_streak := case
    when v_stats.last_active_day is null then 1
    when v_day <= v_stats.last_active_day then greatest(1, v_stats.streak)
    when v_day = v_stats.last_active_day + 1 then v_stats.streak + 1
    else 1
  end;

  v_collectible_id := 'pin:' || p_landmark_id || ':' || p_collectible_theme;

  insert into public.completions (user_id, quest_id, landmark_id, landmark_name, quest_title, difficulty, mode, party_size, xp, collectible_id, day)
  values (v_uid, p_quest_id, p_landmark_id, btrim(p_landmark_name), btrim(p_quest_title), p_difficulty, p_mode, v_party, v_xp, v_collectible_id, v_day)
  on conflict (user_id, quest_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    -- Lost a race with a concurrent identical request: treat as duplicate.
    return jsonb_build_object(
      'duplicate', true, 'xp_gained', 0, 'total_xp', v_stats.total_xp,
      'streak', v_stats.streak, 'new_landmark', false, 'collectible', null, 'day', v_stats.last_active_day);
  end if;

  if v_new_landmark then
    insert into public.visited_landmarks (user_id, landmark_id) values (v_uid, p_landmark_id) on conflict do nothing;
  end if;

  insert into public.collectibles (user_id, collectible_id, name, theme, rarity, landmark_name)
  values (v_uid, v_collectible_id, btrim(p_collectible_name), p_collectible_theme, p_collectible_rarity, btrim(p_landmark_name))
  on conflict (user_id, collectible_id) do nothing;
  v_collectible_new := found;

  insert into public.daily_xp (user_id, day, xp) values (v_uid, v_day, v_xp)
  on conflict (user_id, day) do update set xp = public.daily_xp.xp + excluded.xp;

  update public.player_stats set
    total_xp = total_xp + v_xp,
    quests_completed = quests_completed + 1,
    landmarks_visited = landmarks_visited + case when v_new_landmark then 1 else 0 end,
    streak = v_streak,
    last_active_day = greatest(coalesce(last_active_day, v_day), v_day),
    last_completion_at = now(),
    updated_at = now()
  where user_id = v_uid
  returning * into v_stats;

  return jsonb_build_object(
    'duplicate', false,
    'xp_gained', v_xp,
    'total_xp', v_stats.total_xp,
    'streak', v_stats.streak,
    'new_landmark', v_new_landmark,
    'day', v_day,
    'collectible', case when v_collectible_new then (
      select jsonb_build_object('id', c.collectible_id, 'name', c.name, 'theme', c.theme, 'rarity', c.rarity,
                                'landmark_name', c.landmark_name, 'unlocked_at', c.unlocked_at)
      from public.collectibles c where c.user_id = v_uid and c.collectible_id = v_collectible_id
    ) else null end
  );
end;
$$;

-- Leaderboards expose only display name, avatar colour and the score. No ids, no emails.
create function private.leaderboard_impl(p_kind text, p_day date, p_limit integer)
returns table (rank bigint, display_name text, avatar_hue smallint, value bigint, is_self boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(100, coalesce(p_limit, 50)));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind = 'daily' then
    if p_day is null or abs(p_day - current_date) > 1 then
      raise exception 'invalid_day' using errcode = '22023';
    end if;
    return query
      select rank() over (order by d.xp desc)::bigint, p.display_name, p.avatar_hue, d.xp::bigint, d.user_id = v_uid
      from public.daily_xp d join public.profiles p on p.id = d.user_id
      where d.day = p_day and d.xp > 0
      order by d.xp desc, p.display_name
      limit v_limit;
  elsif p_kind in ('allTime', 'quests', 'landmarks') then
    return query
      select rank() over (order by v.value desc)::bigint, v.display_name, v.avatar_hue, v.value, v.user_id = v_uid
      from (
        select s.user_id, p.display_name, p.avatar_hue,
          (case p_kind when 'allTime' then s.total_xp when 'quests' then s.quests_completed else s.landmarks_visited end)::bigint as value
        from public.player_stats s join public.profiles p on p.id = s.user_id
      ) v
      where v.value > 0
      order by v.value desc, v.display_name
      limit v_limit;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
end;
$$;

-- The caller's own rank on a board, even if they're outside the top N.
create function private.my_rank_impl(p_kind text, p_day date)
returns table (rank bigint, value bigint, players bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_value bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind = 'daily' then
    if p_day is null or abs(p_day - current_date) > 1 then
      raise exception 'invalid_day' using errcode = '22023';
    end if;
    select coalesce((select xp from public.daily_xp where user_id = v_uid and day = p_day), 0) into v_value;
    return query select
      (select count(*) from public.daily_xp where day = p_day and xp > v_value) + 1,
      v_value,
      (select count(*) from public.daily_xp where day = p_day and xp > 0);
  elsif p_kind in ('allTime', 'quests', 'landmarks') then
    select case p_kind when 'allTime' then total_xp when 'quests' then quests_completed else landmarks_visited end
      into v_value from public.player_stats where user_id = v_uid;
    v_value := coalesce(v_value, 0);
    return query select
      (select count(*) from public.player_stats s
        where (case p_kind when 'allTime' then s.total_xp when 'quests' then s.quests_completed else s.landmarks_visited end) > v_value) + 1,
      v_value,
      (select count(*) from public.player_stats s
        where (case p_kind when 'allTime' then s.total_xp when 'quests' then s.quests_completed else s.landmarks_visited end) > 0);
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
end;
$$;

-- Account deletion is handled by the `delete-account` Edge Function (auth.admin.deleteUser),
-- which cascades to every table above.

revoke all on function private.base_xp(text) from public, anon;
revoke all on function private.complete_quest_impl(text, text, text, text, text, text, integer, text, text, text, text) from public, anon;
revoke all on function private.leaderboard_impl(text, date, integer) from public, anon;
revoke all on function private.my_rank_impl(text, date) from public, anon;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
grant execute on function private.base_xp(text) to authenticated;
grant execute on function private.complete_quest_impl(text, text, text, text, text, text, integer, text, text, text, text) to authenticated;
grant execute on function private.leaderboard_impl(text, date, integer) to authenticated;
grant execute on function private.my_rank_impl(text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Public API (SECURITY INVOKER wrappers exposed via PostgREST /rpc)
-- ---------------------------------------------------------------------------

create function public.complete_quest(
  p_quest_id text,
  p_landmark_id text,
  p_landmark_name text,
  p_quest_title text,
  p_difficulty text,
  p_mode text,
  p_party_size integer,
  p_collectible_theme text,
  p_collectible_rarity text,
  p_collectible_name text,
  p_time_zone text
) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.complete_quest_impl(p_quest_id, p_landmark_id, p_landmark_name, p_quest_title, p_difficulty,
    p_mode, p_party_size, p_collectible_theme, p_collectible_rarity, p_collectible_name, p_time_zone);
$$;

create function public.get_leaderboard(p_kind text, p_day date default null, p_limit integer default 50)
returns table (rank bigint, display_name text, avatar_hue smallint, value bigint, is_self boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.leaderboard_impl(p_kind, p_day, p_limit);
$$;

create function public.get_my_rank(p_kind text, p_day date default null)
returns table (rank bigint, value bigint, players bigint)
language sql stable security invoker set search_path = '' as $$
  select * from private.my_rank_impl(p_kind, p_day);
$$;

revoke all on function public.complete_quest(text, text, text, text, text, text, integer, text, text, text, text) from public, anon;
revoke all on function public.get_leaderboard(text, date, integer) from public, anon;
revoke all on function public.get_my_rank(text, date) from public, anon;
grant execute on function public.complete_quest(text, text, text, text, text, text, integer, text, text, text, text) to authenticated;
grant execute on function public.get_leaderboard(text, date, integer) to authenticated;
grant execute on function public.get_my_rank(text, date) to authenticated;
