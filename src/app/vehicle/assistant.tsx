import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardStickyFooter } from '@/components/ui/KeyboardSafeView';
import { MarkdownMessageText } from '@/components/ui/MarkdownMessageText';
import { useAuth } from '@/lib/auth-context';
import {
  aiMessageText,
  getOrCreateVehicleConversation,
  getWiredAiUsage,
  listAiMessages,
  sendWiredAiMessage,
  type AiMessage,
  type WiredAiUsage,
} from '@/lib/wired-ai';
import { WIRED_AI_FREE_MONTHLY_LIMIT } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

function vehicleDisplayName(v: {
  nickname?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): string {
  if (v.nickname?.trim()) return v.nickname.trim();
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Your vehicle';
}

export default function VehicleAssistantScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [usage, setUsage] = useState<WiredAiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [vehicleName, setVehicleName] = useState<string | null>(null);
  const listRef = useRef<FlatList<AiMessage>>(null);

  const load = useCallback(async () => {
    if (!session || !vehicleId) return;
    try {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('year, make, model, nickname')
        .eq('id', vehicleId)
        .maybeSingle();
      if (vehicle) setVehicleName(vehicleDisplayName(vehicle));

      const convo = await getOrCreateVehicleConversation(vehicleId, session.user.id);
      setConversationId(convo.id);

      try {
        setUsage(await getWiredAiUsage());
      } catch (usageErr) {
        console.warn('[Wired AI] usage check failed', usageErr);
        setUsage(null);
      }

      const rows = await listAiMessages(convo.id);
      setMessages(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load Wired AI';
      Alert.alert('Wired AI unavailable', message);
    } finally {
      setLoading(false);
    }
  }, [session, vehicleId]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && messages.length === 0) setLoading(true);
      return load();
    },
    [load],
    { cacheKey: vehicleId }
  );

  async function handleSend() {
    if (!session || !vehicleId || !draft.trim() || sending) return;

    if (usage && !usage.unlimited && usage.remaining != null && usage.remaining <= 0) {
      Alert.alert(
        'Monthly limit reached',
        `Free accounts get ${WIRED_AI_FREE_MONTHLY_LIMIT} Wired AI messages per month. Upgrade to Pro for unlimited access.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'View plans',
            onPress: () => router.push('/profile/subscription'),
          },
        ]
      );
      return;
    }

    const body = draft.trim();
    setDraft('');
    setSending(true);

    const optimistic: AiMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId ?? '',
      role: 'user',
      content: { text: body },
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const result = await sendWiredAiMessage({
        vehicleId,
        message: body,
        conversationId: conversationId ?? undefined,
      });
      setConversationId(result.conversation_id);
      setUsage(result.usage);
      const rows = await listAiMessages(result.conversation_id);
      setMessages(rows);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      setMessages((current) => current.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      const message = err instanceof Error ? err.message : 'Could not send';
      const code = (err as Error & { code?: string }).code;
      if (code === 'limit_exceeded') {
        Alert.alert('Monthly limit reached', message, [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'View plans',
            onPress: () => router.push('/profile/subscription'),
          },
        ]);
      } else {
        Alert.alert('Send failed', message);
      }
    } finally {
      setSending(false);
    }
  }

  if (loading && messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: 'Wired AI' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const usageLabel =
    usage?.unlimited
      ? 'Unlimited'
      : usage
        ? `${usage.remaining ?? 0} of ${usage.limit ?? WIRED_AI_FREE_MONTHLY_LIMIT} left this month`
        : null;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Wired AI',
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push(`/vehicle/import-documents?vehicleId=${vehicleId}`)
              }
              hitSlop={8}
              className="mr-2 active:opacity-70"
            >
              <Ionicons name="document-attach-outline" size={22} color={colors.blue} />
            </Pressable>
          ),
        }}
      />

      {usageLabel ? (
        <View className="border-b border-apple-border bg-apple-bg2 px-4 py-2">
          <Text className="text-center text-xs text-apple-secondary">{usageLabel}</Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerClassName="px-4 py-3"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <MessageBubble message={item} isUser={item.role === 'user'} />
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-apple-bg2">
              <Ionicons name="sparkles" size={32} color={colors.accent} />
            </View>
            <Text className="text-xl font-bold text-apple-ink">Wired AI</Text>
            {vehicleName ? (
              <Text className="mt-1 text-center text-[15px] font-medium text-signal-blue">
                {vehicleName}
              </Text>
            ) : null}
            <Text className="mt-2 max-w-[300px] text-center text-[15px] leading-[22px] text-apple-secondary">
              Ask about maintenance (e.g. oil changes), prices, mods, your wishlist, or similar builds — Wired AI knows this vehicle.
            </Text>
            <Pressable
              onPress={() =>
                router.push(`/vehicle/import-documents?vehicleId=${vehicleId}`)
              }
              className="mt-5 rounded-xl px-5 py-3 active:opacity-90"
              style={{ backgroundColor: colors.blueSoft }}
            >
              <Text className="text-[15px] font-semibold text-signal-blue">Import paperwork</Text>
            </Pressable>
          </View>
        }
      />

      <KeyboardStickyFooter className="border-t border-apple-border bg-white">
        <View className="flex-row items-end gap-2 px-3 pt-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask Wired AI or paste todo/done lists…"
            placeholderTextColor={colors.tertiary}
            multiline
            maxLength={12000}
            className="max-h-28 flex-1 rounded-2xl bg-apple-bg2 px-4 py-2.5 text-[15px] text-apple-ink"
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!draft.trim() || sending}
            className="mb-1 h-9 w-9 items-center justify-center active:opacity-70 disabled:opacity-40"
          >
            {sending ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Ionicons
                name="send"
                size={22}
                color={draft.trim() ? colors.accent : colors.tertiary}
              />
            )}
          </Pressable>
        </View>
      </KeyboardStickyFooter>
    </View>
  );
}

function MessageBubble({ message, isUser }: { message: AiMessage; isUser: boolean }) {
  const text = aiMessageText(message);
  return (
    <View className={`mb-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser ? (
        <View className="mb-1 flex-row items-center gap-1.5">
          <Ionicons name="sparkles" size={12} color={colors.accent} />
          <Text className="text-[11px] font-semibold text-apple-secondary">Wired AI</Text>
        </View>
      ) : null}
      <View
        className={`max-w-[85%] rounded-[20px] px-4 py-2.5 ${
          isUser ? 'rounded-br-md bg-accent' : 'rounded-bl-md bg-apple-bg2'
        }`}
      >
        {isUser ? (
          <Text className="text-[15px] leading-[20px] text-white">{text}</Text>
        ) : (
          <MarkdownMessageText>{text}</MarkdownMessageText>
        )}
      </View>
    </View>
  );
}
