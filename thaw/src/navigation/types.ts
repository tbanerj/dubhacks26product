import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type TabParamList = {
  Explore: { focusLandmarkId?: string } | undefined;
  Party: undefined;
  Collection: undefined;
  You: undefined;
};

export type RootStackParamList = {
  Intro: undefined;
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  QuestDetail: { questId: string };
  ActiveQuest: undefined;
  Verify: undefined;
  Reward: undefined;
  RegionPicker: undefined;
  Leaderboard: undefined;
  Settings: undefined;
  PlayByText: undefined;
  EditAvatar: undefined;
  PartyChat: undefined;
  Auth: { mode?: 'signIn' | 'signUp' | 'checkEmail' | 'forgot' | 'newPassword'; email?: string; message?: string } | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
