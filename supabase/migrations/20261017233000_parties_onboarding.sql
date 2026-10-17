-- Real parties (invite codes, ready states, chat over Realtime) + per-account onboarding flag.
--
-- Security model (same as thaw_core):
--  * RLS on every table; members can SELECT only rows of parties they belong to.
--  * All writes go through RPCs (private SECURITY DEFINER impls behind public INVOKER wrappers).
--  * Party size used for XP is now computed on the server from real membership.
--  * Party state exposes display name / avatar colour / XP of fellow members only.

-- ---------------------------------------------------------------------------
-- Onboarding flag (per account, so it follows the player across devices)
-- ---------------------------------------------------------------------------
alter table public.profiles add column onboarded_at timestamptz;
grant update (onboarded_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  quest_id text check (char_length(quest_id) between 1 and 200),
  quest_title text check (char_length(quest_title) between 1 and 80),
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table public.party_messages (
  id bigint generated always as identity primary key,
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index party_members_user_idx on public.party_members (user_id);
create index party_messages_party_created_idx on public.party_messages (party_id, created_at desc);
create index party_messages_user_created_idx on public.party_messages (user_id, created_at desc);
create index parties_host_idx on public.parties (host_id);

revoke all on public.parties, public.party_members, public.party_messages from anon, authenticated;
grant select on public.parties, public.party_members, public.party_messages to authenticated;

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_messages enable row level security;

-- Membership check used by policies (definer avoids recursive RLS on party_members).
create function private.is_party_member(p_party_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.party_members m where m.party_id = p_party_id and m.user_id = (select auth.uid()));
$$;
revoke all on function private.is_party_member(uuid) from public, anon;
grant execute on function private.is_party_member(uuid) to authenticated;

create policy "parties: members can read" on public.parties
  for select to authenticated using ((select private.is_party_member(id)));
create policy "party_members: members can read" on public.party_members
  for select to authenticated using ((select private.is_party_member(party_id)));
create policy "party_messages: members can read" on public.party_messages
  for select to authenticated using ((select private.is_party_member(party_id)));

-- Realtime: clients subscribe to changes for their party (RLS still applies).
alter publication supabase_realtime add table public.parties, public.party_members, public.party_messages;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.current_party_id(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.party_id
  from public.party_members m join public.parties p on p.id = m.party_id
  where m.user_id = p_uid and not p.closed and p.expires_at > now()
  order by m.joined_at desc
  limit 1;
$$;
revoke all on function private.current_party_id(uuid) from public, anon, authenticated;

create function private.party_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  b bytea;
begin
  loop
    b := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.parties where code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function private.party_code() from public, anon, authenticated;

-- Remove the caller from any party; hand host to the longest-standing member or close it.
create function private.leave_all_parties(p_uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_next uuid;
begin
  for r in select m.party_id from public.party_members m where m.user_id = p_uid loop
    delete from public.party_members where party_id = r.party_id and user_id = p_uid;
    select user_id into v_next from public.party_members where party_id = r.party_id order by joined_at limit 1;
    if v_next is null then
      update public.parties set closed = true where id = r.party_id;
    else
      update public.parties set host_id = v_next where id = r.party_id and host_id = p_uid;
    end if;
  end loop;
end;
$$;
revoke all on function private.leave_all_parties(uuid) from public, anon, authenticated;

-- Full state of the caller's current party, or null. Only fellow members' public fields.
create function private.party_state_impl() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_party public.parties%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  v_pid := private.current_party_id(v_uid);
  if v_pid is null then
    return null;
  end if;
  select * into v_party from public.parties where id = v_pid;
  return jsonb_build_object(
    'id', v_party.id,
    'code', v_party.code,
    'quest_id', v_party.quest_id,
    'quest_title', v_party.quest_title,
    'expires_at', v_party.expires_at,
    'is_host', v_party.host_id = v_uid,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', left(md5(m.user_id::text || v_pid::text), 12),
        'name', pr.display_name,
        'hue', pr.avatar_hue,
        'xp', coalesce(s.total_xp, 0),
        'ready', m.ready,
        'is_host', m.user_id = v_party.host_id,
        'is_self', m.user_id = v_uid
      ) order by m.joined_at)
      from public.party_members m
      join public.profiles pr on pr.id = m.user_id
      left join public.player_stats s on s.user_id = m.user_id
      where m.party_id = v_pid), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(x.msg order by x.created_at)
      from (
        select jsonb_build_object(
          'id', pm.id,
          'author_key', left(md5(pm.user_id::text || v_pid::text), 12),
          'author_name', pr.display_name,
          'body', pm.body,
          'at', pm.created_at,
          'is_self', pm.user_id = v_uid
        ) as msg, pm.created_at
        from public.party_messages pm join public.profiles pr on pr.id = pm.user_id
        where pm.party_id = v_pid
        order by pm.created_at desc
        limit 60
      ) x), '[]'::jsonb)
  );
