import React from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/useTheme';
import { tabBarOffset } from '../navigation/TabBar';
import { IconButton } from './Button';

/** Screen container and header. Tab screens leave room for the bar. */
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
  footer,
  center,
  glassBack,
  bottomInset = true,
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
  footer?: React.ReactNode;
  center?: boolean;
  glassBack?: boolean;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { colors, spacing, type } = useTheme();
  const bottomPad = footer ? spacing.lg : tab ? tabBarOffset(insets.bottom) : spacing.xl + insets.bottom;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.screen }]}>
        {back ? <IconButton icon="chevron-left" label="Go back" glass={glassBack} onPress={() => nav.goBack()} /> : null}
        <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start' }}>
          <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={type.small} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ?? (back ? <View style={{ width: 44 }} /> : null)}
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingHorizontal: spacing.screen, paddingBottom: bottomPad + insets.bottom, gap: spacing.md }, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: tab ? tabBarOffset(insets.bottom) : bottomInset ? insets.bottom : 0 }}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.bg, borderColor: colors.border }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
