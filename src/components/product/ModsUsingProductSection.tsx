import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { UserBadges } from '@/components/UserBadges';
import type { PartInstall } from '@/lib/parts';

type Props = {
  installs: PartInstall[];
};

export function ModsUsingProductSection({ installs }: Props) {
  const router = useRouter();

  return (
    <View className="px-6 pt-6">
      <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
        Mods using this product
      </Text>
      {installs.length === 0 ? (
        <View className="mt-3 rounded-2xl border border-apple-border bg-white p-5">
          <Text className="text-base font-semibold text-apple-secondary">
            No public installs yet
          </Text>
          <Text className="mt-1 text-sm text-apple-secondary">
            Be the first to log this part on one of your builds.
          </Text>
        </View>
      ) : (
        <View className="mt-3 gap-3">
          {installs.map((row) => (
            <Pressable
              key={row.modId}
              onPress={() => {
                if (row.postId) router.push(`/post/${row.postId}`);
                else if (row.vehicle?.id) router.push(`/vehicle/${row.vehicle.id}`);
              }}
              disabled={!row.postId && !row.vehicle?.id}
              className="overflow-hidden rounded-2xl border border-apple-border bg-white active:bg-apple-bg2"
            >
              {row.photoUrl ? (
                <Image
                  source={{ uri: row.photoUrl }}
                  className="h-44 w-full bg-apple-bg2"
                  resizeMode="cover"
                />
              ) : null}
              <View className="p-4">
                <View className="flex-row items-center gap-2">
                  {row.owner ? (
                    <Pressable
                      onPress={() => router.push(`/user/${row.owner!.handle}`)}
                      className="flex-row items-center gap-2 active:opacity-80"
                    >
                      {row.owner.avatar_url ? (
                        <Image
                          source={{ uri: row.owner.avatar_url }}
                          className="h-7 w-7 rounded-full bg-apple-bg2"
                        />
                      ) : (
                        <View className="h-7 w-7 items-center justify-center rounded-full bg-apple-bg2">
                          <Text className="text-[10px] font-bold text-apple-ink">
                            {(row.owner.display_name || row.owner.handle || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text className="text-sm font-semibold text-apple-ink">
                        @{row.owner.handle}
                      </Text>
                      <UserBadges user={row.owner} />
                    </Pressable>
                  ) : null}
                  <Text className="ml-auto text-[11px] text-apple-secondary">
                    {formatDate(row.installDate)}
                    {row.dateIsApproximate ? ' ~' : ''}
                  </Text>
                </View>
                {row.vehicle ? (
                  <Text className="mt-2 text-xs uppercase tracking-wider text-apple-secondary">
                    {row.vehicle.nickname ??
                      `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`}
                  </Text>
                ) : null}
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-apple-secondary">
                    {labelForInstaller(row.installerType)}
                  </Text>
                  <Text className="text-sm font-semibold text-apple-ink">
                    {row.cost == null
                      ? '—'
                      : `${row.costIsApproximate ? '~' : ''}$${Number(row.cost).toLocaleString()}`}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function labelForInstaller(t: string) {
  switch (t) {
    case 'self':
      return 'DIY install';
    case 'workshop':
      return 'Workshop install';
    case 'friend':
      return 'Friend install';
    case 'dealer':
      return 'Dealer install';
    default:
      return t;
  }
}
