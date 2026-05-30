-- Social UX: mod product links + video media kind.

alter type media_kind add value if not exists 'video';

alter table public.mods
  add column if not exists product_links jsonb not null
  default '{"primary":null,"extras":[]}'::jsonb;

comment on column public.mods.product_links is
  'Primary product URL plus ancillary products: {"primary":{"name","url"},"extras":[{"name","url","purpose"}]}';
