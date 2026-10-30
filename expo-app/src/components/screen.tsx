import type { PropsWithChildren } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/constants/goodgrid';

export function Screen({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const compact = width < 560;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.page, compact && styles.pageCompact]}>
        <Header />
        <ScrollView style={styles.mainScroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
          {children}
          <View style={styles.footer}>
            <Text style={styles.eyebrow}>MADE FOR A QUIETER KIND OF CHALLENGE</Text>
            <Text style={styles.footerNote}>Take your time. ✳</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Header() {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.header}>
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="GoodGrid home" style={styles.brand}>
          <View style={styles.mark}>
            <View style={[styles.tile, { backgroundColor: '#8b9b83' }]} />
            <View style={[styles.tile, { backgroundColor: '#c69a63' }]} />
            <View style={[styles.tile, { backgroundColor: '#d9ca94' }]} />
            <View style={[styles.tile, { backgroundColor: '#adc0a6' }]} />
          </View>
          <Text style={styles.brandText}>good<Text style={styles.brandLight}>grid</Text></Text>
          <Text style={styles.brandSubtitle}>Find your focus</Text>
        </Pressable>
      </Link>
      {width > 700 && (
        <View style={styles.headerNote}>
          <View style={styles.liveDot} />
          <Text style={styles.muted}>A little time for yourself</Text>
        </View>
      )}
    </View>
  );
}

export function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { width } = useWindowDimensions();
  const compact = width < 560;
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={[styles.description, compact && styles.descriptionCompact]}>{description}</Text>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

export function BackLink({ href, label }: { href: '/' | '/casual' | '/ranked'; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.back}>
        <Text style={styles.backText}>← {label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: '100%', minWidth: 0, backgroundColor: palette.background },
  page: { flex: 1, width: '100%', maxWidth: 1440, alignSelf: 'center', paddingHorizontal: 28, minWidth: 0 },
  pageCompact: { paddingHorizontal: 18 },
  mainScroll: { flex: 1, width: '100%', minWidth: 0 },
  header: { width: '100%', minHeight: 82, borderBottomWidth: 1, borderBottomColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 31, height: 31, flexDirection: 'row', flexWrap: 'wrap', gap: 3, transform: [{ rotate: '-7deg' }] },
  tile: { width: 13, height: 13, borderRadius: 4 },
  brandText: { color: palette.ink, fontSize: 22, fontWeight: '800', letterSpacing: -1 },
  brandLight: { fontWeight: '500', color: palette.sage },
  brandSubtitle: { marginLeft: 8, color: palette.ink, fontSize: 17, fontWeight: '600' },
  headerNote: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#98a88d' },
  muted: { color: palette.muted, fontSize: 14 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 48, paddingBottom: 24, flexGrow: 1, minWidth: 0 },
  contentCompact: { paddingTop: 28, paddingBottom: 18 },
  heading: { width: '100%', marginBottom: 32, maxWidth: 760, minWidth: 0 },
  eyebrow: { color: '#989a8e', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { width: '100%', flexShrink: 1, marginTop: 12, color: palette.ink, fontSize: 42, lineHeight: 50, letterSpacing: -1.2, fontWeight: '800' },
  titleCompact: { marginTop: 9, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  description: { width: '100%', flexShrink: 1, marginTop: 10, color: palette.muted, fontSize: 17, lineHeight: 25 },
  descriptionCompact: { marginTop: 8, fontSize: 16, lineHeight: 23 },
  card: { backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.border, borderRadius: 22, padding: 28 },
  primary: { minHeight: 58, backgroundColor: palette.sageDark, borderRadius: 14, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#fffefa', fontSize: 17, fontWeight: '700' },
  secondary: { minHeight: 58, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: palette.sageDark, fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  back: { alignSelf: 'flex-start', marginBottom: 20, paddingVertical: 6 },
  backText: { color: palette.sageDark, fontWeight: '600', fontSize: 15 },
  footer: { marginTop: 48, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  footerNote: { color: '#989a8e', fontSize: 12 },
});
