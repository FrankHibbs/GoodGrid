import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { BackLink, Card, Heading, Screen } from '@/components/screen';
import { palette } from '@/constants/goodgrid';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';

export default function AccountScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function submit() {
    setMessage('');
    setError(false);
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Add the Supabase URL and publishable key to expo-app/.env, then restart Expo.');
      setError(true);
      return;
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setMessage('Enter your email and password.');
      setError(true);
      return;
    }
    if (mode === 'signup' && !/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) {
      setMessage('Choose a username with 3–20 letters, numbers, or underscores.');
      setError(true);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const emailRedirectTo = Platform.OS === 'web'
          ? `${window.location.origin}/auth/callback`
          : Linking.createURL('auth/callback');
        const { data, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { username: username.trim() }, emailRedirectTo },
        });
        if (authError) throw authError;
        if (data.session) router.replace('/');
        else setMessage('Account created. Check your email to confirm, then return here to sign in.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (authError) throw authError;
        router.replace('/');
      }
    } catch (authError) {
      setMessage(authError instanceof Error ? authError.message : 'Could not complete the request. Check your connection and try again.');
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    const { error: authError } = await supabase.auth.signOut();
    setBusy(false);
    if (authError) {
      setMessage(authError.message);
      setError(true);
    } else {
      setMessage('You are signed out. Your puzzle remains saved on this device.');
    }
  }

  const displayName = String(session?.user.user_metadata.username || session?.user.email || 'GoodGrid player');

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading eyebrow="YOUR GOODGRID ACCOUNT" title="Save your progress" description="Sign in to carry your casual puzzle progress between devices. Guest progress stays saved on this device too." />
      <Card style={styles.card}>
        {loading ? <ActivityIndicator color={palette.sageDark} /> : session ? (
          <>
            <Text style={styles.title}>Signed in as {displayName}</Text>
            <Text style={styles.copy}>Your casual puzzle progress will sync with this account when online.</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={signOut} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{busy ? 'Signing out…' : 'Sign out'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.tabs}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signin' }} onPress={() => { setMode('signin'); setMessage(''); }} style={[styles.tab, mode === 'signin' && styles.activeTab]}><Text style={styles.tabText}>Sign in</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signup' }} onPress={() => { setMode('signup'); setMessage(''); }} style={[styles.tab, mode === 'signup' && styles.activeTab]}><Text style={styles.tabText}>Create account</Text></Pressable>
            </View>
            {mode === 'signup' && <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={20} />}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.primaryButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={palette.paper} /> : <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
            </Pressable>
          </>
        )}
        {message ? <Text accessibilityLiveRegion="polite" style={[styles.message, error && styles.error]}>{message}</Text> : null}
        {!isSupabaseConfigured && <Text style={styles.setup}>Supabase credentials are not configured yet.</Text>}
      </Card>
      <View style={styles.policy}><Text style={styles.copy}>Your email is used for account access and recovery. Your username appears on the leaderboard.</Text></View>
    </Screen>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; autoCorrect?: boolean; keyboardType?: 'default' | 'email-address'; maxLength?: number }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor="#92958b" style={styles.input} autoCapitalize="none" autoCorrect={false} {...inputProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 22 },
  title: { color: palette.ink, fontSize: 20, fontWeight: '700' },
  copy: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', gap: 8, padding: 4, marginBottom: 20, borderRadius: 13, backgroundColor: '#f1efe7' },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: palette.paper, elevation: 1 },
  tabText: { color: palette.sageDark, fontWeight: '700' },
  field: { marginBottom: 16, gap: 7 },
  label: { color: palette.ink, fontWeight: '600', fontSize: 14 },
  input: { width: '100%', minHeight: 50, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 14, color: palette.ink, backgroundColor: palette.paper, fontSize: 16 },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: palette.sageDark, marginTop: 4 },
  primaryText: { color: palette.paper, fontSize: 16, fontWeight: '700' },
  secondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: palette.border },
  secondaryText: { color: palette.sageDark, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  message: { marginTop: 15, color: palette.sageDark, lineHeight: 21 },
  error: { color: '#a84b3f' },
  setup: { marginTop: 12, color: '#a84b3f', fontSize: 13 },
  policy: { width: '100%', maxWidth: 620, alignSelf: 'center', marginTop: 18 },
});
