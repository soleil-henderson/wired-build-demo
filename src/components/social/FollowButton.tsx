import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import {
  getFollowStatus,
  toggleFollowStatus,
  type FollowStatus,
} from '@/lib/follows';
import { colors } from '@/lib/theme';

type Props = {
  userId: string;
  handle: string;
  isPrivate?: boolean;
  size?: 'sm' | 'md';
  onChange?: (status: FollowStatus) => void;
};

export function FollowButton({
  userId,
  handle,
  isPrivate = false,
  size = 'sm',
  onChange,
}: Props) {
  const { session } = useAuth();
  const [status, setStatus] = useState<FollowStatus>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isSelf = session?.user.id === userId;

  const load = useCallback(async () => {
    if (!session || isSelf) {
      setLoading(false);
      return;
    }
    try {
      setStatus(await getFollowStatus(session.user.id, userId));
    } finally {
      setLoading(false);
    }
  }, [session, userId, isSelf]);

  useEffect(() => {
    load();
  }, [load]);

  const pad = size === 'sm' ? 'px-2.5 py-1' : 'px-4 py-2';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (!session || isSelf) return null;

  if (loading) {
    return (
      <View
        className={`rounded-lg ${pad} border border-apple-border bg-white`}
        style={{ minWidth: size === 'sm' ? 88 : 100 }}
      >
        <ActivityIndicator size="small" color={colors.secondary} />
      </View>
    );
  }

  async function handlePress() {
    if (!session) return;
    setBusy(true);
    const prev = status;
    try {
      const next = await toggleFollowStatus(session.user.id, userId);
      setStatus(next);
      onChange?.(next);
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  const label =
    status === 'following'
      ? 'Following'
      : status === 'requested'
        ? 'Requested'
        : isPrivate
          ? 'Follow'
          : 'Follow';

  const filled = status === 'none';

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      className={`rounded-lg ${pad} ${
        filled ? 'bg-accent' : 'border border-apple-border bg-apple-bg2'
      } disabled:opacity-60`}
      accessibilityLabel={
        status === 'following'
          ? `Unfollow @${handle}`
          : status === 'requested'
            ? `Cancel follow request to @${handle}`
            : `Follow @${handle}`
      }
    >
      {busy ? (
        <ActivityIndicator size="small" color={filled ? '#fff' : colors.secondary} />
      ) : (
        <Text
          className={`${textSize} font-semibold ${
            filled ? 'text-white' : 'text-apple-ink'
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
