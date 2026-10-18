import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { TabBar } from './TabBar';
import { ExploreScreen } from '../screens/ExploreScreen';
import { PartyScreen } from '../screens/PartyScreen';
import { CollectionScreen } from '../screens/CollectionScreen';
import { YouScreen } from '../screens/ProfileScreen';
import { QuestDetailScreen } from '../screens/QuestDetailScreen';
import { ActiveQuestScreen } from '../screens/ActiveQuestScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { RewardScreen } from '../screens/RewardScreen';
import { RegionPickerScreen } from '../screens/RegionPickerScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayByTextScreen } from '../screens/PlayByTextScreen';
import { EditAvatarScreen } from '../screens/EditAvatarScreen';
import { PartyChatScreen } from '../screens/PartyChatScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { IntroScreen } from '../screens/IntroScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { useGameStore } from '../store/useGameStore';
import { isSupabaseConfigured } from '../config/env';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, freezeOnBlur: true }}
    >
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Party" component={PartyScreen} />
      <Tab.Screen name="Collection" component={CollectionScreen} />
      <Tab.Screen name="You" component={YouScreen} />
    </Tab.Navigator>
  );
}

function Splash({ text }: { text: string }) {
  const { colors, type, spacing } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl }]}>
      <Critter hue={28} size={88} mood="sleepy" />
      <ActivityIndicator color={colors.primary} />
      <Text style={type.small}>{text}</Text>
    </View>
  );
}

function NotConfigured() {
  const { colors, type, spacing } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl }]}>
      <Critter hue={28} size={88} mood="sleepy" />
      <Text style={[type.heading, { textAlign: 'center' }]}>Thaw isn’t connected</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>
        This build is missing its Supabase settings. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env and restart with npx expo start -c.
      </Text>
    </View>
  );
}

export function RootNavigator() {
  const { colors } = useTheme();
  const authReady = useGameStore((s) => s.authReady);
  const signedIn = useGameStore((s) => !!s.account);
  const onboarding = useGameStore((s) => s.onboarding);

  if (!isSupabaseConfigured()) return <NotConfigured />;
  if (!authReady) return <Splash text="Thawing…" />;
  if (signedIn && onboarding === 'unknown') return <Splash text="Loading your adventure…" />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      {!signedIn ? (
        <>
          <Stack.Screen name="Intro" component={IntroScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
        </>
      ) : onboarding === 'needed' ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ animation: 'fade' }} />
          <Stack.Screen name="QuestDetail" component={QuestDetailScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ActiveQuest" component={ActiveQuestScreen} />
          <Stack.Screen name="Verify" component={VerifyScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Reward" component={RewardScreen} options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="RegionPicker" component={RegionPickerScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="PlayByText" component={PlayByTextScreen} />
          <Stack.Screen name="EditAvatar" component={EditAvatarScreen} />
          <Stack.Screen name="PartyChat" component={PartyChatScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
