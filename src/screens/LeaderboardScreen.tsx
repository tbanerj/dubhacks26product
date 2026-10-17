import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Chip, Notice } from '../components/Paper';
import { Button } from '../components/Button';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { buildLeaderboard, type BoardKind } from '../game/leaderboard';
import { fetchGlobalLeaderboard } from '../services/cloud';
import { formatNumber } from '../utils/format';
import { t, type StringKey } from '../i18n/strings';

const KINDS: { kind: BoardKind; label: StringKey; unit: string }[] = [
  { kind: 'daily', label: 'ranks.daily', unit: 'XP' },
  { kind: 'allTime', label: 'ranks.allTime', unit: 'XP' },
  { kind: 'quests', label: 'ranks.quests', unit: 'quests' },
  { kind: 'landmarks', label: 'ranks.landmarks', unit: 'places' },
];

const PODIUM = [colors.butter, colors.skySoft, colors.sunsetSoft];

interface Row {
  key: string;
  rank: number;
  name: string;
  hue: number;
  value: number;
  isSelf: boolean;
  isDemo: boolean;
}

type GlobalState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; rows: Row[]; me: { rank: number; value: number; players: number } | null }
  | { status: 'error'; message: string };

export function LeaderboardScreen(_props: TabScreenProps<'Leaderboard'>) {
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);
  const account = useGameStore((s) => s.account);
  const demoMode = useGameStore((s) => s.settings.demoMode);
  const [kind, setKind] = useState<BoardKind>('daily');
  const [global, setGlobal] = useState<GlobalState>({ status: 'idle' });
  const isGlobal = !!account && !demoMode;

  const load = useCallback(async () => {
    if (!account || demoMode) return;
    setGlobal({ status: 'loading' });
    const res = await fetchGlobalLeaderboard(kind, 50);
    if (!res.ok) {
      setGlobal({ status: 'error', message: res.error });
      return;
    }
    setGlobal({
      status: 'ready',
      me: res.data.me,
      rows: res.data.rows.map((r, i) => ({ key: `${r.rank}-${i}`, rank: r.rank, name: r.displayName, hue: r.avatarHue, value: r.value, isSelf: r.isSelf, isDemo: false })),
    });
  }, [account, kind, demoMode]);

  // Refresh when the tab gains focus, the board changes, or a sync finishes.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(
    () =>
      useGameStore.subscribe((st, prev) => {
        if (st.syncState === 'synced' && prev.syncState !== 'synced') void load();
      }),
    [load],
  );

  const localRows: Row[] = useMemo(
    () => buildLeaderboard(kind, player, progress).map((r) => ({ key: r.id, rank: r.rank, name: r.name, hue: r.avatarHue, value: r.value, isSelf: r.isSelf, isDemo: r.isDemo })),
    [kind, player, progress],
  );

  const rows = isGlobal ? (global.status === 'ready' ? global.rows : []) : localRows;
  const unit = KINDS.find((k) => k.kind === kind)?.unit ?? '';
  const meLocal = localRows.find((r) => r.isSelf);
  const meGlobal = global.status === 'ready' ? global.me : null;
  const subtitle = isGlobal
    ? meGlobal && meGlobal.value > 0
      ? `You’re #${meGlobal.rank} of ${formatNumber(meGlobal.players)} worldwide`
      : 'Complete a quest to get on the board'
    : meLocal
      ? `You’re #${meLocal.rank} of ${localRows.length}`
      : undefined;
  const top = rows.slice(0, 3);
  const selfInList = rows.some((r) => r.isSelf);

  return (
    <ScreenShell
      title={t('ranks.title')}
      subtitle={subtitle}
      tab
      right={<Chip label={isGlobal ? 'Global' : 'Demo'} icon={isGlobal ? 'earth' : 'flask-outline'} bg={isGlobal ? colors.grassSoft : colors.butterSoft} />}
    >
      <View style={styles.tabs} accessibilityRole="tablist">
        {KINDS.map((k) => (
          <Pressable key={k.kind} onPress={() => setKind(k.kind)} style={[styles.tab, kind === k.kind && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === k.kind }}>
            <Text style={[styles.tabText, kind === k.kind && { color: colors.ink }]}>{t(k.label)}</Text>
          </Pressable>
        ))}
      </View>

      {isGlobal && global.status === 'loading' && rows.length === 0 ? (
        <Card tint={colors.white} style={styles.center}>
          <ActivityIndicator color={colors.forest} />
          <Text style={type.small}>Fetching worldwide rankings…</Text>
        </Card>
      ) : isGlobal && global.status === 'error' ? (
        <Card tint={colors.white} style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={28} color={colors.inkSoft} />
          <Text style={type.body}>{global.message}</Text>
          <Button label={t('common.retry')} icon="refresh" compact onPress={() => void load()} />
        </Card>
      ) : rows.length === 0 ? (
        <Card tint={colors.white} style={styles.center}>
          <Critter hue={player.avatarHue} size={56} mood="sleepy" />
          <Text style={type.body}>{kind === 'daily' ? 'Nobody has scored today yet – be the first!' : 'No explorers on this board yet.'}</Text>
        </Card>
      ) : (
        <>
          <View style={styles.podium}>
            {[top[1], top[0], top[2]].map((r, i) =>
              r ? (
                <View key={r.key} style={[styles.podiumCol, { marginTop: i === 1 ? 0 : 26 }]}>
                  <Critter hue={r.hue} size={i === 1 ? 64 : 52} mood={r.rank === 1 ? 'wow' : 'happy'} />
                  <View style={[styles.podiumBlock, { backgroundColor: PODIUM[r.rank - 1] ?? colors.paperDeep, height: i === 1 ? 92 : 66 }]}>
                    <Text style={styles.podiumRank}>{r.rank}</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {r.isSelf ? 'You' : r.name}
                    </Text>
                    <Text style={styles.podiumVal}>{formatNumber(r.value)}</Text>
                  </View>
                </View>
              ) : (
                <View key={`empty-${i}`} style={styles.podiumCol} />
              ),
            )}
          </View>

          <Card tint={colors.white} style={{ padding: spacing.sm, gap: 4 }}>
            {rows.map((r) => (
              <RowView key={r.key} row={r} unit={unit} />
            ))}
            {isGlobal && !selfInList && meGlobal && meGlobal.value > 0 && (
              <>
                <Text style={[type.small, { textAlign: 'center' }]}>⋯</Text>
                <RowView row={{ key: 'me', rank: meGlobal.rank, name: player.name, hue: player.avatarHue, value: meGlobal.value, isSelf: true, isDemo: false }} unit={unit} />
              </>
            )}
          </Card>
        </>
      )}

      {isGlobal ? (
        <Notice icon="earth" text="Global rankings from every Thaw explorer. Scores are calculated on the server. Daily resets at your local midnight." />
      ) : (
        <Notice tone="demo" icon="flask-outline" text="Demo mode: your sandbox score vs. demo explorers on this device. Turn Demo mode off in You → Settings to see the real global leaderboard." />
      )}
    </ScreenShell>
  );
}

