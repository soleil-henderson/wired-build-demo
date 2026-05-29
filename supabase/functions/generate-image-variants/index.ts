// After mod-photos upload: set thumbnail_url on media row (Supabase transform URL).
// POST { bucket, path, media_id? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json() as {
    bucket?: string;
    path?: string;
    media_id?: string;
    public_url?: string;
  };

  if (body.bucket !== 'mod-photos' || !body.public_url) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const thumbnailUrl = `${body.public_url}?width=400&quality=75`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  if (body.media_id) {
    await supabase
      .from('media')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', body.media_id);
  } else if (body.path) {
    await supabase
      .from('media')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('storage_key', body.path);
  }

  return new Response(JSON.stringify({ ok: true, thumbnail_url: thumbnailUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
