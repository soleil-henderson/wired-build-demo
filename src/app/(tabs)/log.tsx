import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LogScreen() {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">LOG</Text>
        <Text className="mt-1 text-3xl font-bold text-white">Log a mod</Text>
        <Text className="mt-2 text-ink-300">
          Target: under 90 seconds. Photo → part → cost → confirm.
        </Text>

        <View className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <Text className="text-ink-200 text-base font-semibold">Coming in Step 2</Text>
          <Text className="mt-1 text-ink-300">
            The log flow ships as the next milestone, once a vehicle exists in your garage.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
