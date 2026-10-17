import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useGameStore } from './src/store/useGameStore';
import { useTheme } from './src/theme/useTheme';
import { setLanguage } from './src/i18n/strings';
import { deviceLocale } from './src/utils/format';
import { navigationRef } from './src/navigation/navigationRef';
import { useAuthBootstrap } from './src/hooks/useAuthBootstrap';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
setLanguage(deviceLocale());

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

function AppShell() {
  const hydrated = useHydrated();
  const { colors, scheme, type } = useTheme();
  useAuthBootstrap(hydrated);

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={type.body}>Thawing…</Text>
      </View>
    );
  }

  const navTheme: Theme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      primary: colors.primary,
      border: colors.border,
      notification: colors.primary,
    },
  };

  return (
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
