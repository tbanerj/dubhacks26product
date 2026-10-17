import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, type } from '../theme/tokens';

/** Paper-background screen with a playful header. `tab` screens leave room for the tab bar. */
export function ScreenShell({
  title,
  subtitle,
  back,
  tab,
  right,
  children,
  scroll = true,
  contentStyle,
  keyboardShouldPersistTaps,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  tab?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      {back && (
        <Pressable onPress={() => nav.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  const bottomPad = (tab ? 110 : spacing.xl) + insets.bottom;
  return (
    <View style={styles.root}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: spacing.lg, paddingBottom: bottomPad, gap: spacing.lg }, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingBottom: tab ? 100 + insets.bottom : insets.bottom }]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft paper-cut shapes in the background give screens some warmth.
  blobA: { position: 'absolute', top: -60, right: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.butterSoft },
  blobB: { position: 'absolute', bottom: 80, left: -90, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.grassSoft, opacity: 0.6 },
});
