export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string | null;
};

export async function fetchGoogleSearch(
  query: string,
  apiKey: string,
  opts?: { limit?: number }
): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({
    engine: 'google',
    q: query.trim(),
    api_key: apiKey,
    num: String(Math.min(opts?.limit ?? 6, 10)),
    gl: 'au',
    hl: 'en',
    google_domain: 'google.com.au',
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = (await res.json()) as {
    error?: string;
    organic_results?: {
      title?: string;
      link?: string;
      snippet?: string;
      source?: string;
    }[];
    answer_box?: {
      title?: string;
      link?: string;
      snippet?: string;
      answer?: string;
    };
  };

  if (!res.ok || data.error) {
    console.error('[serp-search]', res.status, data.error);
    return [];
  }

  const out: WebSearchResult[] = [];

  const box = data.answer_box;
  if (box?.link && (box.snippet || box.answer)) {
    out.push({
      title: box.title?.trim() || 'Quick answer',
      url: box.link,
      snippet: (box.snippet ?? box.answer ?? '').trim(),
      source: 'Google',
    });
  }

  for (const row of data.organic_results ?? []) {
    const title = row.title?.trim();
    const url = row.link?.trim();
    if (!title || !url) continue;
    out.push({
      title,
      url,
      snippet: row.snippet?.trim() ?? '',
      source: row.source?.trim() ?? null,
    });
  }

  return dedupeResults(out).slice(0, opts?.limit ?? 6);
}

function dedupeResults(rows: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  const out: WebSearchResult[] = [];
  for (const row of rows) {
    const key = row.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function buildVehicleGuideQuery(input: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  topic: string;
}): string {
  const ymm = [input.year, input.make, input.model, input.trim].filter(Boolean).join(' ');
  const topic = input.topic.trim();
  return `${ymm} ${topic} DIY procedure oil capacity torque specs`.replace(/\s+/g, ' ').trim();
}
