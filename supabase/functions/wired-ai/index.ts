import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsPreflight,
  getSupabaseAnonKey,
  jsonResponse,
  textResponse,
} from '../_shared/cors.ts';
import {
  fetchGoogleShopping,
  googleShoppingSearchUrl,
  rankShoppingOffers,
} from '../_shared/serp-shopping.ts';
import { buildVehicleGuideQuery, fetchGoogleSearch } from '../_shared/serp-search.ts';
import { decodeVinSummary } from '../_shared/nhtsa-vpic.ts';
import { productLinksWithoutLookup } from '../_shared/product-links.ts';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const FREE_MONTHLY_LIMIT = 20;
const MAX_BATCH_FILES = 25;
const MAX_AGENT_TURNS = 6;
const CLAUDE_FETCH_MS = 50_000;
const CHAT_HISTORY_LIMIT = 24;

const MOD_CATEGORIES = new Set([
  'suspension',
  'drivetrain',
  'body',
  'recovery',
  'interior',
  'lighting',
  'electrical',
  'wheels_tyres',
  'camping',
  'other',
]);

const WISHLIST_PRIORITIES = new Set(['low', 'medium', 'high']);

const INSTALLER_TYPES = new Set(['self', 'workshop', 'friend', 'dealer']);

const MOD_PRIVACIES = new Set(['public', 'followers', 'private']);

const MAINTENANCE_TYPES = new Set([
  'oil_change',
  'general_service',
  'major_service',
  'inspection',
  'tyres',
  'brakes',
  'registration',
  'insurance',
  'other',
]);

const DOCUMENT_TYPES = new Set([
  'registration',
  'insurance',
  'service_receipt',
  'invoice',
  'inspection',
  'other',
]);

const BASE_SYSTEM_PROMPT = `You are Wired AI, an agentic in-app assistant for Wired Build — a platform for 4x4 and car enthusiasts to track mods, builds, service history, and vehicle documents.

You can take real actions on the user's behalf using your tools: search Google Shopping, search maintenance/repair guides, log mods, manage wishlist and build plan, search the community, find similar builds, follow users, and read their garage data.

Rules:
- For the user's garage (mods, costs, service history, documents): use the pre-loaded snapshot and tools only — never invent mods, costs, dates, or documents.
- For general automotive how-to (oil changes, brakes, specs, common procedures): use your automotive knowledge for the vehicle's year/make/model/trim. Call search_vehicle_guides when you need model-specific capacities, torque specs, filter part numbers, or step-by-step guides from the web.
- You can help with any production vehicle the user names (not only their garage). Use their active vehicle by default; if they name another car, pass make/model/year to search_vehicle_guides.
- Give practical DIY steps with safety notes (jack stands, hot engine, disposal). Recommend a workshop when a job needs specialist tools or is safety-critical.
- Never ask the user for a vehicle ID, UUID, or how to find IDs in the app — you already have garage access.
- When the user asks you to add, remove, follow, or find something, call the matching action tool immediately — do not only describe steps they should take manually.
- After each action, confirm what you did in plain language (e.g. "Added ARB bull bar to your wishlist").
- Only follow users when they explicitly ask to follow someone. Use follow_user / unfollow_user — never follow without a clear request.
- Use search_shopping when the user wants prices, deals, or product links from the web (e.g. "cheapest dune tent with great reviews"). Summarize top options with price, store, rating, and link. Offer to add their pick to the wishlist.
- Use log_mod when the user wants to record an install. Default install_date to today, installer to self, privacy to public unless they specify otherwise. Use search_parts to resolve catalogue parts first. log_mod saves a Google Shopping search link; pass product_url only when the user supplies a specific product page.
- Use log_maintenance for completed service items (oil change, rego, tyres, inspection, workshop service).
- When the user pastes Apple Notes / todo + done build lists: parse every line, then call import_build_lists once. todo items → todos array (wishlist). done items → done array: installs → mods, service → maintenance. Never skip the done list. Bulk import saves mods without live product lookups (shopping search URLs only); use log_mod for a single part when the user wants a product link fetched.
- After logging a mod, mention they can add photos in Log → Edit if they want.
- Do not delete mods, service records, or vehicles without explicit confirmation.
- When the user names a vehicle (e.g. "my Outback Cruiser"), match it from their garage list or use the active vehicle for this chat.
- Be concise, practical, and friendly. Use Australian English when appropriate.
- When discussing spend, format currency as AUD with $ prefix.
- If the user asks about paperwork, suggest they use Import paperwork in the Docs tab for bulk upload.`;

type VehicleChatContext = {
  vehicleId: string;
  label: string;
  snapshot: Record<string, unknown>;
  otherVehicles: { id: string; label: string }[];
};

