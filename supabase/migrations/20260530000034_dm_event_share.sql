-- DM event_share policy (separate migration — enum value must commit first).

drop policy if exists "direct_messages: participant insert" on public.direct_messages;
create policy "direct_messages: participant insert"
on public.direct_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
  and (
    message_type::text is distinct from 'event_share'
    or (
      event_id is not null
      and public.can_view_event(event_id, auth.uid())
    )
  )
);
