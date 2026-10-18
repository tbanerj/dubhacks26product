/**
 * Email + password accounts with verified email (Supabase Auth, PKCE).
 *
 * Email verification: sign-up sends a confirmation email. The link verifies the
 * address on Supabase's side *before* redirecting, so even if the deep link can't
 * open the app (e.g. on another device), the account is confirmed and the player can
 * simply sign in. When the link does open the app we exchange the code for a session.
 */
import * as Linking from 'expo-linking';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import { clampText } from '../utils/format';

export type AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Enter your email.';
  if (e.length > 254 || !EMAIL_RE.test(e)) return 'That doesn’t look like an email address.';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 72) return 'Use 72 characters or fewer.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Mix letters and numbers.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const n = name.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!n) return 'Pick an explorer name.';
  if (Array.from(n).length > 24) return 'Keep it to 24 characters.';
  return null;
}

/** Human-friendly messages for Supabase Auth error codes. */
export function friendlyAuthError(err: Pick<AuthError, 'message'> & { code?: string; status?: number }): string {
  switch (err.code) {
    case 'invalid_credentials':
      return 'Email or password is incorrect.';
    case 'email_not_confirmed':
      return 'Please verify your email first – check your inbox for the link.';
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in.';
    case 'weak_password':
      return 'That password is too weak. Try a longer one with letters and numbers.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'email_address_not_authorized':
      return 'We can’t send email to this address yet (the game’s email service is still in testing). Please try again later.';
    case 'email_address_invalid':
      return 'That email address can’t be used.';
    case 'signup_disabled':
      return 'Sign-ups are currently closed.';
    case 'same_password':
      return 'Choose a password you haven’t used before.';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'This link has expired or was opened on another device. Request a new one.';
    default:
      if (err.status === 0 || /network|fetch/i.test(err.message)) return 'Can’t reach the server. Check your connection.';
      if (/address not authorized/i.test(err.message)) return friendlyAuthError({ message: '', code: 'email_address_not_authorized' });
      return err.message || 'Something went wrong. Please try again.';
  }
}

function fail(err: AuthError | { message: string; code?: string; status?: number }): { ok: false; error: string; code?: string } {
  return { ok: false, error: friendlyAuthError(err), code: err.code };
}

const notConfigured = { ok: false as const, error: 'Accounts aren’t set up in this build.' };

export const AUTH_LINKS = {
  confirm: () => Linking.createURL('auth/confirm'),
  reset: () => Linking.createURL('auth/reset'),
};

export async function signUp(email: string, password: string, displayName: string): Promise<AuthResult<{ needsConfirmation: boolean }>> {
  if (!supabase) return notConfigured;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: clampText(displayName.replace(/[\u0000-\u001F\u007F]/g, ''), 24) },
      emailRedirectTo: AUTH_LINKS.confirm(),
    },
  });
  if (error) return fail(error);
  // With "Confirm email" on, no session is returned until the address is verified.
  return { ok: true, data: { needsConfirmation: !data.session } };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return notConfigured;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function resendConfirmation(email: string): Promise<AuthResult> {
  if (!supabase) return notConfigured;
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: AUTH_LINKS.confirm() } });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return notConfigured;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_LINKS.reset() });
  // Don't reveal whether an account exists: only surface rate-limit/network errors.
  if (error && (error.code?.startsWith('over_') || error.status === 0)) return fail(error);
  return { ok: true, data: undefined };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (!supabase) return notConfigured;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  // Local scope: signs out this device even if offline.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

export async function deleteAccount(): Promise<AuthResult> {
  if (!supabase) return notConfigured;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) return { ok: false, error: 'Couldn’t delete your account. Check your connection and try again.' };
  await signOut();
  return { ok: true, data: undefined };
}

export type DeepLinkOutcome = { kind: 'confirmed' } | { kind: 'reset' } | { kind: 'error'; message: string } | { kind: 'ignored' };

/** Parse a thaw:// or exp:// auth redirect and establish the session if it carries a code. */
export async function handleAuthDeepLink(url: string): Promise<DeepLinkOutcome> {
  if (!supabase) return { kind: 'ignored' };
  const parsed = Linking.parse(url);
  const path = (parsed.path ?? '').replace(/^\/+/, '');
  if (!path.startsWith('auth/')) return { kind: 'ignored' };

  // Errors can arrive in the query or (implicit flow) the fragment.
  const fragment = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
  const q = (k: string): string | undefined => {
    const v = parsed.queryParams?.[k];
    return (typeof v === 'string' ? v : undefined) ?? fragment?.get(k) ?? undefined;
  };
  const errDesc = q('error_description') ?? q('error');
  if (errDesc) return { kind: 'error', message: friendlyAuthError({ message: errDesc, code: q('error_code') }) };

  const code = q('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { kind: 'error', message: friendlyAuthError(error) };
  }
  if (path.startsWith('auth/reset')) return code ? { kind: 'reset' } : { kind: 'error', message: 'This reset link is incomplete. Request a new one.' };
  return { kind: 'confirmed' };
}
