import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { TabBar } from './TabBar';
import { ExploreScreen } from '../screens/ExploreScreen';
import { PartyScreen } from '../screens/PartyScreen';
import { CollectionScreen } from '../screens/CollectionScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QuestDetailScreen } from '../screens/QuestDetailScreen';
import { ActiveQuestScreen } from '../screens/ActiveQuestScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { RewardScreen } from '../screens/RewardScreen';
import { RegionPickerScreen } from '../screens/RegionPickerScreen';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}>
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Party" component={PartyScreen} />
      <Tab.Screen name="Collection" component={CollectionScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="QuestDetail" component={QuestDetailScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ActiveQuest" component={ActiveQuestScreen} />
      <Stack.Screen name="Verify" component={VerifyScreen} />
      <Stack.Screen name="Reward" component={RewardScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="RegionPicker" component={RegionPickerScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