function vehicleLabel(v: {
  nickname?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): string {
  if (v.nickname?.trim()) return v.nickname.trim();
  const ymm = [v.year, v.make, v.model].filter(Boolean).join(' ');
  return ymm || 'Unnamed vehicle';
}

function buildChatSystemPrompt(ctx: VehicleChatContext): string {
  const others =
    ctx.otherVehicles.length > 0
      ? ctx.otherVehicles.map((v) => `- ${v.label}`).join('\n')
      : '(none)';

  return `${BASE_SYSTEM_PROMPT}

## Active vehicle (this chat)
The user opened Wired AI from this vehicle's garage. All tools default to this vehicle when vehicle_id is omitted.

- Name: ${ctx.label}
- vehicle_id: ${ctx.vehicleId}

## Pre-loaded data (mods, service, plan, spend)
${JSON.stringify(ctx.snapshot)}

## Other vehicles in the user's garage
${others}`;
}

async function loadVehicleChatContext(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string
): Promise<VehicleChatContext | null> {
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(
      'id, year, make, model, trim, vin, nickname, total_spend, build_value, valuation_source, manual_build_value, manual_build_value_note, is_for_sale, asking_price'
    )
    .eq('id', vehicleId)
    .eq('current_owner_id', userId)
    .maybeSingle();

  if (!vehicle) return null;

  const [mods, maintenance, planItems, wishlist, docCount, allVehicles] = await Promise.all([
    supabase
      .from('mods')
      .select('category, cost, install_date, custom_part_name, notes, parts(brand, name)')
      .eq('vehicle_id', vehicleId)
      .order('install_date', { ascending: false })
      .limit(30),
    supabase
      .from('maintenance_records')
      .select('record_type, title, service_date, cost, provider, next_due_date')
      .eq('vehicle_id', vehicleId)
      .order('service_date', { ascending: false })
      .limit(15),
    supabase
      .from('plan_items')
      .select('id, title, target_cost, completed_at, sort_order, notes')
      .eq('vehicle_id', vehicleId)
      .order('sort_order')
      .limit(20),
    supabase
      .from('wishlist_items')
      .select('id, custom_part_name, target_cost, priority, category, notes, part_id, parts(brand, name)')
      .eq('vehicle_id', vehicleId)
      .limit(30),
    supabase
      .from('vehicle_documents')
      .select('id', { count: 'exact', head: true })
      .eq('vehicle_id', vehicleId),
    supabase
      .from('vehicles')
      .select('id, year, make, model, nickname')
      .eq('current_owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20),
  ]);

  const label = vehicleLabel(vehicle);
  const otherVehicles = (allVehicles.data ?? [])
    .filter((v) => v.id !== vehicleId)
    .map((v) => ({ id: v.id, label: vehicleLabel(v) }));

  return {
    vehicleId,
    label,
    otherVehicles,
    snapshot: {
      profile: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        vin: vehicle.vin,
        nickname: vehicle.nickname,
        total_spend: vehicle.total_spend,
        build_value: vehicle.build_value,
        valuation_source: vehicle.valuation_source,
        manual_build_value: vehicle.manual_build_value,
        manual_build_value_note: vehicle.manual_build_value_note,
        is_for_sale: vehicle.is_for_sale,
        asking_price: vehicle.asking_price,
      },
      mods: mods.data ?? [],
      maintenance: maintenance.data ?? [],
      plan_items: planItems.data ?? [],
      wishlist: wishlist.data ?? [],
      document_count: docCount.count ?? 0,
    },
  };
}

type AuthContext = {
  userId: string;
  tier: string;
  supabase: SupabaseClient;
  serviceSupabase: SupabaseClient;
};

type ChatBody = {
  action: 'chat';
  conversation_id?: string;
  vehicle_id: string;
  message: string;
};

type ClassifyBody = {
  action: 'classify_batch';
  batch_id: string;
};

type ApplyBody = {
  action: 'apply_batch';
  batch_id: string;
  items: {
    id: string;
    status: 'accepted' | 'skipped';
    proposed_title?: string | null;
    proposed_record_type?: string | null;
    proposed_document_type?: string | null;
    proposed_service_date?: string | null;
    proposed_cost?: number | null;
    proposed_provider?: string | null;
  }[];
};

type CancelBody = {
  action: 'cancel_batch';
  batch_id: string;
};

type UsageBody = {
  action: 'get_usage';
};

type RequestBody = ChatBody | ClassifyBody | ApplyBody | CancelBody | UsageBody;

const TOOLS = [
  {
    name: 'list_my_vehicles',
    description:
      'List vehicles in the user garage (id, nickname, year/make/model). Use only when the user asks about a different car than the active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional filter: nickname or make/model substring (case-insensitive)',
        },
      },
    },
  },
  {
    name: 'get_vehicle_summary',
    description:
      'Refresh vehicle year/make/model, nickname, total spend, and build value. vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string', description: 'Optional; defaults to active vehicle' },
      },
    },
  },
  {
    name: 'list_mods',
    description: 'List mods on the vehicle. vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        limit: { type: 'number', description: 'Max rows (default 20)' },
      },
    },
  },
  {
    name: 'list_maintenance_records',
    description: 'List service history. vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'list_documents',
    description: 'List uploaded documents. vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'list_plan_items',
    description: 'List build plan items (with ids). vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'list_wishlist',
    description: 'List wishlist items (with ids for remove). vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'add_wishlist_item',
    description:
      'Add a part to the wishlist on the active vehicle. Use search_parts first if linking a catalogue part. Requires custom_part_name and/or part_id.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        custom_part_name: { type: 'string', description: 'Freeform part name if not in catalogue' },
        part_id: { type: 'string', description: 'Catalogue part UUID from search_parts' },
        category: {
          type: 'string',
          enum: [
            'suspension',
            'drivetrain',
            'body',
            'recovery',
            'interior',
            'lighting',
            'electrical',
            'wheels_tyres',
            'camping',
            'other',
          ],
        },
        target_cost: { type: 'number' },
        notes: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    },
  },
  {
    name: 'remove_wishlist_item',
    description: 'Remove a wishlist item by wishlist_item_id (from list_wishlist or snapshot).',
    input_schema: {
      type: 'object',
      properties: {
        wishlist_item_id: { type: 'string', description: 'UUID from list_wishlist' },
      },
      required: ['wishlist_item_id'],
    },
  },
  {
    name: 'log_mod',
    description:
      'Log an installed mod on the active vehicle (creates a real mod record and may create a feed post if public). Use search_parts for catalogue parts. Cannot upload photos — user adds those in Log → Edit.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        custom_part_name: { type: 'string', description: 'Part name if not in catalogue' },
        part_id: { type: 'string', description: 'Catalogue part UUID from search_parts' },
        category: {
          type: 'string',
          enum: [
            'suspension',
            'drivetrain',
            'body',
            'recovery',
            'interior',
            'lighting',
            'electrical',
            'wheels_tyres',
            'camping',
            'other',
          ],
        },
        cost: { type: 'number', description: 'AUD install cost' },
        cost_is_approximate: { type: 'boolean' },
        install_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        date_is_approximate: { type: 'boolean' },
        installer_type: {
          type: 'string',
          enum: ['self', 'workshop', 'friend', 'dealer'],
          description: 'Defaults to self',
        },
        privacy: {
          type: 'string',
          enum: ['public', 'followers', 'private'],
          description: 'Defaults to public',
        },
        notes: { type: 'string' },
        wishlist_item_id: {
          type: 'string',
          description: 'If promoting from wishlist, pass id to remove that row after logging',
        },
        plan_item_id: {
          type: 'string',
          description: 'If completing a plan item, pass id to mark it done',
        },
        product_url: {
          type: 'string',
          description: 'Optional product page URL; if omitted, Google Shopping is used',
        },
      },
    },
  },
  {
    name: 'log_maintenance',
    description:
      'Log a completed service/maintenance record (oil change, rego, tyres, inspection, etc.). vehicle_id optional — defaults to active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        title: { type: 'string' },
        record_type: {
          type: 'string',
          enum: [
            'oil_change',
            'general_service',
            'major_service',
            'inspection',
            'tyres',
            'brakes',
            'registration',
            'insurance',
            'other',
          ],
        },
        service_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        cost: { type: 'number' },
        provider: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'import_build_lists',
    description:
      'Bulk import parsed notes: todos → wishlist; done installs → mods (auto product links); done service → maintenance. Call once after parsing user paste.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              target_cost: { type: 'number' },
              category: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
              notes: { type: 'string' },
            },
            required: ['title'],
          },
        },
        done: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              cost: { type: 'number' },
              install_date: { type: 'string' },
              category: { type: 'string' },
              is_service: { type: 'boolean' },
              record_type: { type: 'string' },
              provider: { type: 'string' },
              notes: { type: 'string' },
              product_url: { type: 'string' },
            },
            required: ['title'],
          },
        },
      },
    },
  },
  {
    name: 'add_plan_item',
    description: 'Add a build plan item to the active vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        title: { type: 'string' },
        target_cost: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'remove_plan_item',
    description: 'Remove a build plan item by plan_item_id.',
    input_schema: {
      type: 'object',
      properties: {
        plan_item_id: { type: 'string' },
      },
      required: ['plan_item_id'],
    },
  },
  {
    name: 'search_vehicle_guides',
    description:
      'Search the web for model-specific maintenance/repair guides (oil change, brakes, capacities, torque specs). Uses active vehicle by default, or pass year/make/model for any car.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'What to look up, e.g. "oil change", "brake pad replacement", "oil capacity"',
        },
        vehicle_id: { type: 'string' },
        year: { type: 'number' },
        make: { type: 'string' },
        model: { type: 'string' },
        trim: { type: 'string' },
        query: {
          type: 'string',
          description: 'Optional full search query override',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'search_shopping',
    description:
      'Search Google Shopping (AU) for products by keyword. Returns prices, store names, ratings, review counts, and buy links. Use for "find cheapest…", "best reviewed…", or comparing retailers.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Product search terms, e.g. "ARB dune roof top tent 4WD"',
        },
        sort: {
          type: 'string',
          enum: ['balanced', 'cheapest', 'top_rated'],
          description: 'How to rank results (default balanced)',
        },
        limit: { type: 'number', description: 'Max offers to return (default 8)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_parts',
    description:
      'Search the Wired Build parts catalogue (community installs). Use before log_mod or add_wishlist_item when linking a catalogue part. For web prices use search_shopping.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_users',
    description: 'Search builders by handle, display name, or workshop name.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_similar_builds',
    description:
      'Find public builds and builders with similar vehicles (same make/model) or overlapping mod categories. Uses active vehicle by default.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'follow_user',
    description:
      'Follow a user by handle (no @). Only use when the user explicitly asks to follow someone.',
    input_schema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'Username handle without @' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'unfollow_user',
    description: 'Unfollow a user by handle. Only when the user explicitly asks to unfollow.',
    input_schema: {
      type: 'object',
      properties: {
        handle: { type: 'string' },
      },
      required: ['handle'],
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') return textResponse('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return textResponse('Unauthorized', 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    getSupabaseAnonKey(),
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) return textResponse('Unauthorized', 401);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return textResponse('Server misconfigured', 500);

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceKey
  );

  const { data: profile } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', auth.user.id)
    .maybeSingle();

  const ctx: AuthContext = {
    userId: auth.user.id,
    tier: profile?.subscription_tier ?? 'free',
    supabase,
    serviceSupabase,
  };

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return textResponse('Invalid JSON', 400);
  }

  try {
    switch (body.action) {
      case 'chat':
        return await handleChat(ctx, body);
      case 'classify_batch':
        return await handleClassifyBatch(ctx, body);
      case 'apply_batch':
        return await handleApplyBatch(ctx, body);
      case 'cancel_batch':
        return await handleCancelBatch(ctx, body);
      case 'get_usage':
        return await handleGetUsage(ctx);
      default:
        return textResponse('Unknown action', 400);
    }
  } catch (err) {
    console.error('wired-ai unhandled', body.action, err);
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function isUnlimitedTier(tier: string): boolean {
  return tier === 'pro' || tier === 'workshop';
}

async function handleGetUsage(ctx: AuthContext): Promise<Response> {
  const limit = isUnlimitedTier(ctx.tier) ? null : FREE_MONTHLY_LIMIT;
  if (limit == null) {
    return jsonResponse({ unlimited: true, used: 0, limit: null, remaining: null });
  }

  const { data } = await ctx.supabase
    .from('ai_usage_monthly')
    .select('message_count')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth())
    .maybeSingle();

  const used = data?.message_count ?? 0;
  return jsonResponse({
    unlimited: false,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  });
}

