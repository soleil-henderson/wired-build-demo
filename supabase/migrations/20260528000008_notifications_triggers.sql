-- Wired Build — Notification triggers (Spec §4.6).
--
-- Emit notifications on follows, post reactions, and comments. The payload
-- denormalises actor/handle/display_name so the inbox UI doesn't need joins.
-- Self-actions (e.g. liking your own post) never produce a notification.
--
-- DELETE of a reaction or follow also removes the matching notification so the
-- inbox doesn't fill up with ghosts after a quick like / unlike.

-- ============================================================================
-- follows -> notify followee
-- ============================================================================

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower record;
begin
  if (tg_op = 'INSERT') then
    if new.follower_id = new.followee_id then
      return new;
    end if;
    select id, handle, display_name, avatar_url
      into v_follower
      from public.users
      where id = new.follower_id;

    insert into public.notifications (user_id, type, payload)
    values (
      new.followee_id,
      'follow',
      jsonb_build_object(
        'actor_id', v_follower.id,
        'actor_handle', v_follower.handle,
        'actor_display_name', v_follower.display_name,
        'actor_avatar_url', v_follower.avatar_url
      )
    );
    return new;
  elsif (tg_op = 'DELETE') then
    delete from public.notifications
    where user_id = old.followee_id
      and type = 'follow'
      and (payload->>'actor_id')::uuid = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_notify_trigger on public.follows;
create trigger follows_notify_trigger
after insert or delete on public.follows
for each row execute function public.notify_on_follow();

-- ============================================================================
-- reactions -> notify post owner (only post-target for now)
-- ============================================================================

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_actor record;
begin
  if (tg_op = 'INSERT') then
    if new.target_type <> 'post' then
      return new;
    end if;
    select id, user_id from public.posts where id = new.target_id into v_post;
    if v_post.user_id is null or v_post.user_id = new.user_id then
      return new;
    end if;
    select id, handle, display_name, avatar_url
      into v_actor
      from public.users
      where id = new.user_id;

    insert into public.notifications (user_id, type, payload)
    values (
      v_post.user_id,
      'reaction',
      jsonb_build_object(
        'actor_id', v_actor.id,
        'actor_handle', v_actor.handle,
        'actor_display_name', v_actor.display_name,
        'actor_avatar_url', v_actor.avatar_url,
        'post_id', v_post.id,
        'reaction_type', new.type::text
      )
    );
    return new;
  elsif (tg_op = 'DELETE') then
    if old.target_type <> 'post' then
      return old;
    end if;
    select user_id from public.posts where id = old.target_id into v_post;
    if v_post.user_id is null then
      return old;
    end if;
    delete from public.notifications
    where user_id = v_post.user_id
      and type = 'reaction'
      and (payload->>'actor_id')::uuid = old.user_id
      and (payload->>'post_id')::uuid = old.target_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists reactions_notify_trigger on public.reactions;
create trigger reactions_notify_trigger
after insert or delete on public.reactions
for each row execute function public.notify_on_reaction();

-- ============================================================================
-- comments -> notify post owner (and parent-comment author for replies)
-- ============================================================================

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_actor record;
  v_parent_author uuid;
  v_preview text;
begin
  if (tg_op <> 'INSERT') then
    return null;
  end if;

  select id, user_id from public.posts where id = new.post_id into v_post;
  if v_post.user_id is null then
    return new;
  end if;

  select id, handle, display_name, avatar_url
    into v_actor
    from public.users
    where id = new.user_id;

  v_preview := substring(coalesce(new.body, '') from 1 for 140);

  -- Notify post owner.
  if v_post.user_id <> new.user_id then
    insert into public.notifications (user_id, type, payload)
    values (
      v_post.user_id,
      'comment',
      jsonb_build_object(
        'actor_id', v_actor.id,
        'actor_handle', v_actor.handle,
        'actor_display_name', v_actor.display_name,
        'actor_avatar_url', v_actor.avatar_url,
        'post_id', v_post.id,
        'comment_id', new.id,
        'preview', v_preview,
        'is_reply', false
      )
    );
  end if;

  -- If this is a reply, also notify the parent comment's author (unless
  -- they're the same person we already notified or it's the actor themselves).
  if new.parent_comment_id is not null then
    select user_id into v_parent_author
      from public.comments
      where id = new.parent_comment_id;
    if v_parent_author is not null
       and v_parent_author <> new.user_id
       and v_parent_author <> v_post.user_id then
      insert into public.notifications (user_id, type, payload)
      values (
        v_parent_author,
        'comment',
        jsonb_build_object(
          'actor_id', v_actor.id,
          'actor_handle', v_actor.handle,
          'actor_display_name', v_actor.display_name,
          'actor_avatar_url', v_actor.avatar_url,
          'post_id', v_post.id,
          'comment_id', new.id,
          'preview', v_preview,
          'is_reply', true
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify_trigger on public.comments;
create trigger comments_notify_trigger
after insert on public.comments
for each row execute function public.notify_on_comment();
