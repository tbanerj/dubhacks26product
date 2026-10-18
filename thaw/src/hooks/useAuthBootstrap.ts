import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { useGameStore } from '../store/useGameStore';
import { handleAuthDeepLink } from '../services/auth';
import { navigationRef } from '../navigation/navigationRef';

function openAuth(params: { mode: 'signIn' | 'newPassword'; message?: string }) {
  const go = () => navigationRef.navigate('Auth', params);
  if (navigationRef.isReady()) go();
  else setTimeout(go, 600);
}

/**
 * Starts the Supabase session listener, handles email-verification / password-reset
 * deep links, and re-syncs progress + party state whenever the app returns to the foreground.
 */
export function useAuthBootstrap(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const stopAuth = useGameStore.getState().initAuth();

    const onUrl = async (url: string | null) => {
      if (!url) return;
      const outcome = await handleAuthDeepLink(url);
      if (outcome.kind === 'reset') openAuth({ mode: 'newPassword' });
      else if (outcome.kind === 'error') openAuth({ mode: 'signIn', message: outcome.message });
      // 'confirmed': the session listener signs the player in automatically.
    };
    void Linking.getInitialURL().then(onUrl);
    const linkSub = Linking.addEventListener('url', ({ url }) => void onUrl(url));

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const s = useGameStore.getState();
      if (!s.account) return;
      void s.pullCloud();
      s.connectParty(); // refresh party state after being backgrounded
    });

    return () => {
      stopAuth();
      linkSub.remove();
      appSub.remove();
    };
  }, [enabled]);
}
