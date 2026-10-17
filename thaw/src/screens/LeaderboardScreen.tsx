import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState, Notice } from '../components/Paper';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { buildLeaderboard, type BoardKind, type BoardRow } from '../game/leaderboard';
import { formatNumber } from '../utils/format';
import { t } from '../i18n/strings';

type Range = 'today' | 'all';
type Metric = 'xp' | 'quests' | 'places';

export function LeaderboardScreen(_props: RootScreenProps<'Leaderboard'>) {
  const { colors, radii } = useTheme();
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);
  const [range, setRange] = useState<Range>('today');
  const [metric, setMetric] = useState<Metric>('xp');

  const kind: BoardKind = metric === 'quests' ? 'quests' : metric === 'places' ? 'landmarks' : range === 'today' ? 'daily' : 'allTime';
  const rows = useMemo(() => buildLeaderboard(kind, player, progress), [kind, player, progress]);
  const unit = metric === 'quests' ? 'quest' : metric === 'places' ? 'place' : 'XP';

  return (
    <ScreenShell title={t('ranks.title')} subtitle="Sample rankings · Demo" back>
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="tablist">
        <Seg label="Today" on={range === 'today'} disabled={metric !== 'xp'} onPress={() => setRange('today')} />
        <Seg label="All time" on={range === 'all'} disabled={metric !== 'xp'} onPress={() => setRange('all')} />
      </View>
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="tablist">
        <Seg label="XP" on={metric === 'xp'} onPress={() => setMetric('xp')} />
        <Seg label="Quests" on={metric === 'quests'} onPress={() => setMetric('quests')} />
        <Seg label="Places" on={metric === 'places'} onPress={() => setMetric('places')} />
      </View>

      {rows.length === 0 ? (
        <EmptyState icon="trophy-outline" title="No rankings yet." />
      ) : (
        <View style={{ gap: 4 }}>
          {rows.map((row) => (
            <Row key={row.id} row={row} unit={unit} />
          ))}
        </View>
      )}
      <Notice icon="flask-outline" tone="demo" text={t('ranks.local')} />
    </ScreenShell>
  );
}

function Seg({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors, type, radii } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: on, disabled: !!disabled }}
      style={[styles.seg, { borderRadius: radii.pill, backgroundColor: on && !disabled ? colors.primary : 'transparent', opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[type.bodyStrong, { color: on && !disabled ? colors.onPrimary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function Row({ row, unit }: { row: BoardRow; unit: string }) {
  const { colors, type, radii } = useTheme();
  return (
    <View style={[styles.row, { borderRadius: radii.lg, backgroundColor: row.isSelf ? colors.sageSoft : 'transparent' }]} accessible accessibilityLabel={`Rank ${row.rank}, ${row.isSelf ? 'you' : row.name}${row.isDemo ? ', demo profile' : ''}, ${row.value} ${unit === 'XP' || row.value === 1 ? unit : `${unit}s`}`}>
      <Text style={[type.bodyStrong, { width: 28, textAlign: 'center' }]}>{row.rank}</Text>
      <Critter hue={row.avatarHue} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {row.isSelf ? `${row.name} (you)` : row.name}
        </Text>
        {row.isDemo ? <Text style={type.tiny}>Demo explorer</Text> : null}
      </View>
      <Text style={type.bodyStrong}>
        {formatNumber(row.value)} {unit === 'XP' || row.value === 1 ? unit : `${unit}s`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4 },
  seg: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, minHeight: 56 },
});
