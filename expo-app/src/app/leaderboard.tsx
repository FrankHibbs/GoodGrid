import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackLink, Card, Heading, Screen } from '@/components/screen';
import { palette, sizes, type BoxSize } from '@/constants/goodgrid';

export default function LeaderboardScreen() {
  const [selectedSize, setSelectedSize] = useState<BoxSize>(3);
  const [period, setPeriod] = useState<'daily' | 'all-time'>('daily');
  return (
    <Screen>
      <BackLink href="/ranked" label="Ranked" />
      <Heading eyebrow="RANKED RESULTS" title="Leaderboard" description="Fastest verified completion times rank first." />
      <View style={styles.filters}>
        {(['daily', 'all-time'] as const).map(value => (
          <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.filter, period === value && styles.filterSelected]}>
            <Text style={[styles.filterText, period === value && styles.filterTextSelected]}>{value === 'daily' ? 'Today’s challenge' : 'All-time best'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filters}>
        {sizes.map(size => (
          <Pressable key={size} onPress={() => setSelectedSize(size)} style={[styles.filter, selectedSize === size && styles.filterSelected]}>
            <Text style={[styles.filterText, selectedSize === size && styles.filterTextSelected]}>{size}×{size}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={styles.empty}>
        <Text style={styles.emptyIcon}>✳</Text>
        <Text style={styles.emptyTitle}>Leaderboard connection comes next</Text>
        <Text style={styles.emptyCopy}>This screen is ready for daily and all-time results. Supabase sign-in and verified score loading have not been connected to the Expo app yet.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  filter: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.paper },
  filterSelected: { backgroundColor: palette.sageSoft, borderColor: '#a7b39c' },
  filterText: { color: palette.muted, fontWeight: '600' },
  filterTextSelected: { color: palette.sageDark },
  empty: { minHeight: 210, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyIcon: { color: palette.sage, fontSize: 24, marginBottom: 10 },
  emptyTitle: { color: palette.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { maxWidth: 560, color: palette.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10 },
});
