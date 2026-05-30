import { useRouter } from 'expo-router';
import { Linking, Pressable, Text, type TextProps } from 'react-native';

const MENTION_RE = /@([a-zA-Z0-9_]{2,30})/g;
const URL_RE = /(https?:\/\/[^\s]+)/g;

type Props = TextProps & {
  body: string;
  baseClassName?: string;
};

/** Renders comment/post text with tappable @mentions and URLs. */
export function MentionText({ body, baseClassName = 'text-sm text-apple-secondary', ...rest }: Props) {
  const router = useRouter();
  const parts = tokenize(body);

  return (
    <Text className={baseClassName} {...rest}>
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <Text
              key={i}
              className="font-semibold text-signal-blue"
              onPress={() => router.push(`/user/${part.value}`)}
            >
              @{part.value}
            </Text>
          );
        }
        if (part.type === 'url') {
          return (
            <Text
              key={i}
              className="text-signal-blue underline"
              onPress={() => Linking.openURL(part.value)}
            >
              {part.value}
            </Text>
          );
        }
        return <Text key={i}>{part.value}</Text>;
      })}
    </Text>
  );
}

type Token =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'url'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const combined = new RegExp(`${MENTION_RE.source}|${URL_RE.source}`, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = combined.exec(input)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: input.slice(last, match.index) });
    }
    if (match[0].startsWith('@')) {
      tokens.push({ type: 'mention', value: match[1] });
    } else {
      tokens.push({ type: 'url', value: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) tokens.push({ type: 'text', value: input.slice(last) });
  return tokens.length ? tokens : [{ type: 'text', value: input }];
}

/** Extract @handles from comment body for notifications (client-side hint). */
export function extractMentionHandles(body: string): string[] {
  const handles = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');
  while ((m = re.exec(body)) !== null) handles.add(m[1].toLowerCase());
  return [...handles];
}
