import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { useAuth } from '@/lib/auth-context';
import type { StoryRing } from '@/lib/stories';
import { colors } from '@/lib/theme';

const RING_SIZE = 68;
const AVATAR_SIZE = 60;

type Props = {
  rings: StoryRing[];
  loading?: boolean;
};

export function StoriesRow({ rings, loading }: Props) {
  const { session } = useAuth();
  const router = useRouter();

  const openCreate = useCallback(() => {
    router.push('/stories/camera');
  }, [router]);

  const openViewer = useCallback(
    (userId: string) => {
      router.push(`/stories/view/${userId}`);
    },
    [router]
  );

  const displayRings =
    session && !rings.some((ring) => ring.is_self)
      ? [
          {
            user_id: session.user.id,
            handle: 'you',
            display_name: 'You',
            avatar_url: null,
            preview_url: null,
            story_count: 0,
            has_unviewed: false,
            is_self: true,
          } satisfies StoryRing,
          ...rings,
        ]
      : rings;

  if (!session) return null;

  return (
    <View className="bg-apple-bg2 pb-3 pt-2">
      {loading && displayRings.length === 0 ? (
        <View className="h-[92px] items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={displayRings}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}
          renderItem={({ item: ring }) => {
            const hasStories = ring.story_count > 0;

            return (
              <Pressable
                onPress={() => {
                  if (ring.is_self && !hasStories) {
                    openCreate();
                    return;
                  }
                  openViewer(ring.user_id);
                }}
                onLongPress={ring.is_self ? openCreate : undefined}
                className="relative items-center active:opacity-80"
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: RING_SIZE,
                    height: RING_SIZE,
                    padding: 2.5,
                    backgroundColor: hasStories && ring.has_unviewed ? colors.accent : colors.bg2,
                    borderWidth: ring.is_self && !hasStories ? 1.5 : 0,
                    borderColor: colors.border,
                    borderStyle: ring.is_self && !hasStories ? 'dashed' : 'solid',
                  }}
                >
                  <View
                    className="overflow-hidden rounded-full bg-white"
                    style={{ padding: 2 }}
                  >
                    {hasStories && ring.preview_url && !ring.is_self ? (
                      <Image
                        source={{ uri: ring.preview_url }}
                        style={{
                          width: AVATAR_SIZE,
                          height: AVATAR_SIZE,
                          borderRadius: AVATAR_SIZE / 2,
                        }}
                        contentFit="cover"
                      />
                    ) : (
                      <ProfileAvatar
                        uri={ring.avatar_url}
                        name={ring.display_name}
                        size={AVATAR_SIZE}
                        borderWidth={0}
                      />
                    )}
                  </View>
                </View>

                {ring.is_self && !hasStories ? (
                  <View className="absolute bottom-[18px] right-0 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-accent">
                    <Ionicons name="add" size={12} color="#fff" />
                  </View>
                ) : null}

                <Text
                  className="mt-1.5 max-w-[72px] text-center text-[11px]"
                  numberOfLines={1}
                  style={{ color: ring.has_unviewed ? colors.ink : colors.secondary }}
                >
                  {ring.is_self
                    ? 'Your story'
                    : (ring.display_name ?? ring.handle ?? 'User').split(' ')[0]}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
