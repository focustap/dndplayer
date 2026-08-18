-- Keep placed PLAYER tokens attached to the character's current assigned player.
-- This runs under the character update caller, so the existing DM-only token RLS
-- policy remains the authorization boundary for reassignments.
create or replace function private.sync_character_player_token_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.tokens as token
  set owner_user_id = new.owner_id,
      updated_at = now()
  from public.scenes as scene
  where token.scene_id = scene.id
    and scene.campaign_id = new.campaign_id
    and token.type = 'PLAYER'
    and token.reference_id = new.id
    and token.owner_user_id is distinct from new.owner_id;

  return new;
end;
$$;

drop trigger if exists sync_character_player_token_owner on public.characters;
create trigger sync_character_player_token_owner
after update of owner_id on public.characters
for each row
when (old.owner_id is distinct from new.owner_id)
execute function private.sync_character_player_token_owner();