async function checkAndIncrementUsage(ctx: AuthContext): Promise<Response | null> {
  if (isUnlimitedTier(ctx.tier)) return null;

  const month = currentMonth();
  const { data: existing } = await ctx.supabase
    .from('ai_usage_monthly')
    .select('message_count')
    .eq('user_id', ctx.userId)
    .eq('month', month)
    .maybeSingle();

  const used = existing?.message_count ?? 0;
  if (used >= FREE_MONTHLY_LIMIT) {
    return jsonResponse(
      {
        error: 'Monthly Wired AI limit reached. Upgrade to Pro for unlimited messages.',
        code: 'limit_exceeded',
        used,
        limit: FREE_MONTHLY_LIMIT,
      },
      429
    );
  }

  const { data: newCount, error } = await ctx.serviceSupabase.rpc('increment_ai_usage', {
    p_user_id: ctx.userId,
    p_month: month,
    p_tokens: 0,
  });

  if (error) {
    console.error('increment_ai_usage failed', error);
    return textResponse('Could not track usage', 500);
  }

  if ((newCount as number) > FREE_MONTHLY_LIMIT) {
    return jsonResponse(
      {
        error: 'Monthly Wired AI limit reached. Upgrade to Pro for unlimited messages.',
        code: 'limit_exceeded',
        used: newCount,
        limit: FREE_MONTHLY_LIMIT,
      },
      429
    );
  }

  return null;
}

async function verifyVehicleAccess(
  ctx: AuthContext,
  vehicleId: string
): Promise<boolean> {
  const { data } = await ctx.supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('current_owner_id', ctx.userId)
    .maybeSingle();
  return !!data;
}

async function handleChat(ctx: AuthContext, body: ChatBody): Promise<Response> {
  const started = Date.now();
  const message = body.message?.trim();
  if (!message) return textResponse('message required', 400);
  if (!body.vehicle_id) return textResponse('vehicle_id required', 400);

  if (!(await verifyVehicleAccess(ctx, body.vehicle_id))) {
    return textResponse('Forbidden', 403);
  }

  const limitErr = await checkAndIncrementUsage(ctx);
  if (limitErr) return limitErr;

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'AI not configured. Set ANTHROPIC_API_KEY in Supabase secrets.', code: 'ai_not_configured' }, 503);
  }

  const vehicleContext = await loadVehicleChatContext(
    ctx.supabase,
    ctx.userId,
    body.vehicle_id
  );
  if (!vehicleContext) return textResponse('Vehicle not found', 404);

  const systemPrompt = buildChatSystemPrompt(vehicleContext);

  let conversationId = body.conversation_id;
  if (conversationId) {
    const { data: convo } = await ctx.supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!convo) return textResponse('Conversation not found', 404);
  } else {
    const { data: convo, error } = await ctx.supabase
      .from('ai_conversations')
      .insert({
        user_id: ctx.userId,
        vehicle_id: body.vehicle_id,
        title: 'Wired AI',
      })
      .select('id')
      .single();
    if (error || !convo) return textResponse('Could not create conversation', 500);
    conversationId = convo.id;
  }

  await ctx.supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: { text: message },
  });

  const { data: historyDesc } = await ctx.supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);

  const claudeMessages = buildClaudeMessagesFromHistory(
    (historyDesc ?? []).slice().reverse()
  );

  if (claudeMessages.length === 0 || claudeMessages[claudeMessages.length - 1].role !== 'user') {
    return textResponse('Could not prepare conversation history. Send your message again.', 400);
  }

  let assistantText = '';
  let tokensUsed = 0;
  let turns = 0;
  let messages: { role: string; content: unknown }[] = [...claudeMessages];

  while (turns < MAX_AGENT_TURNS) {
    turns++;
    const claude = await callClaude(apiKey, messages, TOOLS, systemPrompt);
    if (!claude.ok) {
      return jsonResponse({ error: claude.error }, claude.status);
    }
    const response = claude.data;
    tokensUsed += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    const content = Array.isArray(response.content) ? response.content : [];
    const toolUses = content.filter((b: { type: string }) => b.type === 'tool_use');
    const textBlocks = content.filter((b: { type: string }) => b.type === 'text');
    assistantText = textBlocks.map((b: { text: string }) => b.text).join('\n').trim();

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        const result = await execTool(
          ctx,
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          body.vehicle_id
        );
        await ctx.supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'tool',
          content: { tool: toolUse.name, input: toolUse.input, result },
        });
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  const last = messages[messages.length - 1];
  const pendingToolResults =
    last?.role === 'user' &&
    Array.isArray(last.content) &&
    (last.content as { type?: string }[]).some((b) => b.type === 'tool_result');

  if (pendingToolResults && !assistantText) {
    const final = await callClaude(apiKey, messages, TOOLS, systemPrompt);
    if (final.ok) {
      tokensUsed +=
        (final.data.usage?.input_tokens ?? 0) + (final.data.usage?.output_tokens ?? 0);
      const blocks = Array.isArray(final.data.content) ? final.data.content : [];
      assistantText = blocks
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n')
        .trim();
    }
  }

  if (!assistantText) {
    assistantText = 'Sorry, I could not generate a response. Please try again.';
  }

  const { data: assistantMsg, error: msgErr } = await ctx.supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: { text: assistantText },
    })
    .select('id, role, content, created_at')
    .single();

  if (msgErr) return textResponse('Could not save response', 500);

  await ctx.supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  const usage = await getUsagePayload(ctx);

  console.log('[wired-ai] chat ok', {
    user_id: ctx.userId,
    turns,
    ms: Date.now() - started,
    tokens: tokensUsed,
  });

  return jsonResponse({
    conversation_id: conversationId,
    message: assistantMsg,
    usage,
  });
}

async function getUsagePayload(ctx: AuthContext) {
  if (isUnlimitedTier(ctx.tier)) {
    return { unlimited: true, used: 0, limit: null, remaining: null };
  }
  const { data } = await ctx.supabase
    .from('ai_usage_monthly')
    .select('message_count')
    .eq('user_id', ctx.userId)
    .eq('month', currentMonth())
    .maybeSingle();
  const used = data?.message_count ?? 0;
  return {
    unlimited: false,
    used,
    limit: FREE_MONTHLY_LIMIT,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - used),
  };
}

