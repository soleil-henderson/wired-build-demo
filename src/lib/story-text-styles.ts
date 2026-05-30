import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** Instagram-style story text fonts (tap text to cycle). */
export type StoryTextStyleName =
  | 'classic'
  | 'modern'
  | 'neon'
  | 'typewriter'
  | 'strong'
  | 'serif';

/** Instagram-style story text colors (palette at top while typing). */
export type StoryTextColorId =
  | 'white'
  | 'black'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'cyan'
  | 'green';

export const STORY_TEXT_STYLE_ORDER: StoryTextStyleName[] = [
  'classic',
  'modern',
  'neon',
  'typewriter',
  'strong',
  'serif',
];

export const STORY_TEXT_COLORS: { id: StoryTextColorId; hex: string }[] = [
  { id: 'white', hex: '#FFFFFF' },
  { id: 'black', hex: '#000000' },
  { id: 'yellow', hex: '#FFFC00' },
  { id: 'orange', hex: '#FF9500' },
  { id: 'red', hex: '#FF3B30' },
  { id: 'pink', hex: '#FF2D55' },
  { id: 'purple', hex: '#AF52DE' },
  { id: 'blue', hex: '#007AFF' },
  { id: 'cyan', hex: '#5AC8FA' },
  { id: 'green', hex: '#34C759' },
];

const COLOR_HEX: Record<StoryTextColorId, string> = Object.fromEntries(
  STORY_TEXT_COLORS.map((c) => [c.id, c.hex])
) as Record<StoryTextColorId, string>;

/** @deprecated Use StoryTextStyleName */
export type StoryTextStyle = StoryTextStyleName;

export function normalizeStoryTextStyle(
  style: StoryTextStyleName | 'plain' | string | undefined | null
): StoryTextStyleName {
  if (style === 'plain') return 'classic';
  if (style && STORY_TEXT_STYLE_ORDER.includes(style as StoryTextStyleName)) {
    return style as StoryTextStyleName;
  }
  if (style === 'strong') return 'strong';
  return 'classic';
}

export function normalizeStoryTextColor(
  color: string | undefined | null
): StoryTextColorId {
  if (color && color in COLOR_HEX) return color as StoryTextColorId;
  if (color?.startsWith('#')) {
    const match = STORY_TEXT_COLORS.find(
      (c) => c.hex.toLowerCase() === color.toLowerCase()
    );
    if (match) return match.id;
  }
  return 'white';
}

export function nextStoryTextStyle(current: StoryTextStyleName): StoryTextStyleName {
  const index = STORY_TEXT_STYLE_ORDER.indexOf(current);
  const next = (index + 1) % STORY_TEXT_STYLE_ORDER.length;
  return STORY_TEXT_STYLE_ORDER[next] ?? 'classic';
}

export function storyTextStyleLabel(style: StoryTextStyleName): string {
  switch (style) {
    case 'classic':
      return 'Classic';
    case 'modern':
      return 'Modern';
    case 'neon':
      return 'Neon';
    case 'typewriter':
      return 'Typewriter';
    case 'strong':
      return 'Strong';
    case 'serif':
      return 'Serif';
  }
}

function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOnBackground(bgHex: string): string {
  return luminance(bgHex) > 0.55 ? '#000000' : '#FFFFFF';
}

export type StoryTextResolved = {
  styleName: StoryTextStyleName;
  colorId: StoryTextColorId;
  textStyle: TextStyle;
  containerStyle?: ViewStyle;
  placeholderColor: string;
};

export function resolveStoryTextAppearance(
  styleName: StoryTextStyleName,
  colorId: StoryTextColorId
): StoryTextResolved {
  const hex = COLOR_HEX[colorId];
  const baseSize = 32;

  switch (styleName) {
    case 'modern':
      return {
        styleName,
        colorId,
        placeholderColor: 'rgba(255,255,255,0.45)',
        textStyle: {
          fontSize: 34,
          fontWeight: '800',
          color: hex,
          textAlign: 'center',
          letterSpacing: 0.3,
        },
      };

    case 'neon':
      return {
        styleName,
        colorId,
        placeholderColor: 'rgba(255,255,255,0.45)',
        textStyle: {
          fontSize: baseSize,
          fontWeight: '700',
          color: hex,
          textAlign: 'center',
          textShadowColor: hex,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 12,
        },
      };

    case 'typewriter':
      return {
        styleName,
        colorId,
        placeholderColor: 'rgba(255,255,255,0.45)',
        textStyle: {
          fontSize: 28,
          fontWeight: '400',
          color: hex,
          textAlign: 'center',
          fontFamily: Platform.select({
            ios: 'Courier',
            android: 'monospace',
            default: 'monospace',
          }),
          letterSpacing: 1,
        },
      };

    case 'strong': {
      const onBg = contrastOnBackground(hex);
      return {
        styleName,
        colorId,
        placeholderColor: 'rgba(255,255,255,0.5)',
        containerStyle: {
          backgroundColor: hex,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
          maxWidth: 300,
        },
        textStyle: {
          fontSize: baseSize,
          fontWeight: '700',
          color: onBg,
          textAlign: 'center',
        },
      };
    }

    case 'serif':
      return {
        styleName,
        colorId,
        placeholderColor: 'rgba(255,255,255,0.45)',
        textStyle: {
          fontSize: 34,
          fontWeight: '400',
          fontStyle: 'italic',
          color: hex,
          textAlign: 'center',
          fontFamily: Platform.select({
            ios: 'Georgia',
            android: 'serif',
            default: 'Georgia',
          }),
        },
      };

    case 'classic':
    default:
      return {
        styleName: 'classic',
        colorId,
        placeholderColor: 'rgba(255,255,255,0.45)',
        textStyle: {
          fontSize: baseSize,
          fontWeight: '700',
          color: hex,
          textAlign: 'center',
          textShadowColor: 'rgba(0,0,0,0.75)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 5,
        },
      };
  }
}

export function isValidStoryTextStyle(value: string): value is StoryTextStyleName {
  return STORY_TEXT_STYLE_ORDER.includes(value as StoryTextStyleName)
    || value === 'plain';
}

export function isValidStoryTextColor(value: string): value is StoryTextColorId {
  return value in COLOR_HEX;
}
