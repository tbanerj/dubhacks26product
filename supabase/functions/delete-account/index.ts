// Deletes the *calling* user's account (app-store account-deletion requirement).
// All game data cascades from auth.users via ON DELETE CASCADE.
//
// Auth: verify_jwt is off at the gateway (per Supabase guidance for the new API keys);
// this function validates the bearer token itself with auth.getUser(), and only ever
// deletes that user's id. It never accepts a user id from the request body.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function key(envJson: string, legacy: string): string {
  try {
    const parsed = JSON.parse(Deno.env.get(envJson) ?? '{}') as Record<string, string>;
    if (parsed.default) return parsed.default;
  } catch {
    // fall through to legacy key
  }
  return Deno.env.get(legacy) ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'not_authenticated' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const publishable = key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secret = key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

  const userClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'not_authenticated' });

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  // Revoke every session first so stolen refresh tokens die with the account.
  await admin.auth.admin.signOut(token, 'global').catch(() => undefined);
  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return json(500, { error: 'delete_failed' });

  return json(200, { ok: true });
});