end;
$$;

create function private.create_party_impl() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_recent integer;
  v_pid uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select count(*) into v_recent from public.parties where host_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  perform private.leave_all_parties(v_uid);
  insert into public.parties (code, host_id) values (private.party_code(), v_uid) returning id into v_pid;
  insert into public.party_members (party_id, user_id, ready) values (v_pid, v_uid, false);
  return private.party_state_impl();
end;
$$;

create function private.join_party_impl(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_party public.parties%rowtype;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_code !~ '^[A-HJ-NP-Z2-9]{6}$' then
    raise exception 'invalid_code' using errcode = '22023';
  end if;
  select * into v_party from public.parties where code = v_code for update;
  if not found or v_party.closed or v_party.expires_at <= now() then
    raise exception 'party_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.party_members where party_id = v_party.id and user_id = v_uid) then
    return private.party_state_impl();
  end if;
  select count(*) into v_count from public.party_members where party_id = v_party.id;
  if v_count >= 4 then
    raise exception 'party_full' using errcode = 'P0001';
  end if;
  perform private.leave_all_parties(v_uid);
  insert into public.party_members (party_id, user_id) values (v_party.id, v_uid);
  return private.party_state_impl();
end;
$$;

create function private.leave_party_impl() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.leave_all_parties(auth.uid());
end;
$$;

create function private.set_party_ready_impl(p_ready boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := private.current_party_id(auth.uid());
begin
  if v_pid is null then
    raise exception 'not_in_party' using errcode = 'P0002';
  end if;
  update public.party_members set ready = coalesce(p_ready, false) where party_id = v_pid and user_id = auth.uid();
end;
$$;

create function private.set_party_quest_impl(p_quest_id text, p_quest_title text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pid uuid := private.current_party_id(auth.uid());
begin
  if v_pid is null then
    raise exception 'not_in_party' using errcode = 'P0002';
  end if;
  if (p_quest_id is null) <> (p_quest_title is null)
     or (p_quest_id is not null and (char_length(p_quest_id) not between 1 and 200 or char_length(btrim(p_quest_title)) not between 1 and 80)) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.parties set quest_id = p_quest_id, quest_title = btrim(p_quest_title)
  where id = v_pid and host_id = auth.uid();
  if not found then
    raise exception 'not_host' using errcode = '42501';
  end if;
end;
$$;

create function private.send_party_message_impl(p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid := private.current_party_id(v_uid);
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));
  v_recent integer;
begin
  if v_pid is null then
    raise exception 'not_in_party' using errcode = 'P0002';
  end if;
  if char_length(v_body) not between 1 and 280 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select count(*) into v_recent from public.party_messages where user_id = v_uid and created_at > now() - interval '10 seconds';
  if v_recent >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.party_messages (party_id, user_id, body) values (v_pid, v_uid, v_body);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.party_state_impl()', 'private.create_party_impl()', 'private.join_party_impl(text)',
    'private.leave_party_impl()', 'private.set_party_ready_impl(boolean)',
    'private.set_party_quest_impl(text, text)', 'private.send_party_message_impl(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Public API wrappers
-- ---------------------------------------------------------------------------
create function public.get_party_state() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.party_state_impl(); $$;
create function public.create_party() returns jsonb
language sql security invoker set search_path = '' as $$ select private.create_party_impl(); $$;
create function public.join_party(p_code text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.join_party_impl(p_code); $$;
create function public.leave_party() returns void
language sql security invoker set search_path = '' as $$ select private.leave_party_impl(); $$;
create function public.set_party_ready(p_ready boolean) returns void
language sql security invoker set search_path = '' as $$ select private.set_party_ready_impl(p_ready); $$;
create function public.set_party_quest(p_quest_id text, p_quest_title text) returns void
language sql security invoker set search_path = '' as $$ select private.set_party_quest_impl(p_quest_id, p_quest_title); $$;
create function public.send_party_message(p_body text) returns void
language sql security invoker set search_path = '' as $$ select private.send_party_message_impl(p_body); $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.get_party_state()', 'public.create_party()', 'public.join_party(text)', 'public.leave_party()',
    'public.set_party_ready(boolean)', 'public.set_party_quest(text, text)', 'public.send_party_message(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- complete_quest: party size now comes from real membership, not the client.
-- (p_party_size is kept for signature compatibility and ignored.)
-- ---------------------------------------------------------------------------
create or replace function private.complete_quest_impl(
  p_quest_id text, p_landmark_id text, p_landmark_name text, p_quest_title text, p_difficulty text,
  p_mode text, p_party_size integer, p_collectible_theme text, p_collectible_rarity text,
  p_collectible_name text, p_time_zone text
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

  select name into v_tz from pg_catalog.pg_timezone_names where name = p_time_zone;
  v_tz := coalesce(v_tz, 'UTC');
  v_day := (now() at time zone v_tz)::date;

  select * into v_stats from public.player_stats where user_id = v_uid for update;
  if not found then
    insert into public.player_stats (user_id) values (v_uid) returning * into v_stats;
  end if;

  if exists (select 1 from public.completions where user_id = v_uid and quest_id = p_quest_id) then
    return jsonb_build_object('duplicate', true, 'xp_gained', 0, 'total_xp', v_stats.total_xp,
      'streak', v_stats.streak, 'new_landmark', false, 'collectible', null, 'day', v_stats.last_active_day, 'party_size', 1);
  end if;

  if v_stats.last_completion_at is not null and now() - v_stats.last_completion_at < c_min_interval then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Wait a few seconds between quests.';
  end if;
  select count(*) into v_today_count from public.completions where user_id = v_uid and day = v_day;
  if v_today_count >= c_daily_cap then
    raise exception 'daily_limit' using errcode = 'P0001', hint = 'Daily quest limit reached.';
  end if;

  v_party := case when p_mode = 'solo' then 1 else greatest(1, least(4, coalesce(
    (select count(*)::integer from public.party_members m where m.party_id = private.current_party_id(v_uid)), 1))) end;
  v_new_landmark := not exists (select 1 from public.visited_landmarks where user_id = v_uid and landmark_id = p_landmark_id);
  v_xp := private.base_xp(p_difficulty) + least(30, (v_party - 1) * 10) + case when v_new_landmark then 20 else 0 end;

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
    return jsonb_build_object('duplicate', true, 'xp_gained', 0, 'total_xp', v_stats.total_xp,
      'streak', v_stats.streak, 'new_landmark', false, 'collectible', null, 'day', v_stats.last_active_day, 'party_size', 1);
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
    'duplicate', false, 'xp_gained', v_xp, 'total_xp', v_stats.total_xp, 'streak', v_stats.streak,
    'new_landmark', v_new_landmark, 'day', v_day, 'party_size', v_party,
    'collectible', case when v_collectible_new then (
      select jsonb_build_object('id', c.collectible_id, 'name', c.name, 'theme', c.theme, 'rarity', c.rarity,
                                'landmark_name', c.landmark_name, 'unlocked_at', c.unlocked_at)
      from public.collectibles c where c.user_id = v_uid and c.collectible_id = v_collectible_id
    ) else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Server-enforced photo verification.
-- Quests can now only be completed by the `verify-evidence` Edge Function, which checks
-- the photo with Gemini first and then calls complete_quest_verified with the service key.
-- ---------------------------------------------------------------------------

-- Audit + rate-limit log for AI calls (verification and quest generation).
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('verify', 'quests')),
  quest_id text,
  accepted boolean,
  confidence real,
  created_at timestamptz not null default now()
);
create index ai_usage_user_kind_created_idx on public.ai_usage (user_id, kind, created_at desc);
revoke all on public.ai_usage from anon, authenticated;
alter table public.ai_usage enable row level security;
create policy "ai_usage: no client access (service role only)" on public.ai_usage
  as restrictive for all to authenticated, anon using (false) with check (false);

-- Service-only entry point. Same rules as before, but the user id comes from the
-- Edge Function (which validated the JWT) instead of auth.uid().
create function private.complete_quest_for(
  p_user_id uuid, p_quest_id text, p_landmark_id text, p_landmark_name text, p_quest_title text,
  p_difficulty text, p_mode text, p_collectible_theme text, p_collectible_rarity text,
  p_collectible_name text, p_time_zone text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- Reuse the single implementation by impersonating the user for auth.uid().
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  return private.complete_quest_impl(p_quest_id, p_landmark_id, p_landmark_name, p_quest_title, p_difficulty,
    p_mode, 1, p_collectible_theme, p_collectible_rarity, p_collectible_name, p_time_zone);
end;
$$;
revoke all on function private.complete_quest_for(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.complete_quest_for(uuid, text, text, text, text, text, text, text, text, text, text) to service_role;

create function public.complete_quest_verified(
  p_user_id uuid, p_quest_id text, p_landmark_id text, p_landmark_name text, p_quest_title text,
  p_difficulty text, p_mode text, p_collectible_theme text, p_collectible_rarity text,
  p_collectible_name text, p_time_zone text
) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.complete_quest_for(p_user_id, p_quest_id, p_landmark_id, p_landmark_name, p_quest_title,
    p_difficulty, p_mode, p_collectible_theme, p_collectible_rarity, p_collectible_name, p_time_zone);
$$;
revoke all on function public.complete_quest_verified(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_quest_verified(uuid, text, text, text, text, text, text, text, text, text, text) to service_role;

-- Players can no longer award themselves quests directly.
revoke execute on function public.complete_quest(text, text, text, text, text, text, integer, text, text, text, text) from authenticated;
revoke execute on function private.complete_quest_impl(text, text, text, text, text, text, integer, text, text, text, text) from authenticated;
grant execute on function private.complete_quest_impl(text, text, text, text, text, text, integer, text, text, text, text) to service_role;
