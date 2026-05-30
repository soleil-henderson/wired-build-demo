import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { isBusinessProfile } from '@/lib/account-routing';
import { colors } from '@/lib/theme';
import type { UserProfile } from '@/lib/users';
import { listWorkshopPortfolio, type WorkshopPortfolioItem } from '@/lib/workshop-portfolio';
import { submitWorkshopEnquiry } from '@/lib/workshop-enquiries';
import {
  canReviewWorkshop,
  getMyWorkshopReview,
  getWorkshopReviewStats,
  listWorkshopReviews,
  upsertWorkshopReview,
  type WorkshopReview,
  type WorkshopReviewStats,
} from '@/lib/workshop-reviews';

type Props = {
  user: UserProfile;
  isSelf: boolean;
};

export function WorkshopProfileSections({ user, isSelf }: Props) {
  const { session } = useAuth();
  const router = useRouter();

  if (!isBusinessProfile(user)) return null;

  const [stats, setStats] = useState<WorkshopReviewStats | null>(null);
  const [reviews, setReviews] = useState<WorkshopReview[]>([]);
  const [portfolio, setPortfolio] = useState<WorkshopPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [sendingEnquiry, setSendingEnquiry] = useState(false);

  const [canReview, setCanReview] = useState(false);
  const [myRating, setMyRating] = useState(5);
  const [myReviewBody, setMyReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const businessName = user.workshop_name ?? user.display_name;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, revs, port] = await Promise.all([
        getWorkshopReviewStats(user.id),
        listWorkshopReviews(user.id, 12),
        listWorkshopPortfolio(user.id),
      ]);
      setStats(st);
      setReviews(revs);
      setPortfolio(port.filter((p) => p.is_published));
      if (session && !isSelf) {
        const [allowed, mine] = await Promise.all([
          canReviewWorkshop(user.id, session.user.id),
          getMyWorkshopReview(user.id, session.user.id),
        ]);
        setCanReview(allowed);
        if (mine) {
          setMyRating(mine.rating);
          setMyReviewBody(mine.body ?? '');
        }
      }
    } catch (err) {
      console.warn('[profile] workshop sections', err);
    } finally {
      setLoading(false);
    }
  }, [user.id, session, isSelf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleEnquiry() {
    if (!enquiryName.trim() || !enquiryEmail.trim() || !enquiryMessage.trim()) {
      Alert.alert('Missing fields', 'Name, email, and message are required.');
      return;
    }
    setSendingEnquiry(true);
    try {
      await submitWorkshopEnquiry({
        workshopUserId: user.id,
        senderUserId: session?.user.id ?? null,
        senderName: enquiryName.trim(),
        senderEmail: enquiryEmail.trim(),
        senderPhone: enquiryPhone.trim() || null,
        message: enquiryMessage.trim(),
      });
      setEnquiryMessage('');
      Alert.alert('Sent', 'Your message was sent to the business.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSendingEnquiry(false);
    }
  }

  async function handleReview() {
    if (!session) return;
    setSubmittingReview(true);
    try {
      await upsertWorkshopReview({
        workshopUserId: user.id,
        reviewerUserId: session.user.id,
        rating: myRating,
        body: myReviewBody,
      });
      await load();
      Alert.alert('Thanks', 'Your review was saved.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save review');
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <View className="border-t border-apple-border bg-white px-4 py-4">
      {user.workshop_business_type ? (
        <Text className="text-xs uppercase tracking-wider text-apple-secondary">
          {user.workshop_business_type}
        </Text>
      ) : null}
      {stats && stats.review_count > 0 ? (
        <Text className="mt-1 text-sm font-semibold text-accent">
          ★ {stats.avg_rating?.toFixed(1)} · {stats.review_count} review
          {stats.review_count === 1 ? '' : 's'}
        </Text>
      ) : null}

      {user.workshop_tagline ? (
        <Text className="mt-2 text-sm font-medium text-apple-ink">{user.workshop_tagline}</Text>
      ) : null}
      {user.workshop_description ? (
        <Text className="mt-1 text-sm text-apple-secondary">{user.workshop_description}</Text>
      ) : null}

      <View className="mt-3 gap-1.5">
        {user.workshop_address ? <InfoRow icon="location-outline" label={user.workshop_address} /> : null}
        {user.workshop_service_area ? (
          <InfoRow icon="map-outline" label={user.workshop_service_area} />
        ) : null}
        {user.workshop_hours ? <InfoRow icon="time-outline" label={user.workshop_hours} /> : null}
        {user.workshop_phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${user.workshop_phone}`)}>
            <InfoRow icon="call-outline" label={user.workshop_phone} accent />
          </Pressable>
        ) : null}
        {user.workshop_website ? (
          <Pressable onPress={() => Linking.openURL(user.workshop_website!)}>
            <InfoRow icon="globe-outline" label={user.workshop_website} accent />
          </Pressable>
        ) : null}
      </View>

      {!isSelf && (user.workshop_phone || user.workshop_booking_url) ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {user.workshop_phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${user.workshop_phone}`)}
              className="rounded-lg bg-accent px-3 py-2"
            >
              <Text className="text-sm font-semibold text-white">Call</Text>
            </Pressable>
          ) : null}
          {user.workshop_booking_url ? (
            <Pressable
              onPress={() => Linking.openURL(user.workshop_booking_url!)}
              className="rounded-lg border border-apple-border px-3 py-2"
            >
              <Text className="text-sm font-semibold text-apple-ink">Book</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isSelf ? (
        <View className="mt-4 gap-2 rounded-xl border border-apple-border bg-apple-bg2 p-3">
          <Text className="text-sm font-semibold text-apple-ink">Business tools</Text>
          <Text className="text-xs text-apple-secondary">
            Manage enquiries, portfolio, and customer jobs from settings.
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            <ToolChip label="Business info" onPress={() => router.push('/workshop/profile-edit')} />
            <ToolChip label="Jobs" onPress={() => router.push('/workshop/jobs')} />
            <ToolChip label="Enquiries" onPress={() => router.push('/workshop/enquiries')} />
            <ToolChip label="Portfolio" onPress={() => router.push('/workshop/portfolio')} />
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator className="mt-4" color={colors.accent} />
      ) : (
        <>
          {portfolio.length > 0 ? (
            <View className="mt-5">
              <Text className="text-sm font-bold text-apple-ink">Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                {portfolio.map((item) => (
                  <View
                    key={item.id}
                    className="mr-3 w-52 overflow-hidden rounded-xl border border-apple-border bg-apple-bg2"
                  >
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={{ width: '100%', height: 120 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="h-24 items-center justify-center">
                        <Ionicons name="image-outline" size={28} color={colors.tertiary} />
                      </View>
                    )}
                    <View className="p-2">
                      <Text className="text-sm font-semibold text-apple-ink">{item.title}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View className="mt-5">
            <Text className="text-sm font-bold text-apple-ink">Reviews</Text>
            {reviews.length === 0 ? (
              <Text className="mt-1 text-sm text-apple-secondary">No reviews yet.</Text>
            ) : (
              <View className="mt-2 gap-2">
                {reviews.map((r) => (
                  <View key={r.id} className="rounded-xl border border-apple-border bg-apple-bg2 p-3">
                    <Text className="text-sm font-semibold text-apple-ink">
                      {'★'.repeat(r.rating)}
                      {r.reviewer?.display_name ? ` · ${r.reviewer.display_name}` : ''}
                    </Text>
                    {r.body ? (
                      <Text className="mt-1 text-sm text-apple-secondary">{r.body}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>

          {!isSelf && canReview && session ? (
            <View className="mt-5 rounded-xl border border-apple-border bg-apple-bg2 p-3">
              <Text className="text-sm font-semibold text-apple-ink">Leave a review</Text>
              <TextInput
                value={myReviewBody}
                onChangeText={setMyReviewBody}
                placeholder={`How was ${businessName}?`}
                placeholderTextColor="#A1A1A6"
                multiline
                className="mt-2 min-h-[72px] rounded-lg border border-apple-border bg-white px-3 py-2 text-sm text-apple-ink"
              />
              <Pressable
                onPress={() => void handleReview()}
                disabled={submittingReview}
                className="mt-2 self-start rounded-lg bg-accent px-4 py-2"
              >
                <Text className="text-sm font-semibold text-white">Submit review</Text>
              </Pressable>
            </View>
          ) : null}

          {!isSelf ? (
            <View className="mt-5 rounded-xl border border-apple-border bg-apple-bg2 p-3">
              <Text className="text-sm font-semibold text-apple-ink">Contact {businessName}</Text>
              <TextInput
                value={enquiryName}
                onChangeText={setEnquiryName}
                placeholder="Your name"
                placeholderTextColor="#A1A1A6"
                className="mt-2 rounded-lg border border-apple-border bg-white px-3 py-2 text-sm text-apple-ink"
              />
              <TextInput
                value={enquiryEmail}
                onChangeText={setEnquiryEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#A1A1A6"
                className="mt-2 rounded-lg border border-apple-border bg-white px-3 py-2 text-sm text-apple-ink"
              />
              <TextInput
                value={enquiryMessage}
                onChangeText={setEnquiryMessage}
                placeholder="Message"
                multiline
                placeholderTextColor="#A1A1A6"
                className="mt-2 min-h-[80px] rounded-lg border border-apple-border bg-white px-3 py-2 text-sm text-apple-ink"
              />
              <Pressable
                onPress={() => void handleEnquiry()}
                disabled={sendingEnquiry}
                className="mt-2 rounded-lg bg-accent py-2.5"
              >
                <Text className="text-center text-sm font-semibold text-white">Send message</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color={accent ? colors.accent : colors.secondary} />
      <Text className={`flex-1 text-sm ${accent ? 'text-accent' : 'text-apple-secondary'}`}>
        {label}
      </Text>
    </View>
  );
}

function ToolChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-full border border-apple-border bg-white px-3 py-1.5">
      <Text className="text-xs font-semibold text-accent">{label}</Text>
    </Pressable>
  );
}
