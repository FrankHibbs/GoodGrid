import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BackLink, Card, Heading, Screen } from '@/components/screen';
import { palette, sizes } from '@/constants/goodgrid';

export default function RankedScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 620;
  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading eyebrow="SAME CHALLENGE FOR EVERYONE" title="Ranked daily puzzles" description="All ranked challenges use Medium difficulty." />
      <Pressable accessibilityRole="button" onPress={() => router.push('/leaderboard')} style={styles.leaderboard}>
          <Text style={styles.cardTitle}>Leaderboard</Text>
          <Text style={styles.cardCopy}>View daily and all-time rankings</Text>
          <Text style={styles.arrow}>→</Text>
      </Pressable>
      <View style={[styles.challenges, compact && styles.challengesCompact]}>
        {sizes.map(size => (
          <Pressable key={size} accessibilityRole="button" onPress={() => router.push({ pathname: '/puzzle', params: { mode: 'ranked', size: String(size), difficulty: 'medium' } })} style={[styles.challenge, compact && styles.challengeCompact]}>
              <Text style={styles.size}>{size}×{size}</Text>
              <Text style={styles.cardTitle}>Daily challenge</Text>
              <Text style={styles.cardCopy}>{size * size}×{size * size} board · Medium</Text>
              <Text style={styles.arrow}>→</Text>
          </Pressable>
        ))}
      </View>
      <Card style={styles.notice}>
        <Text style={styles.noticeTitle}>Ranked account features are next</Text>
        <Text style={styles.cardCopy}>Daily puzzle verification, sign-in, and saved leaderboard results still need to be connected in this React version.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  leaderboard: { width: '100%', minWidth: 0, position: 'relative', backgroundColor: palette.paper, borderColor: palette.border, borderWidth: 1, borderRadius: 18, padding: 24, marginBottom: 18 },
  challenges: { width: '100%', minWidth: 0, alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  challengesCompact: { flexDirection: 'column' },
  challenge: { minWidth: 0, position: 'relative', flexGrow: 1, flexBasis: 260, minHeight: 185, justifyContent: 'center', padding: 24, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.border, borderRadius: 20 },
  challengeCompact: { width: '100%', flexBasis: 'auto', minHeight: 148, padding: 20 },
  size: { color: palette.sageDark, fontSize: 28, fontWeight: '700', marginBottom: 16 },
  cardTitle: { color: palette.sageDark, fontSize: 18, fontWeight: '700' },
  cardCopy: { color: palette.muted, fontSize: 14, marginTop: 6, lineHeight: 21 },
  arrow: { position: 'absolute', right: 22, bottom: 20, color: palette.sageDark, fontSize: 20 },
  notice: { marginTop: 18, backgroundColor: '#f1efe7', borderColor: 'transparent' },
  noticeTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
});
