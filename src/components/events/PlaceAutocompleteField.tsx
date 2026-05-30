import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { EventPlace } from '@/lib/event-place';
import { searchPlaces, resolvePlace } from '@/lib/places-autocomplete';
import { colors } from '@/lib/theme';
import { inputClassName } from '@/lib/theme';

type Props = {
  value: EventPlace | null;
  displayText: string;
  onDisplayTextChange: (text: string) => void;
  onPlaceResolved: (place: EventPlace | null) => void;
};

export function PlaceAutocompleteField({
  value,
  displayText,
  onDisplayTextChange,
  onPlaceResolved,
}: Props) {
  const [predictions, setPredictions] = useState<
    Awaited<ReturnType<typeof searchPlaces>>
  >([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  useEffect(() => {
    if (value && displayText === value.formatted_address) {
      setPredictions([]);
      return;
    }
    const term = displayText.trim();
    if (term.length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }

    const t = ++token.current;
    setSearching(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const hits = await searchPlaces(term);
        if (token.current === t) setPredictions(hits);
      } catch (err) {
        if (token.current === t) {
          setPredictions([]);
          setError(err instanceof Error ? err.message : 'Search failed');
        }
      } finally {
        if (token.current === t) setSearching(false);
      }
    }, 280);

    return () => clearTimeout(handle);
  }, [displayText, value]);

  async function pickPrediction(placeId: string, label: string) {
    setResolving(true);
    setError(null);
    try {
      const place = await resolvePlace(placeId);
      onDisplayTextChange(place.formatted_address || label);
      onPlaceResolved(place);
      setPredictions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load place');
      onPlaceResolved(null);
    } finally {
      setResolving(false);
    }
  }

  return (
    <View>
      <View className="relative">
        <TextInput
          value={displayText}
          onChangeText={(text) => {
            onDisplayTextChange(text);
            if (value) onPlaceResolved(null);
          }}
          placeholder="Search on Google Maps…"
          placeholderTextColor={colors.tertiary}
          className={inputClassName}
          autoCorrect={false}
        />
        {searching || resolving ? (
          <View className="absolute right-3 top-3">
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          <View className="absolute right-3 top-3">
            <Ionicons name="map-outline" size={20} color={colors.tertiary} />
          </View>
        )}
      </View>

      {value ? (
        <Text className="mt-1.5 text-[12px] text-signal-green">
          Location pinned on Google Maps
        </Text>
      ) : displayText.trim().length >= 2 ? (
        <Text className="mt-1.5 text-[12px] text-apple-tertiary">
          Pick a suggestion to pin the map location
        </Text>
      ) : null}

      {error ? (
        <Text className="mt-1 text-[12px] text-red-600">{error}</Text>
      ) : null}

      {predictions.length > 0 ? (
        <View className="mt-2 overflow-hidden rounded-xl border border-apple-border bg-white">
          {predictions.map((p, i) => (
            <Pressable
              key={p.place_id}
              onPress={() => pickPrediction(p.place_id, p.description)}
              className={`flex-row items-start gap-2 px-3 py-3 active:bg-apple-bg2 ${
                i < predictions.length - 1 ? 'border-b border-apple-border' : ''
              }`}
            >
              <Ionicons name="location-outline" size={18} color={colors.blue} />
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-apple-ink">{p.main_text}</Text>
                {p.secondary_text ? (
                  <Text className="text-[13px] text-apple-secondary">{p.secondary_text}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
