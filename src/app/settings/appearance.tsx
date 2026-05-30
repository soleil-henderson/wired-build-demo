import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { APP_THEMES } from '@/lib/themes/definitions';
import { useTheme } from '@/lib/theme-context';
import type { AppTheme } from '@/lib/themes/types';

export default function AppearanceSettingsScreen() {
  const { themeId, setThemeId } = useTheme();
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-4 pb-28 pt-2">
      <Stack.Screen options={{ title: 'Appearance' }} />

      <Text className="mb-1 px-1 text-[15px] font-semibold text-apple-ink">App theme</Text>
      <Text className="mb-5 px-1 text-sm text-apple-secondary">
        Match the app to your car culture — colours, contrast, and vibe. Wired Original is the
        default on every fresh install.
      </Text>

      <View className="gap-3">
        {APP_THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={themeId === theme.id}
            onSelect={() => {
              void setThemeId(theme.id);
            }}
          />
        ))}
      </View>

      <Pressable
        onPress={() => router.back()}
        className="mt-8 self-start rounded-xl border border-apple-border px-4 py-2.5"
      >
        <Text className="text-sm text-apple-secondary">Done</Text>
      </Pressable>
    </ScrollView>
  );
}

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: AppTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const c = theme.colors;

  return (
    <Pressable onPress={onSelect}>
      <AppleCard
        style={{
          padding: 0,
          overflow: 'hidden',
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? c.accent : c.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            minHeight: 96,
          }}
        >
          <View
            style={{
              width: 88,
              backgroundColor: c.bg2,
              padding: 10,
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                height: 28,
                borderRadius: theme.borderRadius.button,
                backgroundColor: c.accent,
              }}
            />
            <View
              style={{
                height: 10,
                borderRadius: 4,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(
                [
                  ['accent', c.accent],
                  ['blue', c.blue],
                  ['green', c.green],
                  ['amber', c.amber],
                ] as const
              ).map(([name, swatch]) => (
                <View
                  key={name}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: swatch,
                  }}
                />
              ))}
            </View>
          </View>

          <View
            style={{
              flex: 1,
              padding: 14,
              backgroundColor: c.surface,
              justifyContent: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>{theme.emoji}</Text>
              <Text
                style={{
                  fontSize: Math.round(16 * theme.typography.scale.heading),
                  fontWeight: '700',
                  color: c.ink,
                  letterSpacing: theme.typography.letterSpacing.heading,
                }}
              >
                {theme.name}
              </Text>
              {selected ? (
                <View
                  style={{
                    marginLeft: 'auto',
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: c.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <Text
              style={{
                marginTop: 4,
                fontSize: Math.round(13 * theme.typography.scale.caption),
                color: c.secondary,
                letterSpacing: theme.typography.letterSpacing.body,
              }}
            >
              {theme.tagline}
            </Text>
          </View>
        </View>
      </AppleCard>
    </Pressable>
  );
}
