// Authoring data only. Imported by the offline planner, never by the production bundle.
// NPCs intentionally contain no dialogue. Secrets belong in chapter/campaign notes.
export const scenes = [
  ['square', 'Sunpetal Square'], ['inn', 'The Golden Finch Inn'],
  ['bakery', 'Honeycrust Bakery'], ['store', 'Bramble & Brass'],
  ['cottage', "Ada Rook's Cottage"], ['court', 'Courthouse'],
  ['cells', 'Holding Cells'], ['basement', 'Lower Chamber'], ['cave', 'Mossjaw Cavern'],
].map(([key,title])=>({key,name:`Lornwatch - ${title}`,width:1536,height:1024,
  grid_type:['basement','cave','cells'].includes(key)?'SQUARE':'GRIDLESS',grid_size:64,feet_per_cell:5,lighting:'DAY'}));
// Append only: older index-derived placement/link IDs must never be reassigned.
scenes.push({key:'crossing',name:'Glass Road - The Broken Crossing',width:1536,height:1024,grid_type:'SQUARE',grid_size:64,feet_per_cell:5,lighting:'DAY'});
export const links = [
  ...[['inn',525,760],['bakery',280,395],['store',1210,760],['cottage',1260,300],['court',785,185],['cave',1420,900]].map(([key,x,y])=>['square',key,scenes.find(s=>s.key===key).name.replace(/^Lornwatch - /,''),x,y]),
  ...['inn','bakery','store','cottage','court','cave'].map(key=>[key,'square','Sunpetal Square',768,935]),
  ['store','cave','Livestock trail',1300,650],['cave','store','Return to Bramble & Brass',200,850],
  ['court','cells','Holding corridor',1250,190],['cells','court','Public registry',700,900],
  ['court','basement','Service stairs — DM controls access',1260,625],
  ['cells','basement','Service stair landing — DM controls access',900,150],
  ['basement','court','Courthouse stairs',768,940],
  ['square','crossing','Glass Road — Broken Crossing',768,990],
  ['crossing','square','East road — Lornwatch',1450,430],
  ['crossing','square','South ford — Lornwatch',1220,720],
];
const item=(name,price_gp,quantity=20,description='')=>({name,price_gp,quantity,description});
export const npcs=[
  {key:'mira',name:'Mira Fen',scene:'inn',x:1150,y:430,shop:[item('Supper',0.5),item('Bed',0.5,20,'One overnight stay in the common room; the DM assigns a bed.'),item('Private room',2,6,'One private room for one night; the DM manages occupancy.'),item('Tea',0.1),item('Rations',0.5),item('Hearthstone',5,4,'Campaign item: returns the party to an inn. The DM records the destination inn and resolves its use manually; purchasing does not teleport anyone or move tokens.'),item('Ale (mug)',0.04,30)]},
  {key:'pippa',name:'Pippa Bell',scene:'bakery',x:590,y:210,shop:[item('Berry bun',0.1),item('Bread',0.2),item('Pie',1,6),item('Livestock lure scraps',0.2,3)]},
  {key:'oren',name:'Oren Bramble',scene:'store',x:1050,y:400,shop:[item('Rope (50 ft)',1),item('Torch',0.01),item('Rations',0.5),item('Waterskin',0.2),item('Crowbar',2),item('Shovel',2),item('Hunting trap',5,3),item("Healer's kit",5,2),item('Ball bearings',1),item('Sack',0.01)]},
  {key:'ada',name:'Ada Rook',scene:'cottage',x:800,y:450},
  {key:'ilanPortrait',name:'Judge Ilan Rook',scene:'court',x:768,y:260},
  {key:'sera',name:'Sera Pell',scene:'court',x:1100,y:550},
  {key:'jory',name:'Jory Reed',scene:'square',x:770,y:660},
  {key:'nell',name:'Nell Reed',scene:'square',x:810,y:700},
  {key:'guard',name:'Lornwatch Guard',scene:'square',x:700,y:650},
  {key:'guard',name:'Lornwatch Guard',scene:'square',x:900,y:650},
  {key:'martha',name:'Martha Bell',scene:'cells',x:1050,y:450,hidden:true},
  {key:'jory',name:'Jory Reed',scene:'cells',x:1050,y:650,hidden:true},
  {key:'nell',name:'Nell Reed',scene:'inn',x:1020,y:340,hidden:true},
  {key:'ada',name:'Ada Rook',scene:'square',x:415,y:165,hidden:true},
  {key:'elsi',name:'Elsi Marr',scene:'crossing',x:475,y:460},
  {key:'tavin',name:'Tavin Holt',scene:'crossing',x:760,y:390},
  {key:'horse',name:'Bracken',scene:'crossing',x:780,y:470,size:2},
  {key:'lina',name:'Lina Sedge',scene:'square',x:350,y:430,shop:[item('Vegetable hand pie',0.2,12),item('Cup of hot broth',0.05,20),item('Grilled onion skewer',0.05,16),item('Cup of cider',0.04,20)]},
  {key:'bram',name:'Bram Nettles',scene:'square',x:1130,y:420,shop:[item('Bag of apples',0.1,12),item('Carrots (bunch)',0.05,15),item('Potatoes (sack)',0.2,8),item('Fresh herbs (bundle)',0.05,10)]},
  {key:'tessa',name:'Tessa Bloom',scene:'square',x:660,y:300,shop:[item('Single cultivated flower',0.02,30,'Purchased flower grown for sale; not taken from public beds.'),item('Small bouquet',0.1,10),item('Potted marigold',0.2,6),item('Herb seedlings',0.1,8)]},
  {key:'daro',name:'Daro Flint',scene:'square',x:1160,y:800,shop:[item('Soap',0.02,16),item('Candle',0.01,30),item('Twine (50 ft)',0.1,10),item('Needle and thread',0.05,12),item('Wooden cup',0.02,15),item('Carved wooden charm',0.1,10,'A small ordinary keepsake; no magical effects.'),item('Chalk (piece)',0.01,20),item('Belt pouch',0.5,6)]},
  ...[
    ['residentWorker','Town resident — worker','Market shopper',400,460],
    ['residentWeaver','Town resident — weaver','Flower shopper',710,285],
    ['residentElder','Town resident — elder','Neighbors by the fountain',914,580],
    ['residentWeaver','Town resident — weaver','Neighbor on fountain bench',700,560],
    ['residentWorker','Town resident — worker','Porter on delivery',1430,850],
    ['residentElder','Town resident — elder','Friends by the lane',1020,322],
    ['residentWeaver','Town resident — weaver','Friends by the lane',1060,350],
    ['residentWorker','Town resident — worker','Traveler entering town',800,860],
  ].map(([key,name,label,x,y])=>({key,name,label,scene:'square',x,y})),
  ...[
    ['residentWorker','Town resident — worker','Finch patron — supper',360,603],
    ['residentWeaver','Town resident — weaver','Finch patron — cider',430,607],
    ['residentElder','Town resident — elder','Finch patron — stew',450,493],
    ['residentWeaver','Town resident — weaver','Finch patron — conversation',555,535],
    ['residentWorker','Town resident — worker','Finch patron — meal',480,338],
    ['residentElder','Town resident — elder','Finch patron — bar stool',975,450],
  ].map(([key,name,label,x,y])=>({key,name,label,scene:'inn',x,y})),
  ...[
    ['residentWorker','Town resident — worker','Bakery customer — tea',295,595],
    ['residentWeaver','Town resident — weaver','Bakery customer — bun',380,595],
    ['residentElder','Town resident — elder','Bakery customer — breakfast',375,375],
    ['residentWeaver','Town resident — weaver','Bakery customer — pie',610,610],
  ].map(([key,name,label,x,y])=>({key,name,label,scene:'bakery',x,y})),
  ...[
    ['residentWorker','Town resident — worker','Petitioner — boundary dispute',420,515],
    ['residentWeaver','Town resident — weaver','Petitioner — market license',460,570],
    ['residentElder','Town resident — elder','Resident waiting for hearing',400,625],
    ['residentWeaver','Town resident — weaver','Registry clerk',1190,360],
    ['residentWorker','Town resident — worker','Copying clerk',1210,500],
    ['guard','Lornwatch Guard','Door guard',790,730],
    ['guard','Lornwatch Guard','Service corridor guard',1120,640],
  ].map(([key,name,label,x,y])=>({key,name,label,scene:'court',x,y})),
];
const action=(name,description,attackBonus=null,dice=null,damageType='Force',ranged=false)=>({name,description,kind:'ACTION',usage:null,attackType:attackBonus===null?'OTHER':ranged?'SPELL':'MELEE',attackBonus,reach:ranged?null:5,range:ranged?{normal:60,long:60,unit:'ft'}:null,damage:dice?[{average:null,dice,flatBonus:Number(dice.match(/\+(\d+)/)?.[1]??0),damageType}]:[],save:null,conditions:[],effects:[],variants:[]});
const creature=(key,name,hp,ac,actions,extra={})=>({key,name,max_hp:hp,ac,speed:30,creature_size:'Medium',creature_type:'humanoid',abilities:{str:10,dex:12,con:14,int:10,wis:12,cha:10},actions,traits:[],bonus_actions:[],reactions:[],notes:'',...extra});
export const monsters=[
  creature('ilan','Lornwatch — Ilan Rook',90,15,[{...action('Judicial force','Two force bolts.'),kind:'MULTIATTACK',multiattack:{count:2,options:'Force bolt',description:'Two Force bolt attacks.'}},action('Force bolt','Ranged spell attack +5, 60 ft, 1d6+3 force.',5,'1d6+3','Force',true)],{abilities:{str:10,dex:12,con:14,int:16,wis:12,cha:16},saving_throws:{Wisdom:3,Charisma:5}}),
  creature('sphere','Lornwatch — Dark sphere',60,13,[],{speed:0,creature_type:'object',damage_immunities:['Poison','Psychic'],condition_immunities:['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']}),
  creature('owlbear','Lornwatch — Owlbear',59,13,[{...action('Multiattack','One Beak and one Claws attack.'),kind:'MULTIATTACK',multiattack:{count:2,options:'Beak, Claws',description:'One Beak and one Claws.'}},action('Beak','Melee +7, 1d10+5 piercing.',7,'1d10+5','Piercing'),action('Claws','Melee +7, 2d8+5 slashing.',7,'2d8+5','Slashing')],{speed:40,creature_size:'Large',creature_type:'monstrosity',abilities:{str:20,dex:12,con:17,int:3,wis:12,cha:7},traits:[{name:'Keen Sight and Smell',description:'Advantage on sight/smell Perception checks.'}]}),
  creature('cub','Lornwatch — Owlbear cub',10,11,[],{speed:25,creature_size:'Small',creature_type:'monstrosity'}),
  creature('guard','Lornwatch — Court guard',11,16,[action('Spear','Melee +3, 1d6+1 piercing.',3,'1d6+1','Piercing')]),
  creature('highwaymanCaptain','Lornwatch — Highwayman captain',27,14,[{...action('Multiattack','Two Shortsword attacks.'),kind:'MULTIATTACK',multiattack:{count:2,options:'Shortsword',description:'Two Shortsword attacks, or one crossbow attack instead.'}},action('Shortsword','Melee +4, 1d6+2 piercing.',4,'1d6+2','Piercing'),{...action('Light crossbow','Ranged +4, 1d8+2 piercing,80/320ft.',4,'1d8+2','Piercing'),attackType:'RANGED',reach:null,range:{normal:80,long:320,unit:'ft'}}],{abilities:{str:12,dex:14,con:12,int:10,wis:10,cha:12}}),
  creature('highwayman','Lornwatch — Highwayman',11,12,[action('Scimitar','Melee +3, 1d6+1 slashing.',3,'1d6+1','Slashing'),{...action('Light crossbow','Ranged +3, 1d8+1 piercing,80/320ft.',3,'1d8+1','Piercing'),attackType:'RANGED',reach:null,range:{normal:80,long:320,unit:'ft'}}]),
];
export const encounters=[
  {key:'basement',name:'[Lornwatch] Courthouse basement',members:[['ilan',1],['sphere',1]],notes:'DM ONLY. Canon LORNWATCH sections07–08. Turn action Recharge5–6, DC14DEX brace or slide15ft chosen toward/away Ilan or compass; blocked by terrain, no damage/opportunity attacks. Half-sphere weakens to DC12/10ft. DM narrates, clicks Cinematics Turn, resolves saves and moves tokens. Sphere is Catalyst. Ilan AC15 HP90, sphere AC13 HP60. One telegraphed temporary writ, initiative20, one full turn warning, affects Ilan too. Wax seal AC10 HP5 or action DC12 cite defect ends writ. At sphere30HP end writ; future DC10 first offender only. Ilan0 does not end sphere; sphere0 ends laws, can save Ilan. Only then show Silent implosion and Old foundation stone (VII). Ada detail costs Ilan one action once. Retreat always possible. Easy65/40HP, one bolt; no execution of downed PCs.120gp,2 potions; resolve manually.'},
  {key:'cave',name:'[Lornwatch] Mossjaw nesting ground',members:[['owlbear',1]],notes:'DM ONLY. Optional, no Hollow connection. One adult, cub noncombatant. Starts only if cornered/attacked/nest threatened. Food + two practical efforts can relocate; DC13 Handling buys calm, failure warning charge/retreat. Retreat to cub bloodied, no pursuit. Stream difficult, boulders cover. Easy45HP one attack, hard65HP.40gp for ending livestock losses by any route; satchel12gp,potion,brooch8gp. Do not add cub to initiative.'},
  {key:'court',name:'[Lornwatch] Optional watch confrontation',members:[['guard',2]],notes:'DM ONLY. Not mandatory. Offer hearing before force; guards defend/disengage, nonlethal, surrender when one falls. No reinforcements or permanent plot lock.'},
  {key:'crossing',name:'[Lornwatch] The Broken Crossing',members:[['highwaymanCaptain',1],['highwayman',3]],notes:'DM ONLY. Ordinary Glass Road robbery, entirely unrelated to Hollows/VII/Dealer/Ilan. See expansion note. Rusk AC14HP27, two +4 1d6+2 shortswords OR one +4 1d8+2 crossbow80/320; three AC12HP11 highwaymen, one +3 1d6+1 scimitar OR +3 1d8+1 crossbow80/320. One west lookout hidden, captain/two robbers east visible. Do not auto-start combat. Demand15gp/two crates; acceptable bargain auto, DC12Persuasion reduces to5gp, DC13credible Intimidation retreat, DC12Deception buys two actions. Secure wagon + unload/lever: two distinct sensible actions, sound teamwork/tools auto, optional DC12Athletics/tools quick step; calm horse DC11Handling or patient food auto. Rescue adult Tavin with adjacent help/rope, no roll. Announce cargo drift round2, one unsecured crate falls endround3; secured wagon stops clock. Brook3ft deep, safe banks; south ford ten minutes/no roll. Surrender when captain falls or two robbers disabled, no pursuit/downed-PC attacks. Easy remove lookout/one captain attack.25gp+provisions any successful rescue,10gp if cargo lost; robbers8gp/tools. DM resolves manually. No cursed cargo or onward mystery.'},
];
export const placements=[
  {scene:'basement',monster:'ilan',x:768,y:420,size:1}, {scene:'basement',monster:'sphere',x:768,y:250,size:2},
  {scene:'cave',monster:'owlbear',x:960,y:400,size:2}, {scene:'cave',monster:'cub',x:1200,y:250,size:0.6},
  {scene:'court',monster:'guard',x:650,y:600,size:1}, {scene:'court',monster:'guard',x:650,y:470,size:1},
  {scene:'crossing',monster:'highwaymanCaptain',x:1160,y:420,size:1,visible:true},
  {scene:'crossing',monster:'highwayman',x:1200,y:355,size:1,visible:true},
  {scene:'crossing',monster:'highwayman',x:1230,y:490,size:1,visible:true},
  {scene:'crossing',monster:'highwayman',x:440,y:540,size:1},
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
  {key:'finale',scene:'basement',name:'Silent implosion',x:1000,y:650,hidden:true},
  {key:'vii',scene:'basement',name:'Old foundation stone',x:1150,y:650,hidden:true,text:'VII'},
  {key:'wagonWaybill',scene:'crossing',name:'Merchant wagon waybill',x:650,y:390,imprint:'GLASS ROAD',footer:'Merchant copy — ordinary road cargo',text:'MARR — WAGON WAYBILL\nDestination: Lornwatch market.\nCargo: flour, dried apples, soap and wool.\nEquipment: spare planks, wheel lever, two ropes, canvas cover.\nStorm damage reported at the crossing. Keep people and horse on sound decking before shifting the load.'},
  {key:'bridgeNotice',scene:'crossing',name:'Bridge maintenance notice',x:400,y:420,imprint:'GLASS ROAD',footer:'Road maintenance copy',text:'CROSSING — STORM DAMAGE\nNorthern bridge edge unsafe for loaded wheels.\nSouth bank stepping-stone ford remains passable on foot. Follow the brook downstream; allow ten minutes.\nKeep the central road clear for repairs. East road continues to Lornwatch.'},
];
export const assets=Object.fromEntries([
  ...scenes.map(s=>[s.key,s.key==='court'?'maps/court-accessible.png':`maps/${s.key}.png`]),
  ...[...new Set(npcs.map(n=>n.key))].map(key=>[key,`portraits/${key}.png`]),
  ...['ilan','sphere','owlbear','cub'].map(key=>[key,`tokens/${key}.png`]),
  ['highwayman','tokens/highwayman.png'],['highwaymanCaptain','tokens/highwayman.png'],
  ...documents.map(d=>[d.key,`discoverables/${d.key}.png`]),
]);
