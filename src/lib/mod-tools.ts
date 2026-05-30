import { supabase } from './supabase';

export type ToolOwnership = 'owned' | 'hired';

export type ModTool = {
  id: string;
  mod_id: string;
  name: string;
  brand: string | null;
  url: string | null;
  ownership: ToolOwnership;
  cost: number | null;
  hire_duration: string | null;
  sort_order: number;
};

/** Tool fields used in feed cards and product navigation (no mod_id). */
export type ModToolSummary = Pick<
  ModTool,
  'id' | 'name' | 'brand' | 'url' | 'ownership' | 'cost' | 'hire_duration' | 'sort_order'
>;

/** In-memory / form state before persisting. */
export type ModToolDraft = {
  id?: string;
  name: string;
  brand: string;
  url: string;
  ownership: ToolOwnership;
  cost: string;
  hire_duration: string;
};

export function emptyToolDraft(): ModToolDraft {
  return {
    name: '',
    brand: '',
    url: '',
    ownership: 'owned',
    cost: '',
    hire_duration: '',
  };
}

export function modToolToDraft(tool: ModTool): ModToolDraft {
  return {
    id: tool.id,
    name: tool.name,
    brand: tool.brand ?? '',
    url: tool.url ?? '',
    ownership: tool.ownership,
    cost: tool.cost != null ? String(tool.cost) : '',
    hire_duration: tool.hire_duration ?? '',
  };
}

function parseCost(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) || n < 0 ? null : n;
}

export function validateToolDrafts(tools: ModToolDraft[]): string | null {
  for (const t of tools) {
    const hasContent =
      t.name.trim() ||
      t.brand.trim() ||
      t.url.trim() ||
      t.cost.trim() ||
      t.hire_duration.trim();
    if (!hasContent) continue;
    if (!t.name.trim()) return 'Each tool needs a name.';
    if (t.ownership === 'hired' && !t.hire_duration.trim()) {
      return `How long did you hire “${t.name.trim()}” for?`;
    }
  }
  return null;
}

function draftsToRows(modId: string, tools: ModToolDraft[]) {
  return tools
    .filter(
      (t) =>
        t.name.trim() ||
        t.brand.trim() ||
        t.url.trim() ||
        t.cost.trim() ||
        t.hire_duration.trim()
    )
    .map((t, index) => ({
      mod_id: modId,
      name: t.name.trim(),
      brand: t.brand.trim() || null,
      url: t.url.trim() || null,
      ownership: t.ownership,
      cost: parseCost(t.cost),
      hire_duration: t.ownership === 'hired' ? t.hire_duration.trim() || null : null,
      sort_order: index,
    }));
}

export async function listModTools(modId: string): Promise<ModTool[]> {
  const { data, error } = await supabase
    .from('mod_tools')
    .select('id, mod_id, name, brand, url, ownership, cost, hire_duration, sort_order')
    .eq('mod_id', modId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ModTool[];
}

/** Replace all tools on a mod (edit flow). */
export async function saveModTools(modId: string, tools: ModToolDraft[]): Promise<void> {
  const validation = validateToolDrafts(tools);
  if (validation) throw new Error(validation);

  const { error: delErr } = await supabase.from('mod_tools').delete().eq('mod_id', modId);
  if (delErr) throw delErr;

  const rows = draftsToRows(modId, tools);
  if (rows.length === 0) return;

  const { error } = await supabase.from('mod_tools').insert(rows);
  if (error) throw error;
}

export async function fetchModToolsByModIds(
  modIds: string[]
): Promise<Map<string, ModTool[]>> {
  const map = new Map<string, ModTool[]>();
  if (modIds.length === 0) return map;

  const { data, error } = await supabase
    .from('mod_tools')
    .select('id, mod_id, name, brand, url, ownership, cost, hire_duration, sort_order')
    .in('mod_id', modIds)
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('[mod-tools] fetch failed:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const list = map.get(row.mod_id) ?? [];
    list.push(row as ModTool);
    map.set(row.mod_id, list);
  }
  return map;
}

export function toolLabel(tool: Pick<ModTool, 'brand' | 'name'>): string {
  return [tool.brand, tool.name].filter(Boolean).join(' ').trim() || tool.name;
}

export function toolCostLabel(tool: Pick<ModTool, 'ownership' | 'cost' | 'hire_duration'>): string {
  if (tool.cost == null) {
    return tool.ownership === 'hired' ? 'Hired' : 'Owned';
  }
  const amount = `$${Number(tool.cost).toLocaleString()}`;
  if (tool.ownership === 'hired') {
    return tool.hire_duration ? `${amount} · ${tool.hire_duration}` : `${amount} hire`;
  }
  return amount;
}