type ClaudeMessageResponse = {
  content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** Anthropic requires the final message to be from the user (no assistant prefill). */
function buildClaudeMessagesFromHistory(
  rows: { role: string; content: { text?: string } | null }[]
): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const row of rows) {
    const text = row.content?.text;
    if (typeof text !== 'string' || !text.trim()) continue;
    if (row.role === 'user') {
      out.push({ role: 'user', content: text.trim() });
    } else if (row.role === 'assistant') {
      out.push({ role: 'assistant', content: text.trim() });
    }
  }

  while (out.length > 0 && out[out.length - 1].role === 'assistant') {
    out.pop();
  }

  return out;
}

async function callClaude(
  apiKey: string,
  messages: { role: string; content: unknown }[],
  tools?: unknown[],
  system = BASE_SYSTEM_PROMPT
): Promise<
  | { ok: true; data: ClaudeMessageResponse }
  | { ok: false; status: number; error: string }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLAUDE_FETCH_MS);
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1536,
        system,
        tools,
        messages,
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 504, error: 'AI took too long — try a shorter message.' };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  if (!res.ok) {
    console.error('Claude API error', res.status, raw);
    let detail = 'AI request failed';
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
      detail = parsed.error?.message ?? parsed.message ?? detail;
    } catch {
      if (raw.trim()) detail = raw.slice(0, 240);
    }
    if (res.status === 401) {
      detail = 'AI API key is invalid. Update ANTHROPIC_API_KEY in Supabase secrets.';
    }
    return { ok: false, status: 502, error: detail };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as ClaudeMessageResponse };
  } catch {
    return { ok: false, status: 502, error: 'AI returned an invalid response' };
  }
}

function sanitizeModCategory(raw: unknown): string | null {
  const v = String(raw ?? '').trim();
  return MOD_CATEGORIES.has(v) ? v : null;
}

function sanitizeWishlistPriority(raw: unknown): string {
  const v = String(raw ?? 'medium').trim();
  return WISHLIST_PRIORITIES.has(v) ? v : 'medium';
}

function sanitizeInstallerType(raw: unknown): string {
  const v = String(raw ?? 'self').trim();
  return INSTALLER_TYPES.has(v) ? v : 'self';
}

function sanitizeModPrivacy(raw: unknown): string {
  const v = String(raw ?? 'public').trim();
  return MOD_PRIVACIES.has(v) ? v : 'public';
}

function todayISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function sanitizeRecordType(value: string): string | null {
  return MAINTENANCE_TYPES.has(value) ? value : null;
}

function inferServiceFromTitle(title: string): {
  isService: boolean;
  recordType: string;
} {
  const t = title.toLowerCase();
  if (/oil\s*change|engine\s*oil|oil\s*&\s*filter/.test(t)) {
    return { isService: true, recordType: 'oil_change' };
  }
  if (/rego|registration|pink\s*slip/.test(t)) return { isService: true, recordType: 'registration' };
  if (/insurance|ctp/.test(t)) return { isService: true, recordType: 'insurance' };
  if (/tyre|tire|wheel\s*align|rotation|balance/.test(t)) {
    return { isService: true, recordType: 'tyres' };
  }
  if (/brake\s*pad|brake\s*fluid|brake\s*service/.test(t)) {
    return { isService: true, recordType: 'brakes' };
  }
  if (/inspection|service\s*at|workshop\s*service|major\s*service|minor\s*service|scheduled\s*service|logbook/.test(t)) {
    return { isService: true, recordType: /major/.test(t) ? 'major_service' : 'general_service' };
  }
  if (/service\b/.test(t) && !/self\s*service/.test(t)) {
    return { isService: true, recordType: 'general_service' };
  }
  return { isService: false, recordType: 'other' };
}

async function resolveUserByHandle(
  ctx: AuthContext,
  handle: unknown
): Promise<{ id: string; handle: string; display_name: string } | { error: string }> {
  const h = String(handle ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!h) return { error: 'handle required' };
  const { data, error } = await ctx.supabase
    .from('users')
    .select('id, handle, display_name')
    .ilike('handle', h)
    .limit(1)
    .maybeSingle();
  if (error || !data) return { error: `User @${h} not found` };
  return data;
}

async function requireVehicleAccess(
  ctx: AuthContext,
  vehicleId: string
): Promise<{ ok: true } | { error: string }> {
  if (!(await verifyVehicleAccess(ctx, vehicleId))) {
    return { error: 'Vehicle not found or access denied' };
  }
  return { ok: true };
}

