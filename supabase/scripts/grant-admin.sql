-- Run in Supabase SQL Editor (or psql) to grant admin + optional tier for QA.
-- Replace the handle below.

update public.users
set
  is_admin = true,
  subscription_tier = 'pro'
where handle = 'your_handle_here';
