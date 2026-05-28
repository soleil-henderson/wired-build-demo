/**
 * Heuristic receipt total extraction from OCR text lines (AU-focused).
 * Not perfect — always show a review hint when we auto-fill cost.
 */

export type ParsedReceiptTotal = {
  amount: number;
  confidence: 'high' | 'low';
};

const TOTAL_LINE =
  /\b(grand\s*)?total\b|\bamount\s*due\b|\bbalance\s*due\b|\bto\s*pay\b|\bpayment\s*due\b|\btotal\s*due\b|\baud\s*total\b/i;
const SUBTOTAL_LINE = /\bsub\s*-?\s*total\b/i;
const SKIP_LINE = /\bchange\b|\bcash\s*out\b|\btip\b|\bgratuity\b/i;

/** Pull the right-most money token on a line (totals are usually last). */
function parseAmountFromLine(line: string): number | null {
  const matches = [
    ...line.matchAll(
      /(?:AUD\s*)?\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?|(?:^|\s)(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})(?:\s|$)/gi
    ),
  ];
  if (matches.length === 0) return null;

  const last = matches[matches.length - 1];
  const whole = (last[1] ?? last[3]).replace(/,/g, '');
  const frac = last[2] ?? last[4] ?? '00';
  const value = Number.parseFloat(`${whole}.${frac}`);
  if (!Number.isFinite(value) || value <= 0 || value > 500_000) return null;
  return Math.round(value * 100) / 100;
}

function lineScore(line: string): number {
  if (SUBTOTAL_LINE.test(line) || SKIP_LINE.test(line)) return -100;
  if (TOTAL_LINE.test(line)) return 100;
  if (/\bgst\b|\btax\b/i.test(line)) return -20;
  return 0;
}

/**
 * Pick the most likely receipt total from OCR output.
 * Prefers lines labelled TOTAL / AMOUNT DUE; falls back to the largest
 * amount only when no labelled line is found (low confidence).
 */
export function parseReceiptTotal(lines: string[]): ParsedReceiptTotal | null {
  const normalized = lines.map((l) => l.trim()).filter(Boolean);
  if (normalized.length === 0) return null;

  let best: { amount: number; score: number } | null = null;
  let fallbackMax = 0;

  for (let i = 0; i < normalized.length; i++) {
    const line = normalized[i];
    const amount =
      parseAmountFromLine(line) ??
      (i + 1 < normalized.length && lineScore(line) >= 100
        ? parseAmountFromLine(normalized[i + 1])
        : null);

    if (amount == null) continue;
    if (amount > fallbackMax) fallbackMax = amount;

    const score = lineScore(line);
    if (score < 0) continue;

    if (!best || score > best.score || (score === best.score && amount > best.amount)) {
      best = { amount, score };
    }
  }

  if (best && best.score >= 100) {
    return { amount: best.amount, confidence: 'high' };
  }

  if (fallbackMax > 0) {
    return { amount: fallbackMax, confidence: 'low' };
  }

  return null;
}
