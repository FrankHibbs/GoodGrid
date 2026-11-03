import type { EmailOtpType } from '@supabase/supabase-js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Card, Screen } from '@/components/screen';
import { palette } from '@/constants/goodgrid';
import { supabase } from '@/lib/supabase';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[]; token_hash?: string | string[]; type?: string | string[]; error_description?: string | string[] }>();
  const [message, setMessage] = useState('Confirming your email…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function confirm() {
      if (!supabase) {
        if (active) { setMessage('Supabase is not configured in this app.'); setFailed(true); }
        return;
      }
      const linkError = first(params.error_description);
      if (linkError) {
        if (active) { setMessage(linkError.replaceAll('+', ' ')); setFailed(true); }
        return;
      }
      const code = first(params.code);
      const tokenHash = first(params.token_hash);
      const otpType = first(params.type);
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : tokenHash && otpType
          ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType as EmailOtpType })
          : { error: new Error('The confirmation link is missing its verification code.') };
      if (!active) return;
      if (result.error) {
        setMessage(result.error.message);
        setFailed(true);
      } else {
        setMessage('Email confirmed. You can continue in GoodGrid.');
        setTimeout(() => router.replace('/'), 900);
      }
    }
    void confirm();
    return () => { active = false; };
  }, [params.code, params.error_description, params.token_hash, params.type, router]);

  return <Screen><Card style={styles.card}>{!failed && <ActivityIndicator color={palette.sageDark} />}<Text accessibilityLiveRegion="polite" style={[styles.message, failed && styles.error]}>{message}</Text></Card></Screen>;
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center', gap: 14, padding: 28 },
  message: { color: palette.sageDark, textAlign: 'center', lineHeight: 22 },
  error: { color: '#a84b3f' },
});
