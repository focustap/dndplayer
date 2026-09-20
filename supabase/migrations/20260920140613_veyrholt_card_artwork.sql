-- Real Worker-returned R2 paths for one campaign's Dealer deck and investigation art.
create table public.campaign_card_artwork (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  asset_key text not null check (asset_key in ('redClue','nineClue','heartsClue','jester','blade','glass','saint','dead-man','crown','chains','mirror','miser','fool','duelist','hound','debt')),
  storage_path text not null,
  updated_at timestamptz not null default now(),
  primary key (campaign_id,asset_key),
  check (length(storage_path) between 40 and 512)
);
alter table public.campaign_card_artwork enable row level security;
revoke all on public.campaign_card_artwork from anon, authenticated;
grant select, insert, update on public.campaign_card_artwork to authenticated;
create policy campaign_card_artwork_dm on public.campaign_card_artwork for all to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])))
with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) and storage_path like campaign_id::text || '/%');
