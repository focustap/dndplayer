-- A campaign INSERT that requests RETURNING is also subject to the campaign
-- SELECT policy. The owner membership is created by an AFTER INSERT trigger,
-- so allow the owner to read the just-created row without depending on that
-- membership bootstrap.
drop policy if exists campaigns_member_select on public.campaigns;

create policy campaigns_member_select
on public.campaigns
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_campaign_member(id))
);
