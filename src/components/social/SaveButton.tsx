import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { isSaved, toggleSaved } from '@/lib/saves';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import type { SavedTargetType } from '@/types/database';

type SaveButtonProps = {
  targetType: SavedTargetType;
  targetId: string;
  /** Hide for own content or when content is unavailable */
  hidden?: boolean;
  size?: number;
  className?: string;
};

export function SaveButton({
  targetType,
  targetId,
  hidden,
  size = 22,
  className = 'px-2 active:opacity-70',
}: SaveButtonProps) {
  const { session } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session || hidden || !targetId) {
      setSaved(false);
      return;
    }
    try {
      const value = await isSaved(session.user.id, targetType, targetId);
      setSaved(value);
    } catch {
      setSaved(false);
    }
  }, [session, hidden, targetId, targetType]);

  useFocusData(load, [load], { cacheKey: `${targetType}:${targetId}` });

  async function handlePress() {
    if (!session) {
      Alert.alert('Sign in', 'Sign in to save items to your collection.');
      return;
    }
    if (saving) return;

    const previouslySaved = saved;
    setSaved(!previouslySaved);
    setSaving(true);
    try {
      const next = await toggleSaved(targetType, targetId, previouslySaved);
      setSaved(next);
    } catch (err) {
      setSaved(previouslySaved);
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not update save');
    } finally {
      setSaving(false);
    }
  }

  if (hidden || !targetId) return null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={saving}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
      className={className}
    >
      {saving ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={size}
          color={saved ? colors.accent : colors.secondary}
        />
      )}
    </Pressable>
  );
}
