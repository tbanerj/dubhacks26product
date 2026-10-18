import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RootScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { useTheme } from '../theme/useTheme';
import { buildLeaderboard, type BoardKind, type BoardRow } from '../game/leaderboard';
import { fetchGlobalLeaderboard, type GlobalRow } from '../services/cloud';
import { formatNumber } from '../utils/format';
import { t } from '../i18n/strings';

type Range = 'today' | 'all';
type Metric = 'xp' | 'quests' | 'places';

export function LeaderboardScreen(_props: RootScreenProps<'Leaderboard'>) {
  const { colors, radii } = useTheme();
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);
  const account = useGameStore((s) => s.account);
  const [range, setRange] = useState<Range>('today');
  const [metric, setMetric] = useState<Metric>('xp');
  const [global, setGlobal] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; rows: BoardRow[] }>({ status: 'idle', rows: [] });

  const kind: BoardKind = metric === 'quests' ? 'quests' : metric === 'places' ? 'landmarks' : range === 'today' ? 'daily' : 'allTime';
  const isGlobal = !!account;
  const localRows = useMemo(() => buildLeaderboard(kind, player, progress), [kind, player, progress]);
  const unit = metric === 'quests' ? 'quest' : metric === 'places' ? 'place' : 'XP';

  const load = useCallback(async () => {
    if (!account) return;
    setGlobal((g) => ({ ...g, status: 'loading' }));
    const res = await fetchGlobalLeaderboard(kind, 50);
    if (!res.ok) {
      setGlobal({ status: 'error', rows: [] });
      return;
    }
    setGlobal({
      status: 'ready',
      rows: res.data.rows.map((row) => toBoardRow(row)),
    });
  }, [account, kind]);

  useEffect(() => {
    if (!isGlobal) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [isGlobal, load]);

  const rows = isGlobal ? global.rows : localRows;

  return (
    <ScreenShell title={t('ranks.title')} subtitle={isGlobal ? 'Global rankings' : 'Demo rankings'} back>
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="tablist">
        <Seg label="Today" on={range === 'today'} disabled={metric !== 'xp'} onPress={() => setRange('today')} />
        <Seg label="All time" on={range === 'all'} disabled={metric !== 'xp'} onPress={() => setRange('all')} />
      </View>
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill }]} accessibilityRole="tablist">
        <Seg label="XP" on={metric === 'xp'} onPress={() => setMetric('xp')} />
        <Seg label="Quests" on={metric === 'quests'} onPress={() => setMetric('quests')} />
        <Seg label="Places" on={metric === 'places'} onPress={() => setMetric('places')} />
      </View>

      {isGlobal && global.status === 'loading' && rows.length === 0 ? (
        <ActivityIndicator color={colors.primary} />
      ) : isGlobal && global.status === 'error' ? (
        <EmptyState icon="cloud-off-outline" title="Couldn’t load the global board." action={<Button label="Try again" onPress={() => void load()} />} />
      ) : rows.length === 0 ? (
        <EmptyState icon="trophy-outline" title="No rankings yet." />
      ) : (
        <View style={{ gap: 4 }}>
          {rows.map((row) => (
            <Row key={row.id} row={row} unit={unit} />
          ))}
        </View>
      )}
      <Notice icon={isGlobal ? 'earth' : 'flask-outline'} tone={isGlobal ? 'info' : 'demo'} text={isGlobal ? 'Scores are calculated on the server. Daily resets at your local midnight.' : t('ranks.local')} />
    </ScreenShell>
  );
}

function toBoardRow(row: GlobalRow): BoardRow {
  return { id: `${row.rank}-${row.displayName}`, name: row.displayName, avatarHue: row.avatarHue, value: row.value, rank: row.rank, isSelf: row.isSelf, isDemo: false };
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
