/**
 * The single Supabase client. `null` when Supabase isn't configured, in which case the
 * app runs in guest/local mode exactly as before.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/env';
import type { Database } from './database.types';

export type ThawSupabase = SupabaseClient<Database>;

function create(): ThawSupabase | null {
  const { url, publishableKey } = config.supabase;
  if (!url || !publishableKey) return null;
  return createClient<Database>(url, publishableKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Native apps receive auth redirects via deep links, not the URL bar.
      detectSessionInUrl: false,
      // PKCE: email links carry a one-time code, exchanged on this device.
      flowType: 'pkce',
    },
  });
}

export const supabase: ThawSupabase | null = create();

// Supabase recommends pausing token refresh while a native app is backgrounded.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
