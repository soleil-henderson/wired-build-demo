import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { AccountType } from '@/types/database';

type Props = {
  value: AccountType;
  onChange: (value: AccountType) => void;
};

export function AccountTypePicker({ value, onChange }: Props) {
  return (
    <View className="mt-6 gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
        I am signing up as
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onChange('builder')}
          className={`flex-1 rounded-xl border px-3 py-3 ${
            value === 'builder'
              ? 'border-accent bg-accent/10'
              : 'border-apple-border bg-white'
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              value === 'builder' ? 'text-accent' : 'text-apple-ink'
            }`}
          >
            Builder
          </Text>
          <Text className="mt-1 text-center text-xs text-apple-secondary">
            Personal garage
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('workshop')}
          className={`flex-1 rounded-xl border px-3 py-3 ${
            value === 'workshop'
              ? 'border-accent bg-accent/10'
              : 'border-apple-border bg-white'
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              value === 'workshop' ? 'text-accent' : 'text-apple-ink'
            }`}
          >
            Business
          </Text>
          <Text className="mt-1 text-center text-xs text-apple-secondary">
            Workshop / shop
          </Text>
        </Pressable>
      </View>
      {value === 'workshop' ? (
        <Text className="text-xs text-apple-secondary">
          Same app and profile as everyone else — you&apos;ll add business details on your profile.
          Workshop plan ($50/mo) unlocks listing and leads.
        </Text>
      ) : null}
    </View>
  );
}

export function AccountTypeSignInLinks() {
  return (
    <View className="mt-8 gap-2 border-t border-apple-border pt-6">
      <Text className="text-center text-sm text-apple-secondary">Running a workshop or shop?</Text>
      <Link href="/(auth)/sign-up?account=workshop" className="text-center">
        <Text className="text-sm font-semibold text-accent">Create a business account</Text>
      </Link>
    </View>
  );
}
