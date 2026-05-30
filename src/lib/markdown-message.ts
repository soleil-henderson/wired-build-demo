export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'spacer' };

export type InlineSegment = { text: string; bold?: boolean; italic?: boolean };

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const BULLET_RE = /^[-*•]\s+(.+)$/;
const NUMBERED_RE = /^\d+[.)]\s+(.+)$/;

/** Split assistant markdown into blocks (headings, lists, paragraphs). */
export function parseMarkdownBlocks(raw: string): MarkdownBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];

  const flushBullets = () => {
    if (bulletItems.length > 0) {
      blocks.push({ type: 'bullet', items: bulletItems });
      bulletItems = [];
    }
  };

  const flushNumbered = () => {
    if (numberedItems.length > 0) {
      blocks.push({ type: 'numbered', items: numberedItems });
      numberedItems = [];
    }
  };

  const flushLists = () => {
    flushBullets();
    flushNumbered();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushLists();
      blocks.push({ type: 'spacer' });
      continue;
    }

    const heading = HEADING_RE.exec(trimmed);
    if (heading) {
      flushLists();
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: heading[2].trim() });
      continue;
    }

    const bullet = BULLET_RE.exec(trimmed);
    if (bullet) {
      flushNumbered();
      bulletItems.push(bullet[1].trim());
      continue;
    }

    const numbered = NUMBERED_RE.exec(trimmed);
    if (numbered) {
      flushBullets();
      numberedItems.push(numbered[1].trim());
      continue;
    }

    flushLists();
    blocks.push({ type: 'paragraph', text: trimmed });
  }

  flushLists();
  return blocks;
}

/** Parse inline **bold**, *italic*, and `code` within a single line. */
export function parseInlineMarkdown(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      segments.push({ text: line.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('*')) {
      segments.push({ text: token.slice(1, -1), italic: true });
    } else if (token.startsWith('_')) {
      segments.push({ text: token.slice(1, -1), italic: true });
    } else if (token.startsWith('`')) {
      segments.push({ text: token.slice(1, -1), bold: true });
    }
    last = match.index + token.length;
  }

  if (last < line.length) {
    segments.push({ text: line.slice(last) });
  }

  if (segments.length === 0) {
    segments.push({ text: line });
  }

  return segments;
}
