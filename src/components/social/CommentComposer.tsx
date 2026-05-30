import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MentionTextInput } from '@/components/social/MentionTextInput';
import { inputClassName } from '@/lib/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  posting?: boolean;
  placeholder?: string;
  editable?: boolean;
};

export function CommentComposer({
  value,
  onChangeText,
  onSubmit,
  posting = false,
  placeholder = 'Add a comment…',
  editable = true,
}: Props) {
  return (
    <View>
      <View className="flex-row items-end gap-2">
        <View className="min-w-0 flex-1">
          <MentionTextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            editable={editable && !posting}
            multiline
            className={`max-h-32 min-h-[40px] w-full ${inputClassName}`}
          />
        </View>
        <Pressable
          onPress={onSubmit}
          disabled={!editable || posting || !value.trim()}
          className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark disabled:opacity-50"
        >
          {posting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-semibold text-white">Post</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
