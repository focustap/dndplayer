// Player-safe authoring payloads. DM scene notes are loaded from the canonical
// chapter into campaign_notes only, never dialogue, map descriptions or images.
export const HOBB = "Whole world's got walls. You just can't see 'em from this side. EhHEHeHEHEe";
export const scenes = [
  ['road','East Road',1254,1254,true],
  ['town','City Overview',1448,1086,false],
  ['inn','The Gilded Lamb',1536,1024,false],
  ['civic','Civic Hall',1536,1024,false],
  ['arcana',"Morrow's Arcana",1536,1024,false],
  ['graveyard','The Lucky Graveyard',1024,1536,false],
  ['market',"The Stranger's Market",1254,1254,false],
  ['grand',"Dealer's Circus — Grand Floor",1536,1024,true],
  ['gallery','Gallery of Wagers',1536,1024,false],
  ['private','Private House Veyr',1536,1024,false],
  ['foundations','Original Foundations',1254,1254,true],
  ['final','The Final Table',1254,1254,true],
].map(([key,title,width,height,tactical],i)=>({key,name:`Veyrholt ${String(i+1).padStart(2,'0')} — ${title}`,width,height,grid_type:tactical?'SQUARE':'GRIDLESS',grid_size:63,lighting:'DAY'}));

export const assets = {
  town:'maps/veyrholt-city.png', road:'maps/east-road.png',inn:'maps/gilded-lamb.png',civic:'maps/civic-hall.png',arcana:'maps/morrows-arcana.png',graveyard:'maps/lucky-graveyard.png',market:'maps/strangers-market.png',grand:'maps/grand-floor.png',gallery:'maps/gallery-of-wagers.png',private:'maps/private-house.png',foundations:'maps/original-foundations.png',final:'maps/final-table.png',
  dealer:'portraits/dealer.png',ysabet:'portraits/ysabet-morrow.png',ilyra:'portraits/ilyra-veyr.png',nera:'portraits/nera-vale.png',rusk:'portraits/rusk-fen.png',sable:'portraits/sable-quill.png',usher:'monsters/claim-usher.png',hound:'monsters/wager-hound.png',
};
const npc=(name,scene,x,y,pages,extra={})=>({name,scene,x,y,pages,...extra});
export const npcs=[
 npc('Cira Vale','inn',500,350,["Two gold for a room, five silver for supper. Boasting is free; broken chairs aren't.","I served the Dealer before he owned the estate. He already had those cards. Help Tamsin and I'll introduce you to the Gallery attendant."]),
 npc('Tamsin Reed','inn',700,500,["I wagered our wagon. I thought one win would put everything right. Now someone's stolen the pawn ticket too.","The ticket thief went toward the Market. I need that wagon for work, not another game."]),
 npc('Pell Aster','inn',900,350,["I lost my tuition, but I kept the receipt. Read the witness clause. He had to stop when the attendant dealt the wrong card.","A written objection demands a fresh card. It applies to him as well. Let me show you where I signed."]),
 npc('Ysabet Morrow','arcana',600,400,["Some of these curios were pawned by challengers. Most are just objects with unhappy owners.","His cards were magical before he bought House Veyr. The newer ones react to the building. Show me a receipt and we can test the difference."],{asset:'ysabet',shop:[
   {name:'Potion of healing',description:'Restores 2d4+2 HP.',price_gp:50,quantity:4},
   {name:'Feather Fall scroll',description:'One spell scroll; normal spell-scroll eligibility applies.',price_gp:25,quantity:1},
   {name:'Detect Magic scroll',description:'One spell scroll; normal spell-scroll eligibility applies.',price_gp:25,quantity:1},
   {name:'Antitoxin',description:'Advantage on saves against poison for 1 hour; no benefit to undead or constructs.',price_gp:50,quantity:2},
   {name:'Luminous bead',description:'A harmless bead that sheds dim light in a 5-foot radius.',price_gp:5,quantity:2},
 ]}),
 npc('Kest Rane','market',480,500,["Five gold for directions to the delivery door. Or help me shift this crate and call it even.","That door skips a queue. It doesn't make you owner of everything inside."]),
 npc('Nera Vale','market',700,350,["Speak into this coin. When I flip it, you'll hear yourself again. One sound, one coin, one performance.","I came for an audience. You can keep the enormous wagers."],{asset:'nera'}),
 npc('Rusk Fen','market',900,550,["Keep my palm on it and it weighs twice as much. Take my hand away and it's ordinary again.","My employer wagered the cart. I'm still deciding whether to earn another or try to win it back."],{asset:'rusk'}),
 npc('Sable Quill','gallery',600,350,["I borrow sharpness. The knife goes blunt; my quill cuts cord. A brief trick with inconvenient limits.","I'm watching how he handles exceptions. Anyone can announce a rule. The exceptions tell you what it means."],{asset:'sable'}),
 npc('Deacon Olyss','graveyard',480,600,["Leave offerings if you wish. Leave the mourners in peace whether you do or not.","The Veyrs are buried along the old wall. I can show you Ilyra's family names. The civic clerk has the actual deeds."]),
 npc('Reeve Elian Morrow','civic',700,330,["Lady Ilyra had title to the estate. She did not have title to the city or the people in it.","Bring testimony of forced collection. I can issue an inspection writ and have a clerk preserve the claims."]),
 npc('Captain Bryn Halvek','civic',400,440,["My watch keeps the streets safe. A crowd of angry claimants needs evidence, not a charge into a tent.","Stop unlawful collection and preserve the ledger. The council has authorized a hundred and twenty gold for that work."]),
 npc('Lady Ilyra Veyr','civic',950,500,["The estate was mine to wager. I thought winning it back would settle everything I had already lost.","The lower foundations were sealed before I was born. The maintenance cabinet key is yours if it helps keep people safe."],{asset:'ilyra'}),
 npc('Mara Venn','private',500,350,["I knew your father through field reports. We both learned to write down what we saw before deciding what it meant.","The household kept records of the sealed foundations. We can compare their dates with the Dealer's arrival."]),
 npc('The Dealer','grand',750,350,["Name a game. Name a stake. I will match it.","A challenge deserves an audience. The Gallery attendant will explain the arrangements.","Every game has rules."],{asset:'dealer'}),
 // Existing ordinary residents keep their identities and genuine portraits.
 npc('Dorrin Pike','inn',380,610,["I sell wool. The gamblers still need blankets, even when they cannot afford a room."]),
 npc('Yara Flint','inn',1000,650,["My contract is to escort a scholar home. It says nothing about paying her gambling debts."]),
 npc('Nessa Calder','market',350,700,["A bent hinge, a cracked pan, a wagon fitting: I can mend useful things. Luck charms are someone else's trade."]),
 npc('Sister Avra Seln','civic',950,330,["The flood records are older than the gaming halls. This city has survived fashions before."]),
 npc('Maela Thorn','graveyard',350,850,["My husband disliked cards. I leave him flowers, whatever the challengers do."]),
 npc('Edda Pike','graveyard',650,950,["This little coin was my mother's. I'm leaving it for her, not for the Dealer."]),
 npc('Corven Marr','graveyard',600,1120,["I came along the Glass Road. The graves here tell more honest stories than the bookmakers."]),
 npc('Sela Ward','market',320,820,["Fresh eggs, no wagers. If you want breakfast, pay for breakfast."]),
 npc('Oren Moss','market',550,900,["Keep the gate latched while the cart goes through. Crowds frighten the animals."]),
 ...['Ashbell — Sheep','Bracken — Goat','Patch — Farm Dog','Copper — Hen'].map((name,i)=>npc(name,'market',750+i*70,850,[],{interactive:false})),
];
const action=(name,description,bonus=null,dice=null,type='Force',ranged=false)=>({name,description,kind:'ACTION',usage:null,attackType:bonus===null?'OTHER':ranged?'RANGED':'MELEE',attackBonus:bonus,reach:ranged?null:5,range:ranged?{normal:60,long:60,unit:'ft'}:null,damage:dice?[{average:null,dice,flatBonus:Number(dice.match(/\+(\d+)/)?.[1]??0),damageType:type}]:[],save:null,conditions:[],effects:[],variants:[]});
const creature=(name,hp,ac,actions,extra={})=>({name,max_hp:hp,ac,speed:30,creature_size:'Medium',creature_type:'humanoid',abilities:{str:10,dex:14,con:12,int:10,wis:10,cha:10},actions,traits:[],bonus_actions:[],reactions:[],notes:'Prepared Veyrholt encounter. See DM campaign chapter notes.',...extra});
export const monsters=[
 creature('Veyrholt — Road Scout',18,13,[{...action('Shortbow','One attack, +4, range 80/320 ft, 1d6+2 piercing.',4,'1d6+2','Piercing',true),range:{normal:80,long:320,unit:'ft'}}]),
 creature('Veyrholt — Road Bandit',11,12,[action('Blade','One melee attack, +3, 1d6+1 slashing.',3,'1d6+1','Slashing')]),
 creature('Veyrholt — Graveyard Dog',7,12,[action('Bite','One melee attack, +3, 1d4+1 piercing.',3,'1d4+1','Piercing')],{speed:40,creature_type:'beast'}),
 creature('Veyrholt — Claim Usher',18,13,[{...action('Paper Lash','Reach 10 ft; +4, 1d6+2 force.',4,'1d6+2'),reach:10}],{creature_type:'construct',asset:'usher'}),
 creature('Veyrholt — Wager Hound',22,13,[action('Bite','Must first move at least 10 feet straight this turn; +4, 1d8+2 force.',4,'1d8+2')],{speed:40,creature_type:'construct',asset:'hound'}),
 creature('The Dealer',85,14,[
   {...action('Card Volley','Make two Card Bolt ranged spell attacks.'),kind:'MULTIATTACK',multiattack:{count:2,options:'Card Bolt',description:'Two ranged spell attacks.'}},
   {...action('Card Bolt','Ranged spell attack +5, 60 ft, 1d6+3 force. Normal disadvantage near enemies.',5,'1d6+3','Force',true),attackType:'SPELL'},
 ],{asset:'dealer',abilities:{str:10,dex:16,con:14,int:15,wis:12,cha:17},initiative:{modifier:3,score:13},saving_throws:{Dexterity:5,Wisdom:3},bonus_actions:[action("Dealer's Step",'Move 10 ft without opportunity attacks. Chains prevents this movement.')],reactions:[action('Fold','Reduce incoming damage by 1d4 once/round; never reduce direct HP costs.')]}),
];
export const encounters=[
 {key:'road',name:'Veyrholt — East Road Rescue',members:[['Veyrholt — Road Scout',1],['Veyrholt — Road Bandit',2]],notes:'Level 2. Negotiate 10 gp/work/food or fight. Water difficult, piers half cover. Surrender when scout falls. Rescue grants Level 3 after safe rest. Easy remove bandit; hard scout 24 HP. 40 gp delivery +18 gp recovered; stolen goods 12 gp.'},
 {key:'graveyard',name:'Veyrholt — Graveyard Dogs (optional)',members:[['Veyrholt — Graveyard Dog',2]],notes:'Only after stealing offerings despite warning. Food/DC11 Animal Handling ends fight; Olyss intervenes after 2 rounds. Dogs retreat at half HP. Easy 1 dog. Return offerings for cache directions, 15 gp. Unrelated to Hollow.'},
 {key:'grand',name:'Veyrholt — Disputed Collection',members:[['Veyrholt — Claim Usher',2]],notes:'Forged toolbox claim. Paid receipt ends conflict; action DC12 Investigation stops one, failure gives signature lead and next action succeeds. Half-cover tables. No pursuit/executions. Easy 1 usher, hard 23 HP each. Reward Gallery access, testimony, 20 gp.'},
 {key:'foundations',name:'Veyrholt — Collection Engine',members:[['Veyrholt — Claim Usher',2],['Veyrholt — Wager Hound',1]],notes:'Valid writ/receipt bypasses. Two actions turn claim wheel to end all summons. Hound telegraphs 10-ft straight run; block with crates. Columns half cover, no pursuit upstairs. Easy 1 usher, hard hound 30 HP. 30 gp, potion, Burn a Card stamp regardless of combat route.'},
 {key:'final',name:'Veyrholt — The Final Table',members:[['The Dealer',1]],notes:'Four Level 3 PCs. Use canonical Final Table campaign note: every combatant draws each round; at <=42 HP announce phase two, next round draw two and Dealer selects for everyone including himself. Research interventions + fallback Objection. Dealer obeys cards. Defeat at 0 HP breaks connection; survival remains possible. Level 4 after safe rest.'},
];
export const placements=encounters.flatMap(e=>e.members.flatMap(([monster,count],j)=>Array.from({length:count},(_,i)=>({scene:e.key,monster,name:`[Veyrholt] ${e.key} — ${monster.replace('Veyrholt — ','')} ${i+1}`,x:450+j*220+i*90,y:450+i*100}))));
export const links=[
 ['Greymere','road','Messenger: East Road',1180,760],['road','Greymere','Return to Greymere',140,1080],['road','town','Road to Veyrholt',1100,180],
 ['town','grand',"Dealer's Circus / House Veyr",725,410],['town','inn','The Gilded Lamb',745,747],['town','arcana',"Morrow's Arcana",1140,533],['town','market',"The Stranger's Market",275,458],['town','graveyard','The Lucky Graveyard',436,203],['town','civic','Civic Hall',1043,235],['town','road','East Road',721,1010],
 ['inn','town','Return to Veyrholt',765,935],['civic','town','Return to Veyrholt',285,930],
 ...['arcana','market','graveyard','grand'].map(k=>[k,'town','Return to Veyrholt',150,180]),
 ['grand','gallery','Gallery of Wagers',1300,350],['gallery','grand','Back to Grand Floor',150,180],
 ['gallery','private','Private House',1300,700],['private','gallery','Back to Gallery',150,180],
 ['private','foundations','Foundation stairs',1300,700],['foundations','private','Return upstairs',150,180],
 ['foundations','final','The Final Table',1000,250],['final','foundations','Exit stairs',150,1080],
];
export const discoverables=[];
export const messengerPages=[
 "I have come from Veyrholt. A supply wagon is stranded on the east road, and the city will pay forty gold to bring its travelers safely home.",
 "A man called the Dealer has won House Veyr and turned its grounds into an enormous circus. He matches every wager. Nobody I've met has seen him lose.",
 "People say pledged possessions have begun collecting themselves. We need witnesses who can tell a trick from something more dangerous.",
 "Ask at the Gilded Lamb, or bring testimony to the civic petition desk. I have two healing potions for the journey.",
];
