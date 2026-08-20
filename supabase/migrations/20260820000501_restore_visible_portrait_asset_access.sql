-- A member may load public character portraits and an image only when it is
-- attached to a visible token in the active, revealed scene. Template-only,
-- hidden-token, draft-scene, and other campaign assets remain DM-only.
drop policy if exists campaign_assets_allowed_select on storage.objects;
create policy campaign_assets_allowed_select on storage.objects for select to authenticated
using (bucket_id='campaign-assets' and (
  exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM'))
  or exists(select 1 from public.maps m join public.scenes s on s.map_id=m.id where m.storage_path=storage.objects.name and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id)))
  or exists(select 1 from public.scene_overlays o join public.scenes s on s.id=o.scene_id where o.storage_path=storage.objects.name and o.visible and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id)))
  or exists(select 1 from public.characters c where c.image_path=storage.objects.name and (select private.is_campaign_member(c.campaign_id)))
  or exists(select 1 from public.tokens t join public.scenes s on s.id=t.scene_id where t.image_path=storage.objects.name and t.visible and s.active and s.revealed and t.type in ('PLAYER','MONSTER','NPC') and (select private.is_campaign_member(s.campaign_id)))
));
