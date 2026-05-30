import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { DmEventPreview } from '@/lib/messages';
import { EVENT_KIND_LABELS, formatEventWhen, type EventKind } from '@/lib/events';
import { colors } from '@/lib/theme';

type Props = {
  preview: DmEventPreview;
  note?: string | null;
  isMine: boolean;
};

export function DmEventShareCard({ preview, note, isMine }: Props) {
  const router = useRouter();
  const kindLabel = EVENT_KIND_LABELS[preview.kind as EventKind] ?? preview.kind;

  return (
    <Pressable
      onPress={() => router.push(`/event/${preview.id}`)}
      className={`w-full overflow-hidden rounded-[18px] border active:opacity-90 ${
        isMine
          ? 'rounded-br-[5px] border-white/30 bg-accent'
          : 'rounded-bl-[5px] border-apple-border bg-white'
      }`}
    >
      <View className="flex-row items-center gap-2 px-4 pt-3">
        <Ionicons name="calendar" size={18} color={isMine ? '#fff' : colors.blue} />
        <Text
          className={`text-[11px] font-bold uppercase tracking-wider ${
            isMine ? 'text-white/85' : 'text-apple-secondary'
          }`}
        >
          {kindLabel}
          {preview.is_private ? ' · Private' : ''}
        </Text>
      </View>
      <Text
        className={`px-4 pt-1.5 text-[16px] font-bold leading-snug ${isMine ? 'text-white' : 'text-apple-ink'}`}
        numberOfLines={2}
      >
        {preview.title}
      </Text>
      <Text
        className={`px-4 pt-1 text-[13px] leading-snug ${isMine ? 'text-white/90' : 'text-apple-secondary'}`}
      >
        {formatEventWhen(preview.starts_at, null)}
      </Text>
      <Text
        className={`px-3 pb-3 pt-0.5 text-[13px] ${isMine ? 'text-white/80' : 'text-apple-tertiary'}`}
        numberOfLines={1}
      >
        {preview.location_name}
      </Text>
      {note ? (
        <View
          className={`border-t px-4 py-2.5 ${
            isMine ? 'border-white/25' : 'border-apple-border'
          }`}
        >
          <Text className={`text-[14px] leading-snug ${isMine ? 'text-white' : 'text-apple-ink'}`}>
            {note}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
