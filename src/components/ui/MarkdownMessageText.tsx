import { Text, View, type TextStyle } from 'react-native';

import {
  parseInlineMarkdown,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from '@/lib/markdown-message';

type Variant = 'assistant' | 'user';

type Props = {
  children: string;
  variant?: Variant;
};

const headingSize: Record<1 | 2 | 3, number> = { 1: 20, 2: 17, 3: 16 };

export function MarkdownMessageText({ children, variant = 'assistant' }: Props) {
  const blocks = parseMarkdownBlocks(children);
  const isUser = variant === 'user';

  const baseColor = isUser ? '#FFFFFF' : undefined;
  const baseClass = isUser ? 'text-white' : 'text-apple-ink';
  const secondaryClass = isUser ? 'text-white/90' : 'text-apple-secondary';

  return (
    <View className="gap-1.5">
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          baseClass={baseClass}
          secondaryClass={secondaryClass}
          baseColor={baseColor}
          isUser={isUser}
        />
      ))}
    </View>
  );
}

function BlockView({
  block,
  baseClass,
  secondaryClass,
  baseColor,
  isUser,
}: {
  block: MarkdownBlock;
  baseClass: string;
  secondaryClass: string;
  baseColor?: string;
  isUser: boolean;
}) {
  if (block.type === 'spacer') {
    return <View className="h-1" />;
  }

  if (block.type === 'heading') {
    return (
      <InlineText
        segments={parseInlineMarkdown(block.text)}
        className={`${baseClass} font-bold`}
        style={{
          fontSize: headingSize[block.level],
          lineHeight: headingSize[block.level] + 6,
          color: baseColor,
          marginTop: block.level === 3 ? 4 : 6,
        }}
        isUser={isUser}
      />
    );
  }

  if (block.type === 'bullet') {
    return (
      <View className="gap-1 pl-1">
        {block.items.map((item, i) => (
          <View key={i} className="flex-row gap-2">
            <Text
              className={`text-[15px] leading-[20px] ${secondaryClass}`}
              style={baseColor ? { color: baseColor } : undefined}
            >
              {'\u2022'}
            </Text>
            <View className="flex-1">
              <InlineText
                segments={parseInlineMarkdown(item)}
                className={`${baseClass} text-[15px] leading-[20px]`}
                style={baseColor ? { color: baseColor } : undefined}
                isUser={isUser}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (block.type === 'numbered') {
    return (
      <View className="gap-1 pl-1">
        {block.items.map((item, i) => (
          <View key={i} className="flex-row gap-2">
            <Text
              className={`min-w-[18px] text-[15px] leading-[20px] ${secondaryClass}`}
              style={baseColor ? { color: baseColor } : undefined}
            >
              {`${i + 1}.`}
            </Text>
            <View className="flex-1">
              <InlineText
                segments={parseInlineMarkdown(item)}
                className={`${baseClass} text-[15px] leading-[20px]`}
                style={baseColor ? { color: baseColor } : undefined}
                isUser={isUser}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <InlineText
      segments={parseInlineMarkdown(block.text)}
      className={`${baseClass} text-[15px] leading-[20px]`}
      style={baseColor ? { color: baseColor } : undefined}
      isUser={isUser}
    />
  );
}

function InlineText({
  segments,
  className,
  style,
  isUser,
}: {
  segments: ReturnType<typeof parseInlineMarkdown>;
  className: string;
  style?: TextStyle;
  isUser: boolean;
}) {
  return (
    <Text className={className} style={style}>
      {segments.map((seg, i) => {
        if (!seg.bold && !seg.italic) {
          return <Text key={i}>{seg.text}</Text>;
        }
        return (
          <Text
            key={i}
            style={{
              fontWeight: seg.bold ? '700' : style?.fontWeight,
              fontStyle: seg.italic ? 'italic' : undefined,
              color: isUser ? '#FFFFFF' : style?.color,
            }}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}
