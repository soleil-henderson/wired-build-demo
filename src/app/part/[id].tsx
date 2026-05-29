import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { UserBadges } from '@/components/UserBadges';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import {
  getPartById,
  getPartStats,
  listPartInstalls,
  type Part,
  type PartInstall,
  type PartStats,
} from '@/lib/parts';
import {
  deleteReview,
  getMyReview,
  listReviews,
  recordPartClick,
  upsertReview,
  type MyReview,
  type ReviewWithAuthor,
} from '@/lib/reviews';
import { extractAffiliate } from '@/lib/affiliate';
import { getUserSubscriptionTier, hasMemberAffiliateRates } from '@/lib/subscription';
import { addWishlistItem } from '@/lib/wishlist';
import { routeParam } from '@/lib/route-param';
import type { ModCategory } from '@/types/database';

export default function PartDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const { session } = useAuth();
  const router = useRouter();

  const [part, setPart] = useState<Part | null>(null);
  const [stats, setStats] = useState<PartStats | null>(null);
  const [installs, setInstalls] = useState<PartInstall[]>([]);
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [myReview, setMyReview] = useState<MyReview>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberAffiliate, setMemberAffiliate] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const userId = session?.user.id;
      const [p, s, i, rv, mine, tier] = await Promise.all([
        getPartById(id),
        getPartStats(id),
        listPartInstalls(id, 20),
        listReviews(id).catch(() => []),
        userId ? getMyReview(id, userId).catch(() => null) : Promise.resolve(null),
        userId ? getUserSubscriptionTier(userId) : Promise.resolve('free' as const),
      ]);
      setMemberAffiliate(hasMemberAffiliateRates(tier));
      setPart(p);
      setStats(s);
      setInstalls(i);
      setReviews(rv);
      setMyReview(mine);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load part';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleAffiliate(url: string) {
    if (!part) return;
    // Fire-and-forget: record click before opening, so even if the browser
    // doesn't return we have the analytics row.
    recordPartClick(part.id, session?.user.id ?? null);
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('Cannot open link', 'This affiliate URL is unsupported on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open link';
      Alert.alert('Error', message);
    }
  }

  async function handleSave() {
    if (!part) return;
    if (!session) {
      showAppAlert('Sign in', 'Sign in to save parts to your wishlist.');
      return;
    }
    setSaving(true);
    try {
      await addWishlistItem({
        userId: session.user.id,
        vehicleId: null,
        partId: part.id,
        customPartName: null,
        category: part.category as ModCategory,
        targetCost: null,
        notes: null,
        priority: 'medium',
      });
      showAppAlert(
        'Saved',
        `${part.brand} ${part.name} added to your wishlist. View it from Profile → My wishlist.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      showAppAlert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Part' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!part) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-apple-ink">This part isn&apos;t available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-apple-bg2"
      contentContainerClassName="pb-24"
      refreshControl={
        <RefreshControl
          tintColor="#F5A524"
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Stack.Screen options={{ title: part.brand }} />

      {/* ---- Hero ---- */}
      <View className="bg-white px-6 pt-6 pb-6">
        <Text className="text-[11px] uppercase tracking-wider text-accent">
          {part.category.replace('_', ' ')}
        </Text>
        <Text className="mt-2 text-2xl font-bold text-apple-ink">{part.brand}</Text>
        <Text className="mt-1 text-lg text-apple-secondary">{part.name}</Text>
        {!part.is_approved ? (
          <View className="mt-3 self-start rounded-full bg-apple-bg2 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-apple-secondary">
              Awaiting review
            </Text>
          </View>
        ) : null}

        <View className="mt-5 flex-row gap-6">
          <Stat label="Installs" value={String(stats?.installCount ?? 0)} />
          <Stat
            label="Rating"
            value={
              part.review_count > 0 && part.avg_rating != null
                ? `★ ${Number(part.avg_rating).toFixed(1)}  (${part.review_count})`
                : '—'
            }
          />
          <Stat
            label="Avg cost"
            value={
              stats?.averageCost != null
                ? `$${Math.round(stats.averageCost).toLocaleString()}`
                : '—'
            }
          />
        </View>

        {stats && stats.installCount > 0 ? (
          <View className="mt-4 flex-row gap-4">
            <Text className="text-xs text-apple-secondary">
              <Text className="font-semibold text-apple-secondary">
                {stats.installerSelf}
              </Text>{' '}
              DIY
            </Text>
            <Text className="text-xs text-apple-secondary">
              <Text className="font-semibold text-apple-secondary">
                {stats.installerWorkshop}
              </Text>{' '}
              workshop
            </Text>
            <Text className="text-xs text-apple-secondary">
              Last installed{' '}
              <Text className="font-semibold text-apple-secondary">
                {stats.lastInstalledAt
                  ? formatRelative(stats.lastInstalledAt)
                  : '—'}
              </Text>
            </Text>
            <Text className="text-xs text-apple-secondary">
              Total{' '}
              <Text className="font-semibold text-apple-secondary">
                ${Math.round(stats.totalSpent).toLocaleString()}
              </Text>
            </Text>
          </View>
        ) : null}

        <View className="mt-6 flex-row flex-wrap gap-2">
          {(() => {
            const aff = extractAffiliate(part.affiliate_links, {
              memberRates: memberAffiliate,
              region: 'au',
            });
            if (!aff) return null;
            return (
              <Pressable
                onPress={() => handleAffiliate(aff.url)}
                className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
              >
                <Text className="font-semibold text-white">
                  {aff.label ?? `Buy from ${part.brand}`}  ↗
                </Text>
              </Pressable>
            );
          })()}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl border border-apple-border bg-white px-4 py-2.5 active:bg-apple-bg2 disabled:opacity-60"
          >
            {saving ? (
              <ActivityIndicator color="#FF6A2B" />
            ) : (
              <Text className="font-semibold text-apple-secondary">+ Save to wishlist</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ---- Reviews ---- */}
      <ReviewsSection
        partLabel={`${part.brand} ${part.name}`}
        reviews={reviews}
        myReview={myReview}
        isSignedIn={!!session}
        onSubmit={async (rating, body) => {
          if (!session) {
            Alert.alert('Sign in', 'Sign in to leave a review.');
            return;
          }
          try {
            await upsertReview({
              partId: part.id,
              userId: session.user.id,
              rating,
              body,
            });
            await load();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not save';
            Alert.alert('Save failed', message);
          }
        }}
        onDelete={async () => {
          if (!session) return;
          try {
            await deleteReview(part.id, session.user.id);
            await load();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete';
            Alert.alert('Delete failed', message);
          }
        }}
        onOpenUser={(handle) => router.push(`/user/${handle}`)}
      />

      {/* ---- Recent installs ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Recent installs
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
                  if (row.vehicle?.id) router.push(`/vehicle/${row.vehicle.id}`);
                }}
                disabled={!row.vehicle?.id}
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
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">{label}</Text>
      <Text className="mt-1 text-base font-semibold text-apple-ink">{value}</Text>
    </View>
  );
}

function ReviewsSection({
  partLabel,
  reviews,
  myReview,
  isSignedIn,
  onSubmit,
  onDelete,
  onOpenUser,
}: {
  partLabel: string;
  reviews: ReviewWithAuthor[];
  myReview: MyReview;
  isSignedIn: boolean;
  onSubmit: (rating: number, body: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenUser: (handle: string) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [rating, setRating] = useState<number>(myReview?.rating ?? 0);
  const [body, setBody] = useState<string>(myReview?.body ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Reset draft when the underlying review changes (e.g. after a save).
  const draftKey = `${myReview?.id ?? 'none'}:${myReview?.rating ?? 0}`;
  const [lastKey, setLastKey] = useState(draftKey);
  if (lastKey !== draftKey) {
    setRating(myReview?.rating ?? 0);
    setBody(myReview?.body ?? '');
    setLastKey(draftKey);
  }

  async function handleSubmit() {
    if (rating < 1) {
      Alert.alert('Pick a rating', 'Tap a star from 1 to 5.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating, body.trim() || null);
      setComposerOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete your review?',
      `Your rating and notes for ${partLabel} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await onDelete();
              setComposerOpen(false);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View className="px-6 pt-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Reviews
        </Text>
        {isSignedIn ? (
          <Pressable
            onPress={() => setComposerOpen((v) => !v)}
            className="rounded-lg border border-accent px-2.5 py-1 active:bg-apple-bg2"
          >
            <Text className="text-xs font-semibold text-accent">
              {composerOpen
                ? 'Cancel'
                : myReview
                  ? 'Edit your review'
                  : '+ Write a review'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {composerOpen ? (
        <View className="mt-3 rounded-2xl border border-apple-border bg-white p-4">
          <Text className="text-xs uppercase tracking-wider text-apple-secondary">
            Your rating
          </Text>
          <View className="mt-2">
            <StarRow value={rating} onChange={setRating} interactive />
          </View>
          <Text className="mt-4 text-xs uppercase tracking-wider text-apple-secondary">
            Notes (optional)
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What worked, what didn't, fitment notes…"
            placeholderTextColor="#A1A1A6"
            multiline
            numberOfLines={4}
            className="mt-2 rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            style={{ minHeight: 88, textAlignVertical: 'top' }}
          />
          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark disabled:opacity-60"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-semibold text-white">
                  {myReview ? 'Update review' : 'Post review'}
                </Text>
              )}
            </Pressable>
            {myReview ? (
              <Pressable
                onPress={handleDelete}
                disabled={submitting}
                className="rounded-xl border border-apple-border px-4 py-2.5 active:bg-apple-bg2 disabled:opacity-60"
              >
                <Text className="font-semibold text-signal-red">Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!isSignedIn && reviews.length === 0 ? (
        <Text className="mt-3 text-sm text-apple-secondary">
          Sign in to leave the first review on this part.
        </Text>
      ) : null}

      {reviews.length === 0 && isSignedIn && !composerOpen ? (
        <Text className="mt-3 text-sm text-apple-secondary">
          No reviews yet. Be the first to share how it fits / performs.
        </Text>
      ) : null}

      <View className="mt-3 gap-3">
        {reviews.map((rv) => (
          <View
            key={rv.id}
            className="rounded-2xl border border-apple-border bg-white p-4"
          >
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => onOpenUser(rv.author.handle)}
                className="flex-row items-center gap-2 active:opacity-80"
              >
                {rv.author.avatar_url ? (
                  <Image
                    source={{ uri: rv.author.avatar_url }}
                    className="h-7 w-7 rounded-full bg-apple-bg2"
                  />
                ) : (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-apple-bg2">
                    <Text className="text-[10px] font-bold text-apple-ink">
                      {(rv.author.display_name || rv.author.handle || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text className="text-sm font-semibold text-apple-ink">
                  @{rv.author.handle}
                </Text>
                <UserBadges user={rv.author} />
              </Pressable>
              <Text className="ml-auto text-[11px] text-apple-secondary">
                {formatRelative(rv.created_at)}
              </Text>
            </View>
            <View className="mt-2">
              <StarRow value={rv.rating} />
            </View>
            {rv.body ? (
              <Text className="mt-2 text-sm text-apple-secondary">{rv.body}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function StarRow({
  value,
  onChange,
  interactive = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  interactive?: boolean;
}) {
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const child = (
          <Text
            className={`text-2xl ${filled ? 'text-accent' : 'text-apple-tertiary'}`}
          >
            ★
          </Text>
        );
        if (!interactive) return <View key={n}>{child}</View>;
        return (
          <Pressable
            key={n}
            onPress={() => onChange?.(n)}
            hitSlop={6}
            className="active:opacity-80"
          >
            {child}
          </Pressable>
        );
      })}
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

function formatRelative(iso: string) {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return '—';
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
