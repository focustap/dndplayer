// Authoring data only. Imported by the offline planner, never by the production bundle.
// NPCs intentionally contain no dialogue. Secrets belong in chapter/campaign notes.
export const scenes = [
  ['square', 'Sunpetal Square'], ['inn', 'The Golden Finch Inn'],
  ['bakery', 'Honeycrust Bakery'], ['store', 'Bramble & Brass'],
  ['cottage', "Ada Rook's Cottage"], ['court', 'Lornwatch Courthouse'],
  ['cells', 'Holding Cells'], ['basement', 'Lower Chamber'], ['cave', 'Mossjaw Cavern'],
].map(([key,title],i)=>({key,name:`Lornwatch ${String(i+1).padStart(2,'0')} — ${title}`,width:1536,height:1024,
  grid_type:['basement','cave','cells'].includes(key)?'SQUARE':'GRIDLESS',grid_size:64,feet_per_cell:5,lighting:'DAY'}));
export const links = [
  ...[['inn',525,760],['bakery',280,395],['store',1210,760],['cottage',1260,300],['court',785,185],['cave',1420,900]].map(([key,x,y])=>['square',key,scenes.find(s=>s.key===key).name.split(' — ')[1],x,y]),
  ...['inn','bakery','store','cottage','court','cave'].map(key=>[key,'square','Sunpetal Square',768,935]),
  ['store','cave','Livestock trail',1300,650],['cave','store','Return to Bramble & Brass',200,850],
  ['court','cells','Holding corridor',1250,190],['cells','court','Public registry',700,900],
  ['court','basement','Service stairs — DM controls access',1250,700],
  ['cells','basement','Service stair landing — DM controls access',900,150],
  ['basement','court','Courthouse stairs',768,940],
];
const item=(name,price_gp,quantity=20,description='Mundane goods or service; DM resolves use.')=>({name,price_gp,quantity,description});
export const npcs=[
  {key:'mira',name:'Mira Fen',scene:'inn',x:1150,y:430,shop:[item('Supper',0.5),item('Bed',0.5),item('Private room',2,6),item('Tea',0.1),item('Rations',0.5)]},
  {key:'pippa',name:'Pippa Bell',scene:'bakery',x:1050,y:370,shop:[item('Berry bun',0.1),item('Bread',0.2),item('Pie',1,6),item('Livestock lure scraps',0.2,3)]},
  {key:'oren',name:'Oren Bramble',scene:'store',x:1050,y:400,shop:[item('Rope (50 ft)',1),item('Torch',0.01),item('Rations',0.5),item('Waterskin',0.2),item('Crowbar',2),item('Shovel',2),item('Hunting trap',5,3),item("Healer's kit",5,2),item('Ball bearings',1),item('Sack',0.01)]},
  {key:'ada',name:'Ada Rook',scene:'cottage',x:800,y:450},
  {key:'ilanPortrait',name:'Judge Ilan Rook',scene:'court',x:768,y:260},
  {key:'sera',name:'Sera Pell',scene:'court',x:1100,y:550},
  {key:'jory',name:'Jory Reed',scene:'square',x:620,y:700},
  {key:'nell',name:'Nell Reed',scene:'square',x:690,y:720},
  {key:'guard',name:'Lornwatch Guard',scene:'square',x:540,y:700},
  {key:'guard',name:'Lornwatch Guard',scene:'square',x:560,y:780},
  {key:'martha',name:'Martha Bell',scene:'cells',x:1050,y:450,hidden:true},
  {key:'jory',name:'Jory Reed',scene:'cells',x:1050,y:650,hidden:true},
  {key:'nell',name:'Nell Reed',scene:'inn',x:1020,y:340,hidden:true},
  {key:'ada',name:'Ada Rook',scene:'square',x:415,y:165,hidden:true},
];
const action=(name,description,attackBonus=null,dice=null,damageType='Force',ranged=false)=>({name,description,kind:'ACTION',usage:null,attackType:attackBonus===null?'OTHER':ranged?'SPELL':'MELEE',attackBonus,reach:ranged?null:5,range:ranged?{normal:60,long:60,unit:'ft'}:null,damage:dice?[{average:null,dice,flatBonus:Number(dice.match(/\+(\d+)/)?.[1]??0),damageType}]:[],save:null,conditions:[],effects:[],variants:[]});
const creature=(key,name,hp,ac,actions,extra={})=>({key,name,max_hp:hp,ac,speed:30,creature_size:'Medium',creature_type:'humanoid',abilities:{str:10,dex:12,con:14,int:10,wis:12,cha:10},actions,traits:[],bonus_actions:[],reactions:[],notes:'',...extra});
export const monsters=[
  creature('ilan','Lornwatch — Ilan Rook',90,15,[{...action('Judicial force','Two force bolts.'),kind:'MULTIATTACK',multiattack:{count:2,options:'Force bolt',description:'Two Force bolt attacks.'}},action('Force bolt','Ranged spell attack +5, 60 ft, 1d6+3 force.',5,'1d6+3','Force',true)],{abilities:{str:10,dex:12,con:14,int:16,wis:12,cha:16},saving_throws:{Wisdom:3,Charisma:5}}),
  creature('sphere','Lornwatch — Dark sphere',60,13,[],{speed:0,creature_type:'object',damage_immunities:['Poison','Psychic'],condition_immunities:['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']}),
  creature('owlbear','Lornwatch — Owlbear',59,13,[{...action('Multiattack','One Beak and one Claws attack.'),kind:'MULTIATTACK',multiattack:{count:2,options:'Beak, Claws',description:'One Beak and one Claws.'}},action('Beak','Melee +7, 1d10+5 piercing.',7,'1d10+5','Piercing'),action('Claws','Melee +7, 2d8+5 slashing.',7,'2d8+5','Slashing')],{speed:40,creature_size:'Large',creature_type:'monstrosity',abilities:{str:20,dex:12,con:17,int:3,wis:12,cha:7},traits:[{name:'Keen Sight and Smell',description:'Advantage on sight/smell Perception checks.'}]}),
  creature('cub','Lornwatch — Owlbear cub',10,11,[],{speed:25,creature_size:'Small',creature_type:'monstrosity'}),
  creature('guard','Lornwatch — Court guard',11,16,[action('Spear','Melee +3, 1d6+1 piercing.',3,'1d6+1','Piercing')]),
];
export const encounters=[
  {key:'basement',name:'[Lornwatch] Courthouse basement',members:[['ilan',1],['sphere',1]],notes:'DM ONLY. Canon LORNWATCH sections07–08. Turn action Recharge5–6, DC14DEX brace or slide15ft chosen toward/away Ilan or compass; blocked by terrain, no damage/opportunity attacks. Half-sphere weakens to DC12/10ft. DM narrates, clicks Cinematics Turn, resolves saves and moves tokens. Sphere is Catalyst. Ilan AC15 HP90, sphere AC13 HP60. One telegraphed temporary writ, initiative20, one full turn warning, affects Ilan too. Wax seal AC10 HP5 or action DC12 cite defect ends writ. At sphere30HP end writ; future DC10 first offender only. Ilan0 does not end sphere; sphere0 ends laws, can save Ilan. Only then show Silent implosion and Old foundation stone (VII). Ada detail costs Ilan one action once. Retreat always possible. Easy65/40HP, one bolt; no execution of downed PCs.120gp,2 potions; resolve manually.'},
  {key:'cave',name:'[Lornwatch] Mossjaw nesting ground',members:[['owlbear',1]],notes:'DM ONLY. Optional, no Hollow connection. One adult, cub noncombatant. Starts only if cornered/attacked/nest threatened. Food + two practical efforts can relocate; DC13 Handling buys calm, failure warning charge/retreat. Retreat to cub bloodied, no pursuit. Stream difficult, boulders cover. Easy45HP one attack, hard65HP.40gp for ending livestock losses by any route; satchel12gp,potion,brooch8gp. Do not add cub to initiative.'},
  {key:'court',name:'[Lornwatch] Optional watch confrontation',members:[['guard',2]],notes:'DM ONLY. Not mandatory. Offer hearing before force; guards defend/disengage, nonlethal, surrender when one falls. No reinforcements or permanent plot lock.'},
];
export const placements=[
  {scene:'basement',monster:'ilan',x:768,y:420,size:1}, {scene:'basement',monster:'sphere',x:768,y:250,size:2},
  {scene:'cave',monster:'owlbear',x:960,y:400,size:2}, {scene:'cave',monster:'cub',x:1200,y:250,size:0.6},
  {scene:'court',monster:'guard',x:400,y:600,size:1}, {scene:'court',monster:'guard',x:500,y:600,size:1},
];
// Images are physical evidence only; NPC story text never appears in these.
export const documents=[
  {key:'ordinances',scene:'square',name:'Municipal notices',x:1100,y:720,text:'LORNWATCH — MUNICIPAL NOTICES\nOrdinance 14: Unauthorized removal of public property, including public flowers, is punishable by seven days imprisonment.\nAppeals and requests for a hearing: public registry, Lornwatch Courthouse.\nKeep fountain paths clear. Market closes at sunset.'},
  {key:'memorial',scene:'square',name:'Memorial inscription',x:365,y:100,text:'IN MEMORY OF TOMAS ROOK\nBeloved son, brother and neighbor.\nMay kindness outlast our grief.'},
  {key:'ledger',scene:'inn',name:'Guest ledger',x:1150,y:500,text:'GOLDEN FINCH — GUEST ACCOUNTS\nThree bookings ended after municipal detention. Belongings held for families.\nPetitions for release: public registry.\nNo charge for the child staying in the kitchen room.'},
  {key:'sentence',scene:'bakery',name:'Martha Bell sentencing order',x:980,y:300,text:'PUBLIC SENTENCING COPY\nMartha Bell — sale of overcooked public-market goods.\nSentence: fourteen days detention.\nPrior sanction for same offense: written warning.\nAppeal may be filed at the public registry.'},
  {key:'livestock',scene:'store',name:'Livestock notice',x:600,y:350,text:'FARMS NEED HELP\nGoats and sheep taken near Mossjaw Ravine. Large clawed tracks on the stream trail.\n40 gold for ending the losses. A safe relocation or secure pens is welcome.\nAsk at Bramble & Brass for the trail. Follow stream northeast to limestone cave.'},
  {key:'comparison',scene:'court',name:'Ordinance revision register',x:1080,y:600,text:'PUBLIC REVISION REGISTER\nThree months ago: public flower removal — replace plant or pay restitution.\nCurrent: seven days imprisonment.\nMarket food violations: warning revised to fourteen days.\nRecent revisions entered following courthouse foundation inspection.'},
  {key:'case',scene:'court',name:'Tomas Rook case record',x:1050,y:500,text:'ARCHIVED CASE — TOMAS ROOK\nVictim killed near a tavern.\nDefendant acquitted: evidence chain of custody failed after handling errors.\nIlan Rook appears as next of kin, not presiding judge.\nFamily copy available to Ada Rook.'},
  {key:'survey',scene:'court',name:'Civic survey report',x:1000,y:400,text:'FOUNDATION SURVEY — SERA PELL\nA cavity was found beneath the courthouse. Compass deflection recorded at the service landing.\nAfter-hours inspections signed I.R.\nAccess: east registry door, holding corridor, stairs downward.\nDuplicate measurements dispatched along Glass Road to the regional survey archive; delivery receipt requests originals.'},
  {key:'arrests',scene:'cells',name:'Detention register',x:550,y:500,text:'CURRENT DETENTION REGISTER\nJory Reed: public flower removal.\nMartha Bell: overcooked market goods.\nSera Pell: retained as records witness; assigned registry duties.\nRelease petitions received at public hearing desk.'},
  {key:'finale',scene:'basement',name:'Silent implosion',x:780,y:250,hidden:true},
  {key:'vii',scene:'basement',name:'Old foundation stone',x:800,y:280,hidden:true,text:'VII'},
];
export const assets=Object.fromEntries([
  ...scenes.map(s=>[s.key,`maps/${s.key}.png`]),
  ...[...new Set(npcs.map(n=>n.key))].map(key=>[key,`portraits/${key}.png`]),
  ...['ilan','sphere','owlbear','cub'].map(key=>[key,`tokens/${key}.png`]),
  ...documents.map(d=>[d.key,`discoverables/${d.key}.png`]),
]);
