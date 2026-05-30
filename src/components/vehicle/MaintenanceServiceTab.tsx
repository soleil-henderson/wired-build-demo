import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { MoneyText } from '@/components/apple/ApplePrimitives';
import { showAppAlert } from '@/lib/app-alert';
import {
  countDueRecords,
  formatServiceDate,
  getDueStatus,
  listMaintenanceRecords,
  maintenanceTypeIcon,
  maintenanceTypeLabel,
  type MaintenanceRecordWithDocuments,
} from '@/lib/maintenance-records';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { openVehicleDocument } from '@/lib/vehicle-documents';

type Props = {
  vehicleId: string;
};

export function MaintenanceServiceTab({ vehicleId }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<MaintenanceRecordWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await listMaintenanceRecords(vehicleId);
      setRecords(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load service history';
      showAppAlert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && records.length === 0) setLoading(true);
      return load();
    },
    [load],
    { cacheKey: vehicleId }
  );

  const dueCounts = countDueRecords(records);

  if (loading && records.length === 0) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View className="pb-6">
      {(dueCounts.overdue > 0 || dueCounts.dueSoon > 0) && (
        <AppleCard
          style={{
            padding: 14,
            marginBottom: 12,
            backgroundColor: dueCounts.overdue > 0 ? '#FFF1F0' : colors.amberSoft,
          }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={dueCounts.overdue > 0 ? colors.red : colors.amber}
            />
            <Text
              className="flex-1 text-sm font-semibold"
              style={{ color: dueCounts.overdue > 0 ? colors.red : colors.amber }}
            >
              {dueCounts.overdue > 0
                ? `${dueCounts.overdue} overdue · ${dueCounts.dueSoon} due soon`
                : `${dueCounts.dueSoon} due within 30 days`}
            </Text>
          </View>
        </AppleCard>
      )}

      <Pressable
        onPress={() => router.push(`/vehicle/maintenance/new?vehicleId=${vehicleId}`)}
        className="mb-4 flex-row items-center justify-center gap-2 rounded-xl bg-accent py-3 active:opacity-90"
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-base font-semibold text-white">Log service or renewal</Text>
      </Pressable>

      {records.length === 0 ? (
        <View className="items-center py-10">
          <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-apple-bg2">
            <Ionicons name="construct-outline" size={32} color={colors.tertiary} />
          </View>
          <Text className="text-xl font-bold text-apple-ink">Service history</Text>
          <Text className="mt-2 max-w-[280px] text-center text-[15px] leading-[22px] text-apple-secondary">
            Track oil changes, services, registration, insurance, and attach receipts or certificates.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {records.map((record) => (
            <MaintenanceRecordCard
              key={record.id}
              record={record}
              onPress={() =>
                router.push(`/vehicle/maintenance/${record.id}?vehicleId=${vehicleId}`)
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

function MaintenanceRecordCard({
  record,
  onPress,
}: {
  record: MaintenanceRecordWithDocuments;
  onPress: () => void;
}) {
  const dueStatus = getDueStatus(record.next_due_date);
  const iconName = maintenanceTypeIcon(record.record_type) as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable onPress={onPress}>
      <AppleCard style={{ padding: 16 }}>
        <View className="flex-row gap-3">
          <View className="h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-apple-bg2">
            <Ionicons name={iconName} size={22} color={colors.accent} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="mb-1 flex-row flex-wrap items-center gap-2">
              <View className="rounded-md bg-accent-soft px-2 py-0.5">
                <Text className="text-[11px] font-semibold uppercase text-accent">
                  {maintenanceTypeLabel(record.record_type)}
                </Text>
              </View>
              {dueStatus === 'overdue' ? (
                <DueBadge label="Overdue" color={colors.red} />
              ) : dueStatus === 'due_soon' ? (
                <DueBadge label="Due soon" color={colors.amber} />
              ) : null}
            </View>
            <Text className="text-[17px] font-semibold text-apple-ink" numberOfLines={2}>
              {record.title}
            </Text>
            <Text className="mt-0.5 text-sm text-apple-secondary">
              {formatServiceDate(record.service_date, record.date_is_approximate)}
              {record.odometer_km != null ? ` · ${record.odometer_km.toLocaleString()} km` : ''}
            </Text>
            {record.provider ? (
              <Text className="mt-0.5 text-sm text-apple-secondary">{record.provider}</Text>
            ) : null}
            <View className="mt-3 flex-row flex-wrap items-center gap-4 border-t border-apple-border pt-3">
              {record.cost != null ? (
                <View>
                  <Text className="text-xs text-apple-secondary">Cost</Text>
                  <MoneyText
                    value={Number(record.cost)}
                    size={15}
                    color={colors.accent}
                    weight="700"
                  />
                </View>
              ) : null}
              {record.next_due_date ? (
                <View>
                  <Text className="text-xs text-apple-secondary">Next due</Text>
                  <Text className="text-sm font-semibold text-apple-ink">
                    {formatServiceDate(record.next_due_date)}
                  </Text>
                </View>
              ) : null}
              {record.documents.length > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="document-attach-outline" size={14} color={colors.blue} />
                  <Text className="text-xs font-semibold text-signal-blue">
                    {record.documents.length} doc{record.documents.length === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : null}
            </View>
            {record.documents.length > 0 ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {record.documents.slice(0, 2).map((doc) => (
                  <Pressable
                    key={doc.id}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      void openVehicleDocument(doc).catch((err) => {
                        showAppAlert(
                          'Could not open',
                          err instanceof Error ? err.message : 'Try again.'
                        );
                      });
                    }}
                    className="rounded-lg bg-apple-bg2 px-2.5 py-1 active:opacity-70"
                  >
                    <Text className="text-xs font-medium text-signal-blue" numberOfLines={1}>
                      {doc.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
        </View>
      </AppleCard>
    </Pressable>
  );
}

function DueBadge({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: `${color}18` }}>
      <Text className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
