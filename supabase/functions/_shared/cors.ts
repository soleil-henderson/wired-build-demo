export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function corsPreflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function textResponse(message: string, status: number): Response {
  return new Response(message, { status, headers: corsHeaders });
}

/** Anon/publishable key for auth.getUser() inside Edge Functions. */
export function getSupabaseAnonKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;

  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (publishable) return publishable;

  const keysJson = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (keysJson) {
    try {
      const parsed = JSON.parse(keysJson) as Record<string, string>;
      if (typeof parsed === 'object' && parsed !== null) {
        return (
          parsed.default ??
          parsed.anon ??
          parsed.publishable ??
          Object.values(parsed)[0] ??
          ''
        );
      }
    } catch {
      /* ignore */
    }
  }

  return '';
}
