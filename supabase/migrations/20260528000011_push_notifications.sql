-- Wired Build — Push notifications via Expo Push API.
--
-- Strategy: a trigger fires after every insert on public.notifications,
-- looks up the recipient's push_token, builds a type-specific
-- title/body/deep-link, and POSTs to https://exp.host/--/api/v2/push/send
-- via the pg_net extension. No edge function, no external worker — the
-- DB is the entire backend.
--
-- pg_net is async (returns a request id and the HTTP call happens out of
-- band), so a slow / failing Expo Push request never blocks the trigger
-- or the originating insert. If the recipient has no token (or it isn't
-- an Expo push token) we silently skip.
--
-- The deep-link URL uses the app scheme `wiredbuilddemo://` (see
-- app.json). The Expo Router root layout strips the scheme and routes
-- to the path on tap (see src/lib/push-notifications.ts).

create extension if not exists pg_net with schema extensions;

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
-- pg_net lives in `extensions`; expose it on the search path.
set search_path = public, extensions
as $$
declare
  v_token text;
  v_title text;
  v_body  text;
  v_url   text;
  v_actor_name text;
  v_actor_handle text;
begin
  select push_token into v_token
  from public.users
  where id = new.user_id;

  if v_token is null or v_token = '' or v_token not like 'ExponentPushToken[%' then
    return new;
  end if;

  v_actor_handle := coalesce(new.payload->>'actor_handle', 'someone');
  v_actor_name   := coalesce(
    new.payload->>'actor_display_name',
    '@' || v_actor_handle
  );

  -- Branch on notification type. Mirrors src/app/notifications.tsx so
  -- the push wording matches what the user sees inside the app.
  if new.type = 'follow' then
    v_title := v_actor_name || ' followed you';
    v_body  := '@' || v_actor_handle || ' is now following your builds.';
    v_url   := 'wiredbuilddemo:///user/' || v_actor_handle;

  elsif new.type = 'reaction' then
    v_title := v_actor_name || ' liked your post';
    v_body  := 'Tap to see the post.';
    v_url   := 'wiredbuilddemo:///post/' || (new.payload->>'post_id');

  elsif new.type = 'comment' then
    if coalesce((new.payload->>'is_reply')::boolean, false) then
      v_title := v_actor_name || ' replied to you';
    else
      v_title := v_actor_name || ' commented on your post';
    end if;
    v_body  := coalesce(new.payload->>'preview', 'Tap to read the comment.');
    v_url   := 'wiredbuilddemo:///post/' || (new.payload->>'post_id');

  elsif new.type = 'ownership_transfer' then
    v_title := 'You received a build';
    v_body  := coalesce(
      new.payload->>'note',
      v_actor_name || ' transferred a vehicle to you.'
    );
    v_url   := 'wiredbuilddemo:///vehicle/' || (new.payload->>'vehicle_id');

  else
    v_title := 'Wired Build';
    v_body  := 'You have a new notification.';
    v_url   := 'wiredbuilddemo:///notifications';
  end if;

  -- Fire off the push. We discard the request id — receipts are best
  -- inspected via net._http_response if/when we need to debug delivery.
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Accept', 'application/json',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'to', v_token,
        'sound', 'default',
        'title', v_title,
        'body', v_body,
        'data', jsonb_build_object(
          'url', v_url,
          'notification_id', new.id,
          'type', new.type::text
        )
      )
    );
  exception when others then
    -- Never block the notification insert because of a push hiccup.
    raise warning 'send_push_for_notification failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists send_push_after_notification_insert on public.notifications;
create trigger send_push_after_notification_insert
after insert on public.notifications
for each row execute function public.send_push_for_notification();
