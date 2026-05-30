import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { toolCostLabel, toolLabel, type ModToolSummary } from '@/lib/mod-tools';
import { navigateToModTool } from '@/lib/product-nav';
import { colors } from '@/lib/theme';

type Props = {
  tools: ModToolSummary[];
};

export function ModToolsDisplay({ tools }: Props) {
  const router = useRouter();
  if (tools.length === 0) return null;

  return (
    <View className="mt-4 gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
        Tools used
      </Text>
      {tools.map((tool) => (
        <Pressable
          key={tool.id}
          onPress={() => navigateToModTool(router, tool.id)}
          className="flex-row items-center gap-3 rounded-xl border border-apple-border bg-apple-bg2 p-3 active:opacity-80"
        >
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-apple-surface">
            <Ionicons name="construct-outline" size={18} color={colors.accent} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-apple-ink" numberOfLines={1}>
              {toolLabel(tool)}
            </Text>
            <Text className="mt-0.5 text-xs text-apple-secondary">
              {tool.ownership === 'hired' ? 'Hired · ' : 'Owned · '}
              {toolCostLabel(tool)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.tertiary} />
        </Pressable>
      ))}
    </View>
  );
}
