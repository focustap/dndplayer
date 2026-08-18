-- Bring already-placed PLAYER tokens into line with their character assignment.
-- Future reassignments are handled by sync_character_player_token_owner().
update public.tokens as token
set owner_user_id = character.owner_id,
    updated_at = now()
from public.characters as character,
     public.scenes as scene
where token.type = 'PLAYER'
  and token.reference_id = character.id
  and scene.id = token.scene_id
  and scene.campaign_id = character.campaign_id
  and token.owner_user_id is distinct from character.owner_id;
