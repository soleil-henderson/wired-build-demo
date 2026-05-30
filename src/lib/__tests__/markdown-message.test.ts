import { describe, expect, it } from 'vitest';

import { parseInlineMarkdown, parseMarkdownBlocks } from '../markdown-message';

describe('parseMarkdownBlocks', () => {
  it('parses headings and bullets', () => {
    const blocks = parseMarkdownBlocks('### Hello\n\n- one\n- two');
    expect(blocks[0]).toEqual({ type: 'heading', level: 3, text: 'Hello' });
    expect(blocks[2]).toEqual({ type: 'bullet', items: ['one', 'two'] });
  });
});

describe('parseInlineMarkdown', () => {
  it('parses bold segments', () => {
    const segs = parseInlineMarkdown('**bold** plain');
    expect(segs).toEqual([
      { text: 'bold', bold: true },
      { text: ' plain' },
    ]);
  });
});
