-- Reaction/comment notifications respect user prefs; workshop mod verification RPC.

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
    if not public.notifications_enabled(v_post.user_id, 'reaction') then
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

  if v_post.user_id <> new.user_id
     and public.notifications_enabled(v_post.user_id, 'comment') then
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

  if new.parent_comment_id is not null then
    select user_id into v_parent_author
      from public.comments
      where id = new.parent_comment_id;
    if v_parent_author is not null
       and v_parent_author <> new.user_id
       and v_parent_author <> v_post.user_id
       and public.notifications_enabled(v_parent_author, 'comment') then
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

-- Workshop confirms an install they performed (installer_workshop_id must match caller).
create or replace function public.workshop_verify_mod(p_mod_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_workshop boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select is_workshop into v_is_workshop from public.users where id = v_uid;
  if not coalesce(v_is_workshop, false) then
    raise exception 'Only workshop accounts can verify installs';
  end if;

  update public.mods
  set is_verified_by_workshop = true
  where id = p_mod_id
    and installer_workshop_id = v_uid
    and installer_type = 'workshop';

  if not found then
    raise exception 'Mod not found or not tagged to your workshop';
  end if;
end;
$$;

grant execute on function public.workshop_verify_mod(uuid) to authenticated;
