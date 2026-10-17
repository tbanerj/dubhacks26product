import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TabScreenProps } from '../navigation/types';
import { useGameStore } from '../store/useGameStore';
import { ScreenShell } from '../components/ScreenShell';
import { Card, Notice } from '../components/Paper';
import { Critter } from '../components/Critter';
import { colors, fonts, radii, spacing, type } from '../theme/tokens';
import { buildLeaderboard, type BoardKind, type BoardRow } from '../game/leaderboard';
import { formatNumber } from '../utils/format';
import { t, type StringKey } from '../i18n/strings';

const KINDS: { kind: BoardKind; label: StringKey; unit: string }[] = [
  { kind: 'daily', label: 'ranks.daily', unit: 'XP' },
  { kind: 'allTime', label: 'ranks.allTime', unit: 'XP' },
  { kind: 'quests', label: 'ranks.quests', unit: 'quests' },
  { kind: 'landmarks', label: 'ranks.landmarks', unit: 'places' },
];

const PODIUM = [colors.butter, colors.skySoft, colors.sunsetSoft];

export function LeaderboardScreen(_props: TabScreenProps<'Leaderboard'>) {
  const player = useGameStore((s) => s.player);
  const progress = useGameStore((s) => s.progress);
  const [kind, setKind] = useState<BoardKind>('daily');
  const rows = useMemo(() => buildLeaderboard(kind, player, progress), [kind, player, progress]);
  const unit = KINDS.find((k) => k.kind === kind)?.unit ?? '';
  const me = rows.find((r) => r.isSelf);
  const top = rows.slice(0, 3);

  return (
    <ScreenShell title={t('ranks.title')} subtitle={me ? `You’re #${me.rank} of ${rows.length}` : undefined} tab>
      <View style={styles.tabs} accessibilityRole="tablist">
        {KINDS.map((k) => (
          <Pressable key={k.kind} onPress={() => setKind(k.kind)} style={[styles.tab, kind === k.kind && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === k.kind }}>
            <Text style={[styles.tabText, kind === k.kind && { color: colors.ink }]}>{t(k.label)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.podium}>
        {[top[1], top[0], top[2]].map((r, i) =>
          r ? (
            <View key={r.id} style={[styles.podiumCol, { marginTop: i === 1 ? 0 : 26 }]}>
              <Critter hue={r.avatarHue} size={i === 1 ? 64 : 52} mood={r.rank === 1 ? 'wow' : 'happy'} />
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
          <Row key={r.id} row={r} unit={unit} />
        ))}
      </Card>

      <Notice icon="information-outline" text={t('ranks.local')} />
    </ScreenShell>
  );
}

function Row({ row, unit }: { row: BoardRow; unit: string }) {
  return (
    <View style={[styles.row, row.isSelf && styles.rowSelf]} accessible accessibilityLabel={`Rank ${row.rank}, ${row.isSelf ? 'you' : row.name}${row.isDemo ? ', demo profile' : ''}, ${row.value} ${unit}`}>
      <Text style={styles.rank}>{row.rank}</Text>
      <Critter hue={row.avatarHue} size={36} />
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
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumBlock: { alignSelf: 'stretch', borderWidth: 2, borderBottomWidth: 4, borderColor: colors.ink, borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md, alignItems: 'center', paddingTop: 4 },
  podiumRank: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink },
  podiumName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, maxWidth: '90%' },
  podiumVal: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, minHeight: 52 },
  rowSelf: { backgroundColor: colors.grassSoft, borderWidth: 2, borderColor: colors.forest },
  rank: { width: 24, fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  value: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
