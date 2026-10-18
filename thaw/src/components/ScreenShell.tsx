import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewProps } from 'react-native';
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
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { colors, spacing, type } = useTheme();
  const gutter = Math.max(spacing.screen, insets.left, insets.right);
  const wide = width >= 700;
  const column = [styles.column, wide ? styles.columnWide : null];
  const bottomPad = footer ? spacing.lg : tab ? tabBarOffset(insets.bottom) : spacing.xl + insets.bottom;
  const backTop = insets.top + 4;
  const sideLead = back && center ? gutter + 44 + 8 : gutter;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          column,
          {
            paddingTop: back ? (center ? backTop : backTop + 44 + 8) : insets.top + spacing.xs,
            minHeight: back && center ? backTop + 44 : undefined,
            paddingLeft: sideLead,
            paddingRight: back && center ? gutter + 44 + 8 : gutter,
          },
        ]}
      >
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
        {right}
      </View>
      {back ? (
        <View pointerEvents="box-none" style={[styles.backFloat, { top: backTop, left: Math.max(insets.left, 16) }]}>
          <IconButton
            icon="chevron-left"
            label="Go back"
            glass
            glassVariant="regular"
            onPress={() => {
              if (nav.canGoBack()) nav.goBack();
            }}
          />
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingHorizontal: gutter, paddingBottom: bottomPad + insets.bottom, alignItems: wide ? 'center' : undefined }, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        >
          <View style={[column, { gap: spacing.md }]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingBottom: tab ? tabBarOffset(insets.bottom) : bottomInset ? insets.bottom : 0 }, column]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, column, { paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: gutter, backgroundColor: colors.bg, borderColor: colors.border }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, width: '100%' },
  column: { width: '100%' },
  columnWide: { maxWidth: 640, alignSelf: 'center' },
  backFloat: { position: 'absolute', zIndex: 30, elevation: 12 },
  footer: { paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, width: '100%' },
});
