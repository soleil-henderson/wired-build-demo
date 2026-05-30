import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { formatCompactMoney, type GarageVehicleCard } from '@/lib/garage-cards';
import { cardShadow, colors } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

type Props = {
  vehicle: GarageVehicleCard;
  onPress?: () => void;
};

export function VehicleGarageCard({ vehicle, onPress }: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const [coverFailed, setCoverFailed] = useState(false);

  const ymm = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const title = vehicle.nickname ?? ymm;
  const subtitle = (
    vehicle.nickname ? [ymm, vehicle.trim] : [vehicle.trim]
  )
    .filter(Boolean)
    .join(' · ');

  const catTotal = vehicle.spend_by_category.reduce((s, c) => s + c.total, 0);
  const showCover = Boolean(vehicle.cover_photo_url) && !coverFailed;

  const openVehicle = () => {
    if (onPress) onPress();
    else router.push(`/vehicle/${vehicle.id}`);
  };

  return (
    <Pressable onPress={openVehicle} className="active:opacity-95">
      <View
        style={{
          borderRadius: theme.borderRadius.card + 6,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          ...cardShadow,
        }}
      >
        <View style={{ height: 172, position: 'relative' }}>
          {showCover ? (
            <>
              <Image
                source={{ uri: vehicle.cover_photo_url! }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={() => setCoverFailed(true)}
              />
              <HeroOverlay withPhoto />
            </>
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: '#3d5c45',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="car-sport-outline"
                size={72}
                color="rgba(255,255,255,0.22)"
              />
              <HeroOverlay />
            </View>
          )}

          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              router.push(`/vehicle/edit?vehicleId=${vehicle.id}`);
            }}
            hitSlop={8}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          >
            <Ionicons name="camera-outline" size={14} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Edit</Text>
          </Pressable>

          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 14,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: '#fff',
                letterSpacing: -0.5,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 14,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.88)',
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile
              label="Invested"
              value={formatCompactMoney(vehicle.total_spend)}
              valueColor={colors.ink}
            />
            <StatTile
              label="Value"
              value={
                vehicle.build_value != null && vehicle.build_value > 0
                  ? formatCompactMoney(vehicle.build_value, 0)
                  : '—'
              }
              valueColor="#007AFF"
            />
            <StatTile
              label="Mods"
              value={String(vehicle.mod_count)}
              valueColor={colors.ink}
            />
            <StatTile
              label="Planned"
              value={formatCompactMoney(vehicle.planned_total)}
              valueColor="#FF8A00"
            />
          </View>

          <View
            style={{
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.ink,
                letterSpacing: -0.2,
              }}
            >
              Spend by category
            </Text>
            <Pressable
              onPress={() => router.push(`/vehicle/${vehicle.id}?tab=spend`)}
              hitSlop={8}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>
                Details
              </Text>
            </Pressable>
          </View>

          {vehicle.spend_by_category.length > 0 && catTotal > 0 ? (
            <>
              <View
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  height: 10,
                  borderRadius: 5,
                  overflow: 'hidden',
                  gap: 2,
                }}
              >
                {vehicle.spend_by_category.map((seg) => (
                  <View
                    key={seg.category}
                    style={{
                      flex: seg.total / catTotal,
                      backgroundColor: seg.color,
                      borderRadius: 2,
                    }}
                  />
                ))}
              </View>
              <View
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                {vehicle.spend_by_category.map((seg) => (
                  <View
                    key={seg.category}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: seg.color,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: colors.secondary,
                      }}
                    >
                      {seg.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text
              style={{
                marginTop: 8,
                fontSize: 13,
                color: colors.secondary,
              }}
            >
              Log mods with costs to see your breakdown.
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function HeroOverlay({ withPhoto = false }: { withPhoto?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        ...StyleSheetAbsoluteFill,
      }}
    >
      {withPhoto ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '70%',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />
      ) : (
        <>
          <View
            style={{
              ...StyleSheetAbsoluteFill,
              backgroundColor: 'rgba(30,50,38,0.45)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '55%',
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          />
        </>
      )}
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function StatTile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 12,
        backgroundColor: colors.bg2,
        paddingVertical: 10,
        paddingHorizontal: 4,
      }}
    >
      <Text
        style={{
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '700',
          color: valueColor,
          letterSpacing: -0.3,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 2,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: '500',
          color: colors.secondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
