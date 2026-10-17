import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useGameStore } from './src/store/useGameStore';
import { colors } from './src/theme/tokens';
import { setLanguage } from './src/i18n/strings';
import { deviceLocale } from './src/utils/format';
import { navigationRef } from './src/navigation/navigationRef';
import { useAuthBootstrap } from './src/hooks/useAuthBootstrap';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
setLanguage(deviceLocale());

const navTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.paper, card: colors.paper, text: colors.ink, primary: colors.forest, border: colors.ink },
};

/** Wait for persisted progress, with a timeout so a storage failure can't block launch. */
function useHydrated(): boolean {
  const hydrated = useGameStore((s) => s.hydrated);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) useGameStore.getState().markHydrated();
    const unsub = useGameStore.persist.onFinishHydration(() => useGameStore.getState().markHydrated());
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);
  return hydrated || timedOut;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
  });
  const hydrated = useHydrated();
  // If fonts fail to load (offline first run), continue with system fonts.
  const ready = (fontsLoaded || !!fontError) && hydrated;
  useAuthBootstrap(hydrated);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} size="large" />
        <Text style={styles.loadingText}>Thawing…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, gap: 12 },
  loadingText: { color: colors.ink, fontSize: 16 },
});
