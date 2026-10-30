import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Card, Heading, Screen } from '@/components/screen';
import { palette } from '@/constants/goodgrid';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 620;
  return (
    <Screen>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <Heading eyebrow="A PUZZLE FOR YOUR PACE" title="How would you like to play?" description="Take on today’s shared challenge or enjoy a puzzle at your own pace." />
        <View style={styles.choices}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/ranked')} style={[styles.choiceCard, compact && styles.choiceCardCompact]}>
              <View style={styles.choiceIcon}><Text style={styles.iconText}>✳</Text></View>
              <Text style={styles.choiceTitle}>Ranked</Text>
              <Text style={styles.choiceCopy}>Daily challenges and leaderboard</Text>
              <Text style={styles.arrow}>→</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/casual')} style={[styles.choiceCard, compact && styles.choiceCardCompact]}>
              <View style={[styles.choiceIcon, styles.casualIcon]}><Text style={styles.iconText}>◷</Text></View>
              <Text style={styles.choiceTitle}>Casual</Text>
              <Text style={styles.choiceCopy}>Choose a size and difficulty</Text>
              <Text style={styles.arrow}>→</Text>
          </Pressable>
        </View>
        <Card style={styles.noteCard}>
          <Text style={styles.noteTitle}>A little time for yourself</Text>
          <Text style={styles.noteCopy}>GoodGrid is a calm place to focus, one square at a time.</Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 40 },
  heroCompact: { paddingTop: 16 },
  choices: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 20, minWidth: 0, alignSelf: 'stretch' },
  choiceCard: { flexGrow: 1, flexBasis: 300, minHeight: 210, backgroundColor: palette.paper, borderWidth: 1.5, borderColor: '#ddd8ca', borderRadius: 22, padding: 26, justifyContent: 'center', shadowColor: '#414837', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  choiceCardCompact: { width: '100%', flexBasis: '100%', minHeight: 156, padding: 21 },
  choiceIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sageSoft, marginBottom: 18 },
  casualIcon: { backgroundColor: '#f2ede0' },
  iconText: { color: palette.sageDark, fontSize: 22, fontWeight: '600' },
  choiceTitle: { color: palette.ink, fontSize: 24, fontWeight: '700' },
  choiceCopy: { flexShrink: 1, marginTop: 8, color: palette.muted, fontSize: 15, lineHeight: 22 },
  arrow: { position: 'absolute', right: 28, bottom: 26, color: palette.sageDark, fontSize: 23 },
  noteCard: { backgroundColor: '#f1efe7', borderColor: 'transparent' },
  noteTitle: { color: palette.ink, fontWeight: '700', fontSize: 16 },
  noteCopy: { color: palette.muted, marginTop: 5, fontSize: 14 },
});
