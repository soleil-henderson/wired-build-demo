import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

type Props = {
  startDate: Date;
  startTime: Date;
  onStartDateChange: (d: Date) => void;
  onStartTimeChange: (d: Date) => void;
};

export function EventDateTimeFields({
  startDate,
  startTime,
  onStartDateChange,
  onStartTimeChange,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const minimumDate = useMemo(() => new Date(), []);

  function handleDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'dismissed') return;
    }
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selected) onStartDateChange(selected);
  }

  function handleTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'dismissed') return;
    }
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (selected) onStartTimeChange(selected);
  }

  return (
    <View>
      <Text className="mb-1.5 mt-4 text-[13px] font-semibold text-apple-secondary">Starts</Text>
      <Pressable
        onPress={() => {
          setShowTimePicker(false);
          setShowDatePicker((v) => !v);
        }}
        className="mb-2 rounded-xl border border-apple-border bg-white px-4 py-3 active:bg-apple-bg2"
      >
        <Text className="text-apple-ink">
          {startDate.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </Pressable>

      {showDatePicker ? (
        <View className="mb-2 overflow-hidden rounded-xl border border-apple-border bg-white">
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            onChange={handleDateChange}
            themeVariant="light"
            style={Platform.OS === 'ios' ? { height: 216 } : undefined}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => setShowDatePicker(false)}
              className="border-t border-apple-border py-3 active:bg-apple-bg2"
            >
              <Text className="text-center font-semibold text-signal-blue">Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          setShowDatePicker(false);
          setShowTimePicker((v) => !v);
        }}
        className="mb-4 rounded-xl border border-apple-border bg-white px-4 py-3 active:bg-apple-bg2"
      >
        <Text className="text-apple-ink">
          {startTime.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </Pressable>

      {showTimePicker ? (
        <View className="mb-4 overflow-hidden rounded-xl border border-apple-border bg-white">
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            themeVariant="light"
            style={Platform.OS === 'ios' ? { height: 216 } : undefined}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => setShowTimePicker(false)}
              className="border-t border-apple-border py-3 active:bg-apple-bg2"
            >
              <Text className="text-center font-semibold text-signal-blue">Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function combineEventStartIso(startDate: Date, startTime: Date): string {
  const d = new Date(startDate);
  d.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
  return d.toISOString();
}
