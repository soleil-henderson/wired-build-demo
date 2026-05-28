import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">FEED</Text>
        <Text className="mt-1 text-3xl font-bold text-white">What&apos;s being built</Text>
        <Text className="mt-2 text-ink-300">
          Posts from people you follow and trending builds in your make.
        </Text>

        <View className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <Text className="text-ink-200 text-base font-semibold">No posts yet</Text>
          <Text className="mt-1 text-ink-300">
            Once you and other builders log mods, they&apos;ll appear here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
