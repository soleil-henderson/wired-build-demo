import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
  showPicker: boolean;
  onTogglePicker: () => void;
};

export function InstallDateField({ value, onChange, showPicker, onTogglePicker }: Props) {
  const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseIsoDate(value) : new Date();

  return (
    <View>
      <Pressable
        onPress={onTogglePicker}
        className="rounded-xl border border-apple-border bg-white px-4 py-3 active:bg-apple-bg2"
      >
        <Text className="font-mono text-apple-ink">{value || 'Pick date'}</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            if (selected) onChange(toIsoDate(selected));
            if (Platform.OS === 'android') onTogglePicker();
          }}
        />
      ) : null}
    </View>
  );
}
