import { EyeOff, Plus, Swords, Trash2, Upload, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useTabletop } from "../../contexts/TabletopContext";
import { isDmRole } from "../../domain/types";

export function EncounterPanel(){
  const {state,actions}=useTabletop();
  const [npcName,setNpcName]=useState("");
  const npcInput=useRef<HTMLInputElement>(null);
  if(!state)return null;
  const dm=isDmRole(state.role);

  const createNpc=async(file:File)=>{
    const name=npcName.trim();
    if(!name)return;
    await actions.createNpcTemplate(name,file);
    setNpcName("");
  };

  return <aside className="encounter-panel">
    <div className="panel-heading"><div><small>ENCOUNTER</small><h2>{state.combat.active?"Active combat":"Scene roster"}</h2></div></div>
    <div className="party-summary"><Users/><span><b>{state.characters.length} heroes</b><small>Characters available in this campaign</small></span></div>
    <p className="section-label">ON THE FIELD <span>{state.tokens.length}</span></p>
    {state.tokens.map(token=>{const monster=state.monsterInstances.find(m=>m.id===token.referenceId);const character=state.characters.find(c=>c.id===token.referenceId);return <button key={token.id} className={`creature-row ${state.selectedTokenId===token.id?"selected":""}`} onClick={()=>actions.selectToken(token.id)}><i className={token.type==="PLAYER"?"hero":""}>{token.displayName[0]}</i><span><b>{token.displayName}</b><small>{monster?`${monster.currentHp} / ${monster.maxHp} HP · AC ${monster.ac}`:character?`${character.currentHp} / ${character.maxHp} HP · AC ${character.ac}`:token.type}</small></span>{!token.visible&&<EyeOff/>}<em>{state.combat.entries.find(e=>e.tokenId===token.id||e.monsterInstanceId===token.referenceId)?.initiative??"—"}</em></button>)}
    {dm&&<>
      <p className="section-label">PLACE ON ACTIVE MAP</p>
      <p className="placement-help">Choose a character, monster, or NPC, then click its position on the map. Press Esc to cancel.</p>

      <p className="section-label">CHARACTERS <span>{state.characters.length}</span></p>
      {state.characters.map(character=><button className="library-row" key={character.id} onClick={()=>actions.startPlacement({kind:"CHARACTER",referenceId:character.id,name:character.name,imageUrl:character.imageUrl})}><span>{character.name}</span><b>Place <Plus/></b></button>)}

      <p className="section-label">MONSTER TEMPLATES <span>{state.monsterTemplates.length}</span></p>
      {state.monsterTemplates.map(template=><button className="library-row" key={template.id} onClick={()=>actions.startPlacement({kind:"MONSTER",referenceId:template.id,name:template.name,imageUrl:template.imageUrl})}><span>{template.name}</span><b>Place <Plus/></b></button>)}

      <p className="section-label">NPCS <span>{state.npcTemplates.length}</span></p>
      <div className="npc-create-row">
        <input value={npcName} maxLength={120} placeholder="NPC name" onChange={event=>setNpcName(event.target.value)}/>
        <input ref={npcInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void createNpc(file);event.target.value="";}}/>
        <button disabled={!npcName.trim()} title="Create NPC with portrait" onClick={()=>npcInput.current?.click()}><Upload/>Add</button>
      </div>
      {state.npcTemplates.map(template=><div className="npc-library-entry" key={template.id}>
        <button className="library-row" onClick={()=>actions.startPlacement({kind:"NPC",referenceId:template.id,name:template.name,imageUrl:template.imageUrl})}>
          <span>{template.imageUrl?<img src={template.imageUrl} alt=""/>:<i>{template.name[0]}</i>}{template.name}</span><b>Place <Plus/></b>
        </button>
        <button className="npc-delete" title={`Delete ${template.name}`} onClick={()=>void actions.deleteNpcTemplate(template.id)}><Trash2/></button>
      </div>)}

      {state.placement&&<button className="encounter-action" onClick={()=>actions.cancelPlacement()}><Swords/>PLACING · {state.placement.name} · ESC cancel</button>}
    </>}
  </aside>;
}
