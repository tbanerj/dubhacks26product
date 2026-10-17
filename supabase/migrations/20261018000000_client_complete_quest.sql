-- Trinav checks photos in the app with Gemini, then records the reward here.
-- 20261017233000 revoked this from authenticated so only the verify-evidence
-- Edge Function could award XP. That function is not part of this client flow.

grant execute on function private.complete_quest_impl(text, text, text, text, text, text, integer, text, text, text, text) to authenticated;
grant execute on function public.complete_quest(text, text, text, text, text, text, integer, text, text, text, text) to authenticated;
