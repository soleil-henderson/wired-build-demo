import { Stack } from 'expo-router';
import { ScrollView, Text } from 'react-native';

export default function TermsScreen() {
  return (
    <ScrollView className="flex-1 bg-ink-950" contentContainerClassName="px-6 py-8 pb-24">
      <Stack.Screen options={{ title: 'Terms of service' }} />
      <Text className="text-2xl font-bold text-white">Terms of service</Text>
      <Text className="mt-4 text-ink-200 leading-6">
        Wired Build is provided by Wired Automotive Group. Build valuations are estimates
        only and not formal appraisals. You are responsible for the accuracy of mod data
        you log.
      </Text>
      <Text className="mt-4 text-ink-200 leading-6">
        Ownership transfers recorded in the app are an audit trail for buyers and sellers;
        they do not replace legal title transfer or registration with your jurisdiction.
      </Text>
      <Text className="mt-4 text-ink-300 text-sm">
        Full terms to be published before public launch.
      </Text>
    </ScrollView>
  );
}