async function execTool(
  ctx: AuthContext,
  name: string,
  input: Record<string, unknown>,
  defaultVehicleId: string
): Promise<unknown> {
  const vehicleId = (input.vehicle_id as string) || defaultVehicleId;
  const limit = Math.min(Number(input.limit) || 20, 50);

  const vehicleTools = new Set([
    'get_vehicle_summary',
    'list_mods',
    'list_maintenance_records',
    'list_documents',
    'list_plan_items',
    'list_wishlist',
    'log_mod',
    'log_maintenance',
    'import_build_lists',
    'add_wishlist_item',
    'remove_wishlist_item',
    'add_plan_item',
    'remove_plan_item',
    'find_similar_builds',
  ]);

  if (vehicleTools.has(name)) {
    const access = await requireVehicleAccess(ctx, vehicleId);
    if ('error' in access) return access;
  }

  switch (name) {
    case 'list_my_vehicles': {
      const search = String(input.search ?? '')
        .trim()
        .toLowerCase();
      const { data } = await ctx.supabase
        .from('vehicles')
        .select('id, year, make, model, nickname, build_value, total_spend')
        .eq('current_owner_id', ctx.userId)
        .order('updated_at', { ascending: false })
        .limit(20);
      const rows = (data ?? []).map((v) => ({
        vehicle_id: v.id,
        label: vehicleLabel(v),
        year: v.year,
        make: v.make,
        model: v.model,
        nickname: v.nickname,
        build_value: v.build_value,
        total_spend: v.total_spend,
        is_active_vehicle: v.id === defaultVehicleId,
      }));
      if (!search) return rows;
      return rows.filter((v) => {
        const hay = `${v.label} ${v.make ?? ''} ${v.model ?? ''} ${v.nickname ?? ''}`.toLowerCase();
        return hay.includes(search);
      });
    }
    case 'get_vehicle_summary': {
      const { data } = await ctx.supabase
        .from('vehicles')
        .select(
          'year, make, model, trim, nickname, total_spend, build_value, valuation_source, is_public'
        )
        .eq('id', vehicleId)
        .single();
      return data;
    }
    case 'list_mods': {
      const { data } = await ctx.supabase
        .from('mods')
        .select('category, cost, install_date, custom_part_name, notes, parts(brand, name)')
        .eq('vehicle_id', vehicleId)
        .order('install_date', { ascending: false })
        .limit(limit);
      return data ?? [];
    }
    case 'list_maintenance_records': {
      const { data } = await ctx.supabase
        .from('maintenance_records')
        .select(
          'record_type, title, service_date, cost, provider, next_due_date, date_is_approximate'
        )
        .eq('vehicle_id', vehicleId)
        .order('service_date', { ascending: false })
        .limit(limit);
      return data ?? [];
    }
    case 'list_documents': {
      const { data } = await ctx.supabase
        .from('vehicle_documents')
        .select('title, document_type, file_name, created_at')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return data ?? [];
    }
    case 'list_plan_items': {
      const { data, error } = await ctx.supabase
        .from('plan_items')
        .select('id, title, target_cost, completed_at, sort_order, notes')
        .eq('vehicle_id', vehicleId)
        .order('sort_order')
        .limit(limit);
      if (error) return { error: error.message };
      return data ?? [];
    }
    case 'list_wishlist': {
      const { data, error } = await ctx.supabase
        .from('wishlist_items')
        .select(
          'id, custom_part_name, target_cost, priority, category, notes, part_id, parts(brand, name)'
        )
        .eq('vehicle_id', vehicleId)
        .eq('user_id', ctx.userId)
        .order('priority', { ascending: false })
        .limit(limit);
      if (error) return { error: error.message };
      return (data ?? []).map((row) => ({
        wishlist_item_id: row.id,
        custom_part_name: row.custom_part_name,
        part: row.parts,
        category: row.category,
        target_cost: row.target_cost,
        priority: row.priority,
        notes: row.notes,
      }));
    }
    case 'log_mod': {
      const customName = String(input.custom_part_name ?? '').trim();
      const partId = String(input.part_id ?? '').trim() || null;
      if (!partId && !customName) {
        return { error: 'Provide custom_part_name or part_id (use search_parts for catalogue parts)' };
      }

      let category = sanitizeModCategory(input.category);
      if (!category && partId) {
        const { data: part } = await ctx.supabase
          .from('parts')
          .select('category')
          .eq('id', partId)
          .maybeSingle();
        category = part?.category ? sanitizeModCategory(part.category) : null;
      }
      if (!category) category = 'other';

      const installDate = String(input.install_date ?? '').trim() || todayISO();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(installDate)) {
        return { error: 'install_date must be YYYY-MM-DD' };
      }

      const costRaw = input.cost;
      const cost =
        costRaw != null && costRaw !== ''
          ? Number(costRaw)
          : null;
      if (cost != null && (Number.isNaN(cost) || cost < 0)) {
        return { error: 'Invalid cost' };
      }

      const planItemId = String(input.plan_item_id ?? '').trim() || null;

      let partLabel = customName;
      if (partId && !partLabel) {
        const { data: part } = await ctx.supabase
          .from('parts')
          .select('brand, name')
          .eq('id', partId)
          .maybeSingle();
        if (part) partLabel = `${part.brand} ${part.name}`.trim();
      }
      if (!partLabel) partLabel = 'Mod';

      const productLinks = productLinksWithoutLookup(
        partLabel,
        String(input.product_url ?? '').trim() || null
      );

      const { data: mod, error } = await ctx.supabase
        .from('mods')
        .insert({
          vehicle_id: vehicleId,
          part_id: partId,
          custom_part_name: customName || null,
          category,
          cost,
          cost_is_approximate: Boolean(input.cost_is_approximate),
          installer_type: sanitizeInstallerType(input.installer_type),
          installer_workshop_id: null,
          install_date: installDate,
          date_is_approximate: Boolean(input.date_is_approximate),
          notes: String(input.notes ?? '').trim() || null,
          privacy: sanitizeModPrivacy(input.privacy),
          product_links: productLinks,
          from_plan_item_id: planItemId,
        })
        .select(
          'id, category, cost, install_date, privacy, custom_part_name, part:parts ( brand, name )'
        )
        .single();

      if (error) return { error: error.message };

      const wishlistId = String(input.wishlist_item_id ?? '').trim();
      if (wishlistId) {
        await ctx.supabase
          .from('wishlist_items')
          .delete()
          .eq('id', wishlistId)
          .eq('user_id', ctx.userId);
      }

      if (planItemId) {
        await ctx.supabase
          .from('plan_items')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', planItemId)
          .eq('vehicle_id', vehicleId);
      }

      const linkedPart = mod.part as { brand: string; name: string } | null;
      const loggedLabel = linkedPart
        ? `${linkedPart.brand} ${linkedPart.name}`
        : mod.custom_part_name ?? partLabel;

      return {
        ok: true,
        action: 'logged_mod',
        mod_id: mod.id,
        part_label: loggedLabel,
        category: mod.category,
        cost: mod.cost,
        install_date: mod.install_date,
        privacy: mod.privacy,
        edit_path: `/log/edit?id=${mod.id}`,
        vehicle_path: `/vehicle/${vehicleId}`,
        product_link: productLinks.primary?.url ?? null,
        note: productLinks.primary
          ? 'Product link attached from Google Shopping.'
          : 'Add photos or product link in Log → Edit if needed.',
      };
    }
    case 'log_maintenance': {
      const title = String(input.title ?? '').trim();
      if (!title) return { error: 'title required' };

      const inferred = inferServiceFromTitle(title);
      const recordType =
        sanitizeRecordType(String(input.record_type ?? '')) ?? inferred.recordType;
      const serviceDate = String(input.service_date ?? '').trim() || todayISO();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
        return { error: 'service_date must be YYYY-MM-DD' };
      }

      const costRaw = input.cost;
      const cost =
        costRaw != null && costRaw !== '' ? Number(costRaw) : null;
      if (cost != null && (Number.isNaN(cost) || cost < 0)) {
        return { error: 'Invalid cost' };
      }

      const { data: record, error } = await ctx.supabase
        .from('maintenance_records')
        .insert({
          vehicle_id: vehicleId,
          owner_id: ctx.userId,
          record_type: recordType,
          title,
          service_date: serviceDate,
          date_is_approximate: Boolean(input.date_is_approximate),
          cost,
          cost_is_approximate: cost != null,
          provider: String(input.provider ?? '').trim() || null,
          notes: String(input.notes ?? '').trim() || null,
        })
        .select('id, title, record_type, service_date, cost')
        .single();

      if (error) return { error: error.message };

      return {
        ok: true,
        action: 'logged_maintenance',
        maintenance_record_id: record.id,
        record,
        vehicle_path: `/vehicle/${vehicleId}`,
      };
    }
    case 'import_build_lists': {
      const todos = Array.isArray(input.todos) ? input.todos.slice(0, 40) : [];
      const done = Array.isArray(input.done) ? input.done.slice(0, 40) : [];
      const summary = {
        wishlist_added: [] as { title: string; id: string }[],
        mods_logged: [] as { title: string; mod_id: string; product_link: string | null }[],
        maintenance_logged: [] as { title: string; id: string }[],
        errors: [] as { title: string; error: string }[],
      };

      for (const raw of todos) {
        const item = raw as Record<string, unknown>;
        const title = String(item.title ?? '').trim();
        if (!title) continue;
        const { data, error } = await ctx.supabase
          .from('wishlist_items')
          .insert({
            user_id: ctx.userId,
            vehicle_id: vehicleId,
            part_id: null,
            custom_part_name: title,
            category: sanitizeModCategory(item.category),
            target_cost: item.target_cost != null ? Number(item.target_cost) : null,
            notes: String(item.notes ?? '').trim() || null,
            priority: sanitizeWishlistPriority(item.priority),
          })
          .select('id')
          .single();
        if (error) summary.errors.push({ title, error: error.message });
        else summary.wishlist_added.push({ title, id: data.id });
      }

      for (const raw of done) {
        const item = raw as Record<string, unknown>;
        const title = String(item.title ?? '').trim();
        if (!title) continue;

        const explicitService = item.is_service === true;
        const inferred = inferServiceFromTitle(title);
        const isService = explicitService || inferred.isService;

        if (isService) {
          const recordType =
            sanitizeRecordType(String(item.record_type ?? '')) ??
            inferred.recordType;
          const serviceDate =
            String(item.install_date ?? '').trim() || todayISO();
          const cost =
            item.cost != null ? Number(item.cost) : null;

          const { data, error } = await ctx.supabase
            .from('maintenance_records')
            .insert({
              vehicle_id: vehicleId,
              owner_id: ctx.userId,
              record_type: recordType,
              title,
              service_date: /^\d{4}-\d{2}-\d{2}$/.test(serviceDate)
                ? serviceDate
                : todayISO(),
              cost: cost != null && !Number.isNaN(cost) ? cost : null,
              cost_is_approximate: cost != null,
              provider: String(item.provider ?? '').trim() || null,
              notes: String(item.notes ?? '').trim() || null,
            })
            .select('id')
            .single();

          if (error) summary.errors.push({ title, error: error.message });
          else summary.maintenance_logged.push({ title, id: data.id });
          continue;
        }

        const installDate =
          String(item.install_date ?? '').trim() || todayISO();
        const cost = item.cost != null ? Number(item.cost) : null;
        const productLinks = productLinksWithoutLookup(
          title,
          String(item.product_url ?? '').trim() || null
        );

        const { data: mod, error } = await ctx.supabase
          .from('mods')
          .insert({
            vehicle_id: vehicleId,
            part_id: null,
            custom_part_name: title,
            category: sanitizeModCategory(item.category) ?? 'other',
            cost: cost != null && !Number.isNaN(cost) ? cost : null,
            cost_is_approximate: false,
            installer_type: 'self',
            install_date: /^\d{4}-\d{2}-\d{2}$/.test(installDate)
              ? installDate
              : todayISO(),
            notes: String(item.notes ?? '').trim() || null,
            privacy: 'public',
            product_links: productLinks,
          })
          .select('id')
          .single();

        if (error) summary.errors.push({ title, error: error.message });
        else {
          summary.mods_logged.push({
            title,
            mod_id: mod.id,
            product_link: productLinks.primary?.url ?? null,
          });
        }
      }

      return {
        ok: true,
        action: 'import_build_lists',
        ...summary,
        counts: {
          wishlist: summary.wishlist_added.length,
          mods: summary.mods_logged.length,
          maintenance: summary.maintenance_logged.length,
          errors: summary.errors.length,
        },
      };
    }
    case 'add_wishlist_item': {
      const customName = String(input.custom_part_name ?? '').trim();
      const partId = String(input.part_id ?? '').trim() || null;
      if (!partId && !customName) {
        return { error: 'Provide custom_part_name or part_id' };
      }
      const { data, error } = await ctx.supabase
        .from('wishlist_items')
        .insert({
          user_id: ctx.userId,
          vehicle_id: vehicleId,
          part_id: partId,
          custom_part_name: customName || null,
          category: sanitizeModCategory(input.category),
          target_cost: input.target_cost != null ? Number(input.target_cost) : null,
          notes: String(input.notes ?? '').trim() || null,
          priority: sanitizeWishlistPriority(input.priority),
        })
        .select('id, custom_part_name, part_id, parts(brand, name)')
        .single();
      if (error) return { error: error.message };
      return {
        ok: true,
        action: 'added_wishlist_item',
        wishlist_item_id: data.id,
        item: data,
      };
    }
    case 'remove_wishlist_item': {
      const itemId = String(input.wishlist_item_id ?? '').trim();
      if (!itemId) return { error: 'wishlist_item_id required' };
      const { data: existing } = await ctx.supabase
        .from('wishlist_items')
        .select('id, custom_part_name, part_id, parts(brand, name)')
        .eq('id', itemId)
        .eq('user_id', ctx.userId)
        .maybeSingle();
      if (!existing) return { error: 'Wishlist item not found' };
      const { error } = await ctx.supabase
        .from('wishlist_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', ctx.userId);
      if (error) return { error: error.message };
      return { ok: true, action: 'removed_wishlist_item', removed: existing };
    }
    case 'add_plan_item': {
      const title = String(input.title ?? '').trim();
      if (!title) return { error: 'title required' };
      const { data, error } = await ctx.supabase
        .from('plan_items')
        .insert({
          vehicle_id: vehicleId,
          user_id: ctx.userId,
          title,
          target_cost: input.target_cost != null ? Number(input.target_cost) : null,
          notes: String(input.notes ?? '').trim() || null,
        })
        .select('id, title, target_cost, notes')
        .single();
      if (error) return { error: error.message };
      return { ok: true, action: 'added_plan_item', plan_item_id: data.id, item: data };
    }
    case 'remove_plan_item': {
      const planId = String(input.plan_item_id ?? '').trim();
      if (!planId) return { error: 'plan_item_id required' };
      const { data: existing } = await ctx.supabase
        .from('plan_items')
        .select('id, title')
        .eq('id', planId)
        .eq('vehicle_id', vehicleId)
        .maybeSingle();
      if (!existing) return { error: 'Plan item not found' };
      const { error } = await ctx.supabase
        .from('plan_items')
        .delete()
        .eq('id', planId);
      if (error) return { error: error.message };
      return { ok: true, action: 'removed_plan_item', removed: existing };
    }
    case 'search_vehicle_guides': {
      const topic = String(input.topic ?? '').trim();
      if (!topic) return { error: 'topic required' };

      let year = input.year != null ? Number(input.year) : null;
      let make = String(input.make ?? '').trim() || null;
      let model = String(input.model ?? '').trim() || null;
      let trim = String(input.trim ?? '').trim() || null;
      let vin: string | null = null;

      const vid = (input.vehicle_id as string) || vehicleId;
      if (vid) {
        const access = await requireVehicleAccess(ctx, vid);
        if ('error' in access) return access;
        const { data: v } = await ctx.supabase
          .from('vehicles')
          .select('year, make, model, trim, vin')
          .eq('id', vid)
          .maybeSingle();
        if (v) {
          year = year ?? v.year;
          make = make ?? v.make;
          model = model ?? v.model;
          trim = trim ?? v.trim;
          vin = v.vin;
        }
      }

      if (!make && !model && !year) {
        return {
          error:
            'Need a vehicle — use the active garage vehicle or provide year, make, and model.',
        };
      }

      const vehicleDesc = [year, make, model, trim].filter(Boolean).join(' ');
      let vinSpecs = null;
      if (vin) {
        try {
          vinSpecs = await decodeVinSummary(vin);
        } catch (err) {
          console.warn('VIN decode failed', err);
        }
      }

      const searchQuery =
        String(input.query ?? '').trim() ||
        buildVehicleGuideQuery({ year, make, model, trim, topic });

      const serpKey = Deno.env.get('SERPAPI_KEY');
      let guides: Awaited<ReturnType<typeof fetchGoogleSearch>> = [];
      if (serpKey) {
        guides = await fetchGoogleSearch(searchQuery, serpKey, { limit: 6 });
      }

      return {
        vehicle: vehicleDesc,
        topic,
        vin_decoded: vinSpecs,
        search_query: searchQuery,
        guides,
        configured: !!serpKey,
        note: serpKey
          ? 'Summarize steps for this exact vehicle using guides + your automotive knowledge. Mention oil grade/capacity only when supported by results or VIN data.'
          : 'SERPAPI_KEY not set — answer from automotive knowledge for this year/make/model; suggest owner manual for exact specs.',
      };
    }
    case 'search_shopping': {
      const term = String(input.query ?? '').trim();
      if (!term) return { error: 'query required' };
      const serpKey = Deno.env.get('SERPAPI_KEY');
      if (!serpKey) {
        return {
          error: 'Google Shopping is not configured. Set SERPAPI_KEY in Supabase Edge Function secrets.',
          shopping_search_url: googleShoppingSearchUrl(term),
        };
      }
      const sortRaw = String(input.sort ?? 'balanced').trim();
      const sort =
        sortRaw === 'cheapest' || sortRaw === 'top_rated' ? sortRaw : 'balanced';
      const max = Math.min(Number(input.limit) || 8, 12);
      const offers = await fetchGoogleShopping(term, serpKey, { limit: 15 });
      const ranked = rankShoppingOffers(offers, sort).slice(0, max);
      return {
        query: term,
        sort,
        shopping_search_url: googleShoppingSearchUrl(term),
        offer_count: ranked.length,
        offers: ranked.map((o, i) => ({
          rank: i + 1,
          title: o.title,
          price: o.price,
          source: o.source,
          rating: o.rating,
          reviews: o.reviews,
          url: o.url,
        })),
        tip: 'Use add_wishlist_item with custom_part_name and notes including the chosen URL.',
      };
    }
    case 'search_parts': {
      const term = String(input.query ?? '').trim();
      if (!term) return { error: 'query required' };
      const escaped = term.replace(/[%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      const { data, error } = await ctx.supabase
        .from('parts')
        .select('id, brand, name, category, install_count')
        .eq('is_approved', true)
        .or(`brand.ilike.${pattern},name.ilike.${pattern}`)
        .order('install_count', { ascending: false })
        .limit(Math.min(Number(input.limit) || 10, 20));
      if (error) return { error: error.message };
      return data ?? [];
    }
    case 'search_users': {
      const term = String(input.query ?? '').trim();
      if (!term) return { error: 'query required' };
      const escaped = term.replace(/[%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      const { data, error } = await ctx.supabase
        .from('users')
        .select(
          'id, handle, display_name, avatar_url, is_workshop, is_identity_verified, subscription_tier, workshop_name'
        )
        .or(
          `handle.ilike.${pattern},display_name.ilike.${pattern},workshop_name.ilike.${pattern}`
        )
        .limit(Math.min(Number(input.limit) || 10, 15));
      if (error) return { error: error.message };
      return (data ?? []).map((u) => ({
        user_id: u.id,
        handle: u.handle,
        display_name: u.display_name,
        is_workshop: u.is_workshop,
        profile_path: `/user/${u.handle}`,
      }));
    }
    case 'find_similar_builds': {
      const { data: vehicle } = await ctx.supabase
        .from('vehicles')
        .select('make, model, year, nickname')
        .eq('id', vehicleId)
        .single();
      if (!vehicle?.make || !vehicle?.model) {
        return { error: 'Vehicle needs make and model to find similar builds' };
      }

      const { data: similar } = await ctx.supabase
        .from('vehicles')
        .select(
          `id, year, make, model, nickname, build_value, total_spend,
          owner:users!vehicles_current_owner_id_fkey ( id, handle, display_name, avatar_url )`
        )
        .eq('is_public', true)
        .ilike('make', vehicle.make)
        .ilike('model', vehicle.model)
        .neq('id', vehicleId)
        .neq('current_owner_id', ctx.userId)
        .order('build_value', { ascending: false, nullsFirst: false })
        .limit(Math.min(limit, 12));

      const { data: myMods } = await ctx.supabase
        .from('mods')
        .select('category')
        .eq('vehicle_id', vehicleId);
      const categories = [...new Set((myMods ?? []).map((m) => m.category))];

      let buildersWithOverlap: {
        handle: string;
        display_name: string;
        user_id: string;
        overlapping_categories: string[];
        profile_path: string;
      }[] = [];

      if (categories.length > 0) {
        const { data: modHits } = await ctx.supabase
          .from('mods')
          .select('category, vehicle_id')
          .in('category', categories)
          .limit(80);

        const vehicleIds = [
          ...new Set((modHits ?? []).map((m) => m.vehicle_id).filter((id) => id !== vehicleId)),
        ];

        if (vehicleIds.length > 0) {
          const { data: publicVehicles } = await ctx.supabase
            .from('vehicles')
            .select(
              `id, current_owner_id,
              owner:users!vehicles_current_owner_id_fkey ( id, handle, display_name )`
            )
            .in('id', vehicleIds)
            .eq('is_public', true)
            .neq('current_owner_id', ctx.userId);

          const ownerMap = new Map<
            string,
            { handle: string; display_name: string; user_id: string; categories: Set<string> }
          >();

          for (const m of modHits ?? []) {
            const pv = (publicVehicles ?? []).find((v) => v.id === m.vehicle_id);
            const owner = pv?.owner as { id: string; handle: string; display_name: string } | null;
            if (!owner?.handle) continue;
            let entry = ownerMap.get(owner.id);
            if (!entry) {
              entry = {
                user_id: owner.id,
                handle: owner.handle,
                display_name: owner.display_name,
                categories: new Set(),
              };
              ownerMap.set(owner.id, entry);
            }
            entry.categories.add(m.category);
          }

          buildersWithOverlap = [...ownerMap.values()]
            .map((o) => ({
              user_id: o.user_id,
              handle: o.handle,
              display_name: o.display_name,
              overlapping_categories: [...o.categories],
              profile_path: `/user/${o.handle}`,
            }))
            .slice(0, 10);
        }
      }

      return {
        your_vehicle: vehicleLabel(vehicle),
        similar_public_builds: (similar ?? []).map((v) => {
          const owner = v.owner as { handle: string; display_name: string } | null;
          return {
            vehicle_id: v.id,
            label: vehicleLabel(v),
            build_value: v.build_value,
            total_spend: v.total_spend,
            owner_handle: owner?.handle,
            owner_display_name: owner?.display_name,
            profile_path: owner?.handle ? `/user/${owner.handle}` : null,
          };
        }),
        builders_with_overlapping_mods: buildersWithOverlap,
      };
    }
    case 'follow_user': {
      const user = await resolveUserByHandle(ctx, input.handle);
      if ('error' in user) return user;
      if (user.id === ctx.userId) return { error: 'Cannot follow yourself' };
      const { count } = await ctx.supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', ctx.userId)
        .eq('followee_id', user.id);
      if ((count ?? 0) > 0) {
        return {
          ok: true,
          action: 'already_following',
          handle: user.handle,
          display_name: user.display_name,
        };
      }
      const { data, error } = await ctx.supabase.rpc('toggle_follow', {
        p_target_id: user.id,
      });
      if (error) return { error: error.message };
      const status = (data as { status?: string } | null)?.status ?? 'unknown';
      return {
        ok: true,
        action: status === 'requested' ? 'follow_requested' : 'followed',
        handle: user.handle,
        display_name: user.display_name,
        status,
        profile_path: `/user/${user.handle}`,
      };
    }
    case 'unfollow_user': {
      const user = await resolveUserByHandle(ctx, input.handle);
      if ('error' in user) return user;
      const { count } = await ctx.supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', ctx.userId)
        .eq('followee_id', user.id);
      if ((count ?? 0) === 0) {
        return { ok: true, action: 'not_following', handle: user.handle };
      }
      const { data, error } = await ctx.supabase.rpc('toggle_follow', {
        p_target_id: user.id,
      });
      if (error) return { error: error.message };
      const status = (data as { status?: string } | null)?.status ?? 'none';
      return {
        ok: true,
        action: 'unfollowed',
        handle: user.handle,
        display_name: user.display_name,
        status,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function handleClassifyBatch(ctx: AuthContext, body: ClassifyBody): Promise<Response> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return textResponse('AI not configured', 503);

  const { data: batch, error: batchErr } = await ctx.supabase
    .from('document_import_batches')
    .select('id, vehicle_id, status')
    .eq('id', body.batch_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (batchErr || !batch) return textResponse('Batch not found', 404);
  if (batch.status === 'applied' || batch.status === 'cancelled') {
    return textResponse('Batch already closed', 400);
  }

  const { data: items, error: itemsErr } = await ctx.supabase
    .from('document_import_items')
    .select('*')
    .eq('batch_id', batch.id);

  if (itemsErr) return textResponse('Could not load batch items', 500);
  if (!items?.length) return textResponse('No files in batch', 400);
  if (items.length > MAX_BATCH_FILES) {
    return textResponse(`Maximum ${MAX_BATCH_FILES} files per batch`, 400);
  }

  await ctx.supabase
    .from('document_import_batches')
    .update({ status: 'analyzing' })
    .eq('id', batch.id);

  const classified = [];

  for (const item of items) {
    try {
      const fileBytes = await downloadStorageFile(ctx.supabase, item.temp_storage_key);
      const proposal = await classifyDocument(apiKey, item.file_name, item.mime_type, fileBytes);

      const { data: updated, error: updateErr } = await ctx.supabase
        .from('document_import_items')
        .update({
          proposed_document_type: proposal.proposed_document_type,
          proposed_record_type: proposal.proposed_record_type,
          proposed_title: proposal.proposed_title,
          proposed_service_date: proposal.proposed_service_date,
          proposed_cost: proposal.proposed_cost,
          proposed_provider: proposal.proposed_provider,
          confidence: proposal.confidence,
          reasoning: proposal.reasoning,
        })
        .eq('id', item.id)
        .select('*')
        .single();

      if (updateErr) throw updateErr;
      classified.push(updated);
    } catch (err) {
      console.error('classify item failed', item.id, err);
      const fallback = {
        proposed_document_type: 'other',
        proposed_record_type: null,
        proposed_title: titleFromFileName(item.file_name),
        proposed_service_date: null,
        proposed_cost: null,
        proposed_provider: null,
        confidence: 'low',
        reasoning: 'Could not analyze this file automatically.',
      };
      const { data: updated } = await ctx.supabase
        .from('document_import_items')
        .update(fallback)
        .eq('id', item.id)
        .select('*')
        .single();
      if (updated) classified.push(updated);
    }
  }

  await ctx.supabase
    .from('document_import_batches')
    .update({ status: 'ready' })
    .eq('id', batch.id);

  return jsonResponse({ batch_id: batch.id, status: 'ready', items: classified });
}

async function downloadStorageFile(
  supabase: SupabaseClient,
  storageKey: string
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from('receipts').download(storageKey);
  if (error || !data) throw error ?? new Error('Download failed');
  return new Uint8Array(await data.arrayBuffer());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function classifyDocument(
  apiKey: string,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<{
  proposed_document_type: string;
  proposed_record_type: string | null;
  proposed_title: string;
  proposed_service_date: string | null;
  proposed_cost: number | null;
  proposed_provider: string | null;
  confidence: string;
  reasoning: string;
}> {
  const base64 = bytesToBase64(bytes);
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  const contentBlocks: unknown[] = [];

  if (isPdf) {
    contentBlocks.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    });
  } else if (isImage) {
    contentBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    });
  } else {
    throw new Error('Unsupported mime type');
  }

  contentBlocks.push({
    type: 'text',
    text: `Analyze this vehicle document (filename: ${fileName}). Return ONLY valid JSON with keys:
proposed_document_type (registration|insurance|service_receipt|invoice|inspection|other),
proposed_record_type (oil_change|general_service|major_service|inspection|tyres|brakes|registration|insurance|other|null — null if docs-only),
proposed_title (string),
proposed_service_date (YYYY-MM-DD or null),
proposed_cost (number or null, AUD),
proposed_provider (string or null),
confidence (high|medium|low),
reasoning (one short sentence).`,
  });

  const claude = await callClaude(apiKey, [{ role: 'user', content: contentBlocks }]);
  if (!claude.ok) {
    throw new Error(claude.error);
  }
  const content = Array.isArray(claude.data.content) ? claude.data.content : [];
  const text = content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n');

  return parseClassificationJson(text, fileName);
}

function parseClassificationJson(raw: string, fileName: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      /* fallback below */
    }
  }

  const docType = sanitizeDocumentType(String(parsed.proposed_document_type ?? 'other'));
  let recordType = parsed.proposed_record_type;
  const recordTypeStr =
    recordType == null || recordType === 'null' || recordType === ''
      ? null
      : sanitizeRecordType(String(recordType));

  return {
    proposed_document_type: docType,
    proposed_record_type: recordTypeStr,
    proposed_title: String(parsed.proposed_title ?? titleFromFileName(fileName)).slice(0, 200),
    proposed_service_date: sanitizeDate(parsed.proposed_service_date),
    proposed_cost: sanitizeCost(parsed.proposed_cost),
    proposed_provider: parsed.proposed_provider ? String(parsed.proposed_provider).slice(0, 200) : null,
    confidence: ['high', 'medium', 'low'].includes(String(parsed.confidence))
      ? String(parsed.confidence)
      : 'medium',
    reasoning: String(parsed.reasoning ?? 'Classified from document content.').slice(0, 500),
  };
}

function sanitizeDocumentType(value: string): string {
  return DOCUMENT_TYPES.has(value) ? value : 'other';
}

function sanitizeDate(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function sanitizeCost(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (!base) return 'Document';
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function handleApplyBatch(ctx: AuthContext, body: ApplyBody): Promise<Response> {
  const { data: batch, error: batchErr } = await ctx.supabase
    .from('document_import_batches')
    .select('id, vehicle_id, status')
    .eq('id', body.batch_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (batchErr || !batch) return textResponse('Batch not found', 404);
  if (batch.status === 'applied' || batch.status === 'cancelled') {
    return textResponse('Batch already closed', 400);
  }

  const { data: items } = await ctx.supabase
    .from('document_import_items')
    .select('*')
    .eq('batch_id', batch.id);

  const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
  const results: { id: string; document_id?: string; maintenance_record_id?: string; skipped?: boolean }[] =
    [];

  for (const patch of body.items ?? []) {
    const item = itemMap.get(patch.id);
    if (!item) continue;

    if (patch.status === 'skipped') {
      await ctx.supabase
        .from('document_import_items')
        .update({ status: 'skipped' })
        .eq('id', item.id);
      await ctx.supabase.storage.from('receipts').remove([item.temp_storage_key]);
      results.push({ id: item.id, skipped: true });
      continue;
    }

    const docType = sanitizeDocumentType(
      String(patch.proposed_document_type ?? item.proposed_document_type ?? 'other')
    );
    const title = String(patch.proposed_title ?? item.proposed_title ?? titleFromFileName(item.file_name)).slice(
      0,
      200
    );
    const recordTypeRaw = patch.proposed_record_type ?? item.proposed_record_type;
    const recordType =
      recordTypeRaw && MAINTENANCE_TYPES.has(String(recordTypeRaw))
        ? String(recordTypeRaw)
        : null;
    const serviceDate =
      sanitizeDate(patch.proposed_service_date) ??
      sanitizeDate(item.proposed_service_date) ??
      new Date().toISOString().slice(0, 10);
    const cost = patch.proposed_cost ?? item.proposed_cost ?? null;
    const provider = patch.proposed_provider ?? item.proposed_provider ?? null;

    const metadata = {
      import_batch_id: batch.id,
      confidence: item.confidence,
      reasoning: item.reasoning,
    };

    const { data: doc, error: docErr } = await ctx.supabase
      .from('vehicle_documents')
      .insert({
        vehicle_id: batch.vehicle_id,
        owner_id: ctx.userId,
        title,
        file_name: item.file_name,
        storage_key: item.temp_storage_key,
        mime_type: item.mime_type,
        file_size: item.file_size,
        document_type: docType,
        extracted_metadata: metadata,
      })
      .select('id')
      .single();

    if (docErr || !doc) {
      console.error('apply doc failed', docErr);
      continue;
    }

    let maintenanceRecordId: string | undefined;

    if (recordType) {
      const { data: record, error: recErr } = await ctx.supabase
        .from('maintenance_records')
        .insert({
          vehicle_id: batch.vehicle_id,
          owner_id: ctx.userId,
          record_type: recordType,
          title,
          service_date: serviceDate,
          date_is_approximate: !sanitizeDate(patch.proposed_service_date ?? item.proposed_service_date),
          cost,
          cost_is_approximate: cost != null,
          provider,
          notes: item.reasoning ? `Imported via Wired AI: ${item.reasoning}` : null,
        })
        .select('id')
        .single();

      if (!recErr && record) {
        maintenanceRecordId = record.id;
        await ctx.supabase.from('maintenance_record_documents').insert({
          maintenance_record_id: record.id,
          document_id: doc.id,
        });
      }
    }

    await ctx.supabase
      .from('document_import_items')
      .update({ status: 'accepted' })
      .eq('id', item.id);

    results.push({
      id: item.id,
      document_id: doc.id,
      maintenance_record_id: maintenanceRecordId,
    });
  }

  await ctx.supabase
    .from('document_import_batches')
    .update({ status: 'applied' })
    .eq('id', batch.id);

  return jsonResponse({ batch_id: batch.id, status: 'applied', results });
}

async function handleCancelBatch(ctx: AuthContext, body: CancelBody): Promise<Response> {
  const { data: batch } = await ctx.supabase
    .from('document_import_batches')
    .select('id, status')
    .eq('id', body.batch_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!batch) return textResponse('Batch not found', 404);
  if (batch.status === 'applied') return textResponse('Batch already applied', 400);

  const { data: items } = await ctx.supabase
    .from('document_import_items')
    .select('temp_storage_key')
    .eq('batch_id', batch.id);

  const keys = (items ?? []).map((i) => i.temp_storage_key).filter(Boolean);
  if (keys.length) {
    await ctx.supabase.storage.from('receipts').remove(keys);
  }

  await ctx.supabase.from('document_import_batches').update({ status: 'cancelled' }).eq('id', batch.id);

  return jsonResponse({ batch_id: batch.id, status: 'cancelled' });
}
