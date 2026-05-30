import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { StoryStickerCanvas } from '@/components/stories/StoryStickerCanvas';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  STORY_EMOJI_STICKERS,
  createStickerId,
  createStoryFromAsset,
  pickStoryMedia,
  type StorySticker,
} from '@/lib/stories';
import type { StoryTextColorId, StoryTextStyleName } from '@/lib/story-text-styles';

export default function CreateStoryScreen() {
  const params = useLocalSearchParams<{
    uri?: string;
    type?: string;
    width?: string;
    height?: string;
    duration?: string;
    mimeType?: string;
  }>();
  const { session } = useAuth();
  const router = useRouter();
  const initialAsset = useMemo((): ImagePicker.ImagePickerAsset | null => {
    if (!params.uri) return null;
    return {
      uri: params.uri,
      type: params.type === 'video' ? 'video' : 'image',
      width: Number(params.width) || 0,
      height: Number(params.height) || 0,
      duration: params.duration ? Number(params.duration) : undefined,
      mimeType: params.mimeType || undefined,
    };
  }, [params]);

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(initialAsset);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [showStickers, setShowStickers] = useState(false);
  const [textComposeActive, setTextComposeActive] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [textStyle, setTextStyle] = useState<StoryTextStyleName>('classic');
  const [textColor, setTextColor] = useState<StoryTextColorId>('white');
  const [editingStickerId, setEditingStickerId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [profile, setProfile] = useState<{
    display_name: string;
    avatar_url: string | null;
  } | null>(null);

  const composeActive = textComposeActive || editingStickerId != null;

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    void supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setProfile({
            display_name: data.display_name,
            avatar_url: data.avatar_url,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  async function handlePick() {
    setPicking(true);
    try {
      const picked = await pickStoryMedia();
      if (picked) setAsset(picked);
    } catch (err) {
      Alert.alert('Could not open library', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setPicking(false);
    }
  }

  function addEmojiSticker(emoji: string) {
    setStickers((current) => [
      ...current,
      {
        id: createStickerId(),
        kind: 'emoji',
        content: emoji,
        x: 0.42 + Math.random() * 0.16,
        y: 0.32 + Math.random() * 0.16,
        scale: 1,
        rotation: 0,
      },
    ]);
    setShowStickers(false);
  }

  function openTextComposer() {
    setShowStickers(false);
    setTextDraft('');
    setTextStyle('classic');
    setTextColor('white');
    setEditingStickerId(null);
    setTextComposeActive(true);
  }

  function handleTextComposeDone() {
    const text = textDraft.trim();
    if (!text) {
      if (editingStickerId) {
        setStickers((current) => current.filter((s) => s.id !== editingStickerId));
      }
      setTextDraft('');
      setTextComposeActive(false);
      setEditingStickerId(null);
      return;
    }
    if (editingStickerId) {
      setStickers((current) =>
        current.map((s) =>
          s.id === editingStickerId
            ? { ...s, content: text, text_style: textStyle, text_color: textColor }
            : s
        )
      );
    } else {
      setStickers((current) => [
        ...current,
        {
          id: createStickerId(),
          kind: 'text',
          content: text,
          x: 0.5,
          y: 0.42,
          scale: 1,
          rotation: 0,
          text_style: textStyle,
          text_color: textColor,
        },
      ]);
    }
    setTextDraft('');
    setTextComposeActive(false);
    setEditingStickerId(null);
  }

  function handleTextComposeCancel() {
    setTextComposeActive(false);
    setEditingStickerId(null);
    setTextDraft('');
  }

  async function handlePost() {
    if (!session || !asset) return;
    Keyboard.dismiss();
    setPosting(true);
    try {
      await createStoryFromAsset({
        userId: session.user.id,
        asset,
        stickers,
      });
      router.back();
    } catch (err) {
      Alert.alert('Story failed', err instanceof Error ? err.message : 'Could not post story');
    } finally {
      setPosting(false);
    }
  }

  const isVideo = asset?.type === 'video';

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />

      {asset ? (
        <>
          <View className="flex-1">
            {isVideo ? (
              <VideoPreview uri={asset.uri} />
            ) : (
              <Image
                source={{ uri: asset.uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            )}
            <StoryStickerCanvas
              stickers={stickers}
              onStickersChange={setStickers}
              textComposeActive={textComposeActive}
              textDraft={textDraft}
              textStyle={textStyle}
              textColor={textColor}
              onTextDraftChange={setTextDraft}
              onTextStyleChange={setTextStyle}
              onTextColorChange={setTextColor}
              onTextComposeDone={handleTextComposeDone}
              onTextComposeCancel={handleTextComposeCancel}
              editingStickerId={editingStickerId}
              onEditingStickerIdChange={setEditingStickerId}
            />
          </View>

          <SafeAreaView edges={['top']} className="absolute inset-x-0 top-0 z-10" pointerEvents="box-none">
            <View className="flex-row items-center justify-between px-4 pt-2">
              {!composeActive ? (
                <Pressable onPress={() => router.back()} hitSlop={12}>
                  <Ionicons name="close" size={28} color="#fff" />
                </Pressable>
              ) : (
                <View className="w-7" />
              )}
              {!composeActive ? (
                <Pressable
                  onPress={() => {
                    setAsset(null);
                    setStickers([]);
                    setShowStickers(false);
                  }}
                  hitSlop={12}
                >
                  <Text className="font-semibold text-white">Retake</Text>
                </Pressable>
              ) : (
                <View className="w-16" />
              )}
            </View>
          </SafeAreaView>

          {!composeActive ? (
            <SafeAreaView
              edges={['bottom']}
              className="absolute inset-x-0 bottom-0 z-10"
              pointerEvents="box-none"
            >
              {showStickers ? (
                <View className="border-t border-white/10 bg-black/70 px-3 pb-2 pt-3">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row flex-wrap gap-2 px-1">
                      {STORY_EMOJI_STICKERS.map((emoji) => (
                        <Pressable
                          key={emoji}
                          onPress={() => addEmojiSticker(emoji)}
                          className="h-12 w-12 items-center justify-center rounded-xl bg-white/12 active:bg-white/20"
                        >
                          <Text className="text-[26px]">{emoji}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : null}

              <View className="px-4 pb-2 pt-2">
                <View className="mb-4 flex-row items-center justify-center gap-3">
                  <Pressable
                    onPress={() => {
                      setShowStickers((v) => !v);
                      setTextComposeActive(false);
                      setEditingStickerId(null);
                    }}
                    className={`flex-row items-center gap-2 rounded-full px-5 py-2.5 ${
                      showStickers ? 'bg-white' : 'bg-white/15'
                    }`}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={18}
                      color={showStickers ? '#000' : '#fff'}
                    />
                    <Text
                      className={`text-sm font-semibold ${showStickers ? 'text-black' : 'text-white'}`}
                    >
                      Stickers
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={openTextComposer}
                    className="flex-row items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 active:bg-white/25"
                  >
                    <Ionicons name="text-outline" size={18} color="#fff" />
                    <Text className="text-sm font-semibold text-white">Text</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => void handlePost()}
                  disabled={posting}
                  className="flex-row items-center justify-center rounded-full bg-white py-3 active:opacity-90 disabled:opacity-60"
                >
                  {posting ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <ProfileAvatar
                        uri={profile?.avatar_url ?? null}
                        name={profile?.display_name ?? 'You'}
                        size={26}
                        borderWidth={0}
                      />
                      <Text className="ml-2.5 text-[15px] font-semibold text-black">
                        Your story
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          ) : null}
        </>
      ) : (
        <View className="flex-1 bg-apple-bg2 px-6 pt-6">
          <Stack.Screen options={{ title: 'New story' }} />
          <Text className="text-apple-secondary">
            Share a photo or video. Stories disappear after 24 hours.
          </Text>
          <Pressable
            onPress={() => void handlePick()}
            disabled={picking}
            className="mt-8 items-center rounded-2xl border border-dashed border-apple-border bg-white py-16 active:bg-apple-bg2"
          >
            {picking ? (
              <ActivityIndicator color="#f97316" />
            ) : (
              <>
                <Text className="text-lg font-semibold text-apple-ink">Choose photo or video</Text>
                <Text className="mt-2 text-sm text-apple-secondary">Up to 60 seconds for video</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  try {
    const { Video, ResizeMode } = require('expo-av') as typeof import('expo-av');
    return (
      <Video
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={ResizeMode.COVER}
        useNativeControls
        isLooping
      />
    );
  } catch {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-white">Video selected</Text>
      </View>
    );
  }
}
