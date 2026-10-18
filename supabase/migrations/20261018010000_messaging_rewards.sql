-- Text-quest rewards for a linked Supabase user.
-- Photon calls this with the service role after its own SQLite reward commits.
-- Clients cannot call it. XP comes from the quest id, not from the caller.

create function public.record_messaging_completion(
  p_user_id uuid,
  p_quest_id text,
  p_title text,
  p_difficulty text,
  p_collectible_id text,
  p_collectible_name text,
  p_theme text,
  p_place_label text,
  p_time_zone text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_difficulty text;
  v_theme text;
  v_name text;
  v_collectible_id text;
  v_place text;
  v_tz text;
  v_day date;
  v_stats public.player_stats%rowtype;
  v_xp integer;
  v_streak integer;
  v_inserted bigint;
  v_landmark text;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_quest_id = 'hidden-detail' then
    v_title := 'Hidden Detail'; v_difficulty := 'easy'; v_theme := 'hidden';
    v_name := 'Hidden Detail pin'; v_collectible_id := 'pin-hidden-detail';
  elsif p_quest_id = 'nature-nearby' then
    v_title := 'Nature Nearby'; v_difficulty := 'easy'; v_theme := 'botanical';
    v_name := 'Nature Nearby pin'; v_collectible_id := 'pin-nature-nearby';
  elsif p_quest_id = 'shared-perspective' then
    v_title := 'Shared Perspective'; v_difficulty := 'medium'; v_theme := 'cooperative';
    v_name := 'Shared Perspective pin'; v_collectible_id := 'pin-shared-perspective';
  else
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_place := left(btrim(coalesce(p_place_label, 'A place you named')), 80);
  if char_length(v_place) < 1 then
    v_place := 'A place you named';
  end if;
  v_landmark := 'text:' || p_quest_id;

  select name into v_tz from pg_catalog.pg_timezone_names where name = p_time_zone;
  v_tz := coalesce(v_tz, 'UTC');
  v_day := (pg_catalog.now() at time zone v_tz)::date;
  v_xp := case v_difficulty when 'easy' then 60 when 'medium' then 90 else 130 end;

  select * into v_stats from public.player_stats where user_id = p_user_id for update;
  if not found then
    insert into public.player_stats (user_id) values (p_user_id) returning * into v_stats;
  end if;

  if exists (select 1 from public.completions where user_id = p_user_id and quest_id = p_quest_id) then
    return jsonb_build_object('duplicate', true, 'xp_gained', 0, 'total_xp', v_stats.total_xp);
  end if;

  if v_stats.last_completion_at is not null and pg_catalog.now() - v_stats.last_completion_at < interval '20 seconds' then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_streak := case
    when v_stats.last_active_day is null then 1
    when v_day <= v_stats.last_active_day then greatest(1, v_stats.streak)
    when v_day = v_stats.last_active_day + 1 then v_stats.streak + 1
    else 1
  end;

  insert into public.completions (
    user_id, quest_id, landmark_id, landmark_name, quest_title, difficulty, mode, party_size, xp, collectible_id, day
  ) values (
    p_user_id, p_quest_id, v_landmark, v_place, v_title, v_difficulty, 'solo', 1, v_xp, v_collectible_id, v_day
  )
  on conflict (user_id, quest_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('duplicate', true, 'xp_gained', 0, 'total_xp', v_stats.total_xp);
  end if;

  insert into public.collectibles (user_id, collectible_id, name, theme, rarity, landmark_name)
  values (p_user_id, v_collectible_id, v_name, v_theme, 'common', v_place)
  on conflict (user_id, collectible_id) do nothing;

  insert into public.daily_xp (user_id, day, xp) values (p_user_id, v_day, v_xp)
  on conflict (user_id, day) do update set xp = public.daily_xp.xp + excluded.xp;

  update public.player_stats set
    total_xp = total_xp + v_xp,
    quests_completed = quests_completed + 1,
    streak = v_streak,
    last_active_day = greatest(coalesce(last_active_day, v_day), v_day),
    last_completion_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where user_id = p_user_id
  returning * into v_stats;

  return jsonb_build_object('duplicate', false, 'xp_gained', v_xp, 'total_xp', v_stats.total_xp, 'collectible_id', v_collectible_id);
end;
$$;

revoke all on function public.record_messaging_completion(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_messaging_completion(uuid, text, text, text, text, text, text, text, text) to service_role;
