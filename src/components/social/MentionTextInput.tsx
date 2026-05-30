import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { searchUsers, type UserSearchResult } from '@/lib/explore';
import { colors, inputClassName } from '@/lib/theme';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  inputClassName?: string;
};

/** Text input with @mention autocomplete (used in comments, bio, etc.). */
export function MentionTextInput({
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline = false,
  inputClassName: extraInputClassName,
  className,
  style,
  ...rest
}: Props) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const token = useRef(0);

  useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 1) {
      setSuggestions([]);
      return;
    }
    const t = ++token.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const hits = await searchUsers(mentionQuery, 6);
        if (token.current === t) setSuggestions(hits);
      } finally {
        if (token.current === t) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [mentionQuery]);

  function handleChange(text: string) {
    onChangeText(text);
    const at = text.lastIndexOf('@');
    if (at >= 0 && (at === 0 || /\s/.test(text[at - 1] ?? ''))) {
      const tail = text.slice(at + 1);
      if (!tail.includes(' ') && tail.length <= 30) {
        setMentionQuery(tail);
        return;
      }
    }
    setMentionQuery(null);
    setSuggestions([]);
  }

  function insertMention(handle: string) {
    const at = value.lastIndexOf('@');
    if (at < 0) return;
    const next = `${value.slice(0, at)}@${handle} `;
    onChangeText(next);
    setMentionQuery(null);
    setSuggestions([]);
  }

  const fieldClassName = extraInputClassName ?? inputClassName;

  return (
    <View>
      {suggestions.length > 0 ? (
        <View className="mb-2 overflow-hidden rounded-xl border border-apple-border bg-white">
          {searching ? (
            <View className="items-center py-3">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            suggestions.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => insertMention(u.handle)}
                className="border-b border-apple-border/60 px-3 py-2.5 active:bg-apple-bg2"
              >
                <Text className="font-semibold text-apple-ink">{u.display_name}</Text>
                <Text className="text-xs text-apple-secondary">@{u.handle}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiary}
        editable={editable}
        multiline={multiline}
        className={className ?? fieldClassName}
        style={[{ width: '100%' }, style]}
        {...rest}
      />
    </View>
  );
}
