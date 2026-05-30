import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

type Props = {
  email: string;
  submitting: boolean;
  resending: boolean;
  onSubmit: (code: string) => void;
  onResend: () => void;
};

const RESEND_COOLDOWN_SEC = 60;

export function EmailOtpForm({ email, submitting, resending, onSubmit, onResend }: Props) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function handleCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      onSubmit(digits);
    }
  }

  function handleResend() {
    if (cooldown > 0 || resending) return;
    onResend();
    setCooldown(RESEND_COOLDOWN_SEC);
  }

  return (
    <View>
      <Text className="text-center text-sm text-apple-secondary">
        Enter the 6-digit code we sent to{'\n'}
        <Text className="font-semibold text-apple-ink">{email}</Text>
      </Text>

      <TextInput
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor="#A1A1A6"
        className="mt-6 rounded-xl border border-apple-border bg-white px-4 py-4 text-center text-2xl font-semibold tracking-[0.35em] text-apple-ink"
        editable={!submitting}
      />

      <Pressable
        onPress={() => {
          if (code.length === 6) onSubmit(code);
        }}
        disabled={submitting || code.length < 6}
        className="mt-6 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-center text-base font-semibold text-white">Continue</Text>
        )}
      </Pressable>

      <Pressable
        onPress={handleResend}
        disabled={resending || cooldown > 0}
        className="mt-4 py-2 disabled:opacity-50"
      >
        {resending ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-center text-sm text-accent">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
