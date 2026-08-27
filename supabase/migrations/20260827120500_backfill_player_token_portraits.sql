-- Keep player token portraits self-contained, including older placed tokens.

update public.tokens t
set image_path = c.image_path,
    image_url = case when c.image_path is not null then null else c.image_url end,
    updated_at = now()
from public.characters c
where t.type = 'PLAYER'
  and t.reference_id = c.id
  and (
    t.image_path is distinct from c.image_path
    or (
      c.image_path is not null
      and t.image_url is not null
    )
  );

-- Signed URLs expire, so keep the permanent storage path as source of truth.
update public.characters
set image_url = null,
    updated_at = now()
where image_path is not null
  and image_url is not null;

create or replace function private.sync_character_portrait_to_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_path is distinct from old.image_path
     or new.image_url is distinct from old.image_url then
    update public.tokens
    set image_path = new.image_path,
        image_url = case when new.image_path is not null then null else new.image_url end,
        updated_at = now()
    where type = 'PLAYER'
      and reference_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_character_portrait_tokens on public.characters;
create trigger sync_character_portrait_tokens
after update of image_path,image_url on public.characters
for each row execute function private.sync_character_portrait_to_tokens();

revoke execute on function private.sync_character_portrait_to_tokens() from public,anon,authenticated;