function RowView({ row, unit }: { row: Row; unit: string }) {
  return (
    <View style={[styles.row, row.isSelf && styles.rowSelf]} accessible accessibilityLabel={`Rank ${row.rank}, ${row.isSelf ? 'you' : row.name}${row.isDemo ? ', demo profile' : ''}, ${row.value} ${unit}`}>
      <Text style={styles.rank}>{row.rank}</Text>
      <Critter hue={row.hue} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {row.isSelf ? `${row.name} (you)` : row.name}
        </Text>
        {row.isDemo && <Text style={type.small}>Demo explorer</Text>}
      </View>
      {row.rank === 1 && <MaterialCommunityIcons name="crown" size={18} color={colors.sunsetDeep} />}
      <Text style={styles.value}>
        {formatNumber(row.value)} <Text style={type.small}>{unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: colors.paperDeep, padding: 4, borderRadius: radii.lg, borderWidth: 2, borderColor: colors.ink },
  tab: { flex: 1, minHeight: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.butter, borderWidth: 2, borderColor: colors.ink },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumBlock: { alignSelf: 'stretch', borderWidth: 2, borderBottomWidth: 4, borderColor: colors.ink, borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md, alignItems: 'center', paddingTop: 4 },
  podiumRank: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink },
  podiumName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, maxWidth: '90%' },
  podiumVal: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, minHeight: 52 },
  rowSelf: { backgroundColor: colors.grassSoft, borderWidth: 2, borderColor: colors.forest },
  rank: { width: 32, fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  value: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
