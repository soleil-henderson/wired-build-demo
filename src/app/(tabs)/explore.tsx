import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">EXPLORE</Text>
        <Text className="mt-1 text-3xl font-bold text-white">Discover builds</Text>
        <Text className="mt-2 text-ink-300">
          Search users, vehicles, parts, and curated rows of builds.
        </Text>

        <View className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <Text className="text-ink-200 text-base font-semibold">Coming soon</Text>
          <Text className="mt-1 text-ink-300">Search and curated rows land in Step 4.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
