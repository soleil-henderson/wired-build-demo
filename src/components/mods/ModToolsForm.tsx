import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  emptyToolDraft,
  type ModToolDraft,
  type ToolOwnership,
} from '@/lib/mod-tools';
import { colors } from '@/lib/theme';

type Props = {
  tools: ModToolDraft[];
  onChange: (tools: ModToolDraft[]) => void;
};

export function ModToolsForm({ tools, onChange }: Props) {
  function updateTool(index: number, patch: Partial<ModToolDraft>) {
    const next = tools.map((t, i) => (i === index ? { ...t, ...patch } : t));
    onChange(next);
  }

  function removeTool(index: number) {
    onChange(tools.filter((_, i) => i !== index));
  }

  return (
    <View className="gap-4">
      {tools.length === 0 ? (
        <Text className="text-sm text-apple-secondary">
          Optional — jack, torque wrench, welder, hire gear, etc.
        </Text>
      ) : null}

      {tools.map((tool, index) => (
        <View
          key={tool.id ?? `draft-${index}`}
          className="rounded-2xl border border-apple-border bg-apple-surface p-4"
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
              Tool {index + 1}
            </Text>
            <Pressable onPress={() => removeTool(index)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.red} />
            </Pressable>
          </View>

          <Field label="Tool name">
            <TextInput
              value={tool.name}
              onChangeText={(name) => updateTool(index, { name })}
              placeholder="e.g. Torque wrench, floor jack"
              placeholderTextColor={colors.tertiary}
              className="rounded-xl border border-apple-border bg-apple-bg2 px-4 py-3 text-apple-ink"
            />
          </Field>

          <Field label="Brand (optional)">
            <TextInput
              value={tool.brand}
              onChangeText={(brand) => updateTool(index, { brand })}
              placeholder="Milwaukee, Snap-on…"
              placeholderTextColor={colors.tertiary}
              className="rounded-xl border border-apple-border bg-apple-bg2 px-4 py-3 text-apple-ink"
            />
          </Field>

          <Field label="Product link (optional)">
            <TextInput
              value={tool.url}
              onChangeText={(url) => updateTool(index, { url })}
              placeholder="https://…"
              placeholderTextColor={colors.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="rounded-xl border border-apple-border bg-apple-bg2 px-4 py-3 text-apple-ink"
            />
          </Field>

          <Field label="How did you get it?">
            <View className="flex-row gap-2">
              <OwnershipChip
                label="I own it"
                active={tool.ownership === 'owned'}
                onPress={() => updateTool(index, { ownership: 'owned', hire_duration: '' })}
              />
              <OwnershipChip
                label="Hired / rented"
                active={tool.ownership === 'hired'}
                onPress={() => updateTool(index, { ownership: 'hired' })}
              />
            </View>
          </Field>

          <Field label={tool.ownership === 'hired' ? 'Hire cost (AUD)' : 'Cost (AUD)'}>
            <View className="flex-row items-center rounded-xl border border-apple-border bg-apple-bg2 px-4">
              <Text className="text-apple-secondary">$</Text>
              <TextInput
                value={tool.cost}
                onChangeText={(cost) => updateTool(index, { cost })}
                placeholder="0.00"
                placeholderTextColor={colors.tertiary}
                keyboardType="decimal-pad"
                className="ml-2 flex-1 py-3 text-apple-ink"
              />
            </View>
          </Field>

          {tool.ownership === 'hired' ? (
            <Field label="Hire duration">
              <TextInput
                value={tool.hire_duration}
                onChangeText={(hire_duration) => updateTool(index, { hire_duration })}
                placeholder="e.g. 2 days, 1 weekend"
                placeholderTextColor={colors.tertiary}
                className="rounded-xl border border-apple-border bg-apple-bg2 px-4 py-3 text-apple-ink"
              />
            </Field>
          ) : null}
        </View>
      ))}

      <Pressable
        onPress={() => onChange([...tools, emptyToolDraft()])}
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-apple-border py-3.5 active:bg-apple-surface"
      >
        <Ionicons name="construct-outline" size={18} color={colors.accent} />
        <Text className="font-semibold text-accent">Add a tool</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-medium text-apple-secondary">{label}</Text>
      {children}
    </View>
  );
}

function OwnershipChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full border px-3 py-2.5 ${
        active ? 'border-accent bg-accent/10' : 'border-apple-border bg-apple-bg2'
      }`}
    >
      <Text
        className={`text-center text-xs font-semibold ${
          active ? 'text-accent' : 'text-apple-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
