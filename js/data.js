"use strict";
/* =====================================================================
   DATA : settings, weapons, medical items, full human anatomy
   ===================================================================== */
const SIDES=['R','L'],SFR={R:'D',L:'G'};

/* ---------------- SETTINGS ---------------- */
const SETTINGS_KEY='ra3d_settings_v3';
const DEFAULT_SETTINGS={pvp:true,map:'lux',temp:12,rain:false,night:false,npcCount:12,difficulty:'normal',
  infiniteMed:false,labels:true,injuryText:true,tapInspect:true,quality:'high',sens:1,volume:0.8};
const SET=Object.assign({},DEFAULT_SETTINGS);
try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(s&&typeof s==='object')for(const k in DEFAULT_SETTINGS)if(k in s)SET[k]=s[k];}catch(e){}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(SET));}catch(e){}}
const DIFF={facile:{dmg:0.45,spread:2.6,react:1.4,label:'Facile'},normal:{dmg:0.7,spread:1.8,react:1,label:'Normal'},reel:{dmg:1,spread:1.2,react:0.75,label:'Réaliste'}};

/* ---------------- WEAPONS ---------------- */
const WEAPONS=[
  {id:'fists',name:'Poings',icon:'👊',type:'melee',kind:'blunt',dmg:9,reach:0,cd:0.42,imp:0.015,unlock:0,len:0},
  {id:'knife',name:'Couteau',icon:'🔪',type:'melee',kind:'stab',dmg:22,reach:0.18,cd:0.42,imp:0.008,unlock:0,len:0.22,depth:0.12},
  {id:'bat',name:'Batte',icon:'🏏',type:'melee',kind:'blunt',dmg:30,reach:0.55,cd:0.68,imp:0.045,unlock:2,len:0.82},
  {id:'taser',name:'Taser',icon:'⚡',type:'taser',kind:'taser',dmg:4,cd:1.2,range:7,imp:0.004,unlock:4,len:0.18,mag:1,reload:2.2},
  {id:'pistol',name:'Pistolet 9 mm',icon:'🔫',type:'gun',kind:'bullet',dmg:30,energy:1,cd:0.28,spread:0.012,imp:0.02,unlock:6,len:0.2,pellets:1,mag:15,reload:1.7},
  {id:'katana',name:'Katana',icon:'🗡️',type:'melee',kind:'slash',dmg:40,reach:0.78,cd:0.58,imp:0.02,unlock:9,len:0.95,depth:0.075,sever:0.25},
  {id:'shotgun',name:'Fusil à pompe',icon:'💥',type:'gun',kind:'bullet',dmg:13,energy:0.4,cd:0.95,spread:0.06,imp:0.012,unlock:13,len:0.85,pellets:9,two:true,mag:6,reload:3.2},
  {id:'molotov',name:'Cocktail Molotov',icon:'🍾',type:'throw',kind:'fire',dmg:0,cd:1.1,unlock:17,len:0.22,mag:1,reload:0.9},
  {id:'rifle',name:"Fusil d'assaut",icon:'🎖️',type:'gun',kind:'bullet',dmg:30,energy:2.2,cd:0.1,spread:0.018,imp:0.02,unlock:22,len:0.85,pellets:1,auto:true,two:true,mag:30,reload:2.5,cavity:0.025},
  {id:'sniper',name:'Sniper',icon:'🎯',type:'gun',kind:'bullet',dmg:90,energy:4,cd:1.4,spread:0.0012,imp:0.06,unlock:30,len:1.15,pellets:1,two:true,mag:5,reload:3.0,cavity:0.045},
  {id:'brick',name:'Brique',icon:'🧱',type:'throw',kind:'brick',dmg:26,cd:0.9,unlock:1,len:0.12,mag:1,reload:0.5},
  {id:'grenade',name:'Grenade',icon:'💣',type:'throw',kind:'explosive',dmg:0,cd:1.2,unlock:26,len:0.08,mag:1,reload:1.2},
  {id:'machete',name:'Machette',icon:'🔪',type:'melee',kind:'slash',dmg:34,reach:0.6,cd:0.52,imp:0.018,unlock:3,len:0.6,depth:0.06,sever:0.16},
  {id:'axe',name:'Hache',icon:'🪓',type:'melee',kind:'slash',dmg:52,reach:0.62,cd:0.95,imp:0.035,unlock:8,len:0.72,depth:0.09,sever:0.3},
  {id:'hammer',name:'Marteau',icon:'🔨',type:'melee',kind:'blunt',dmg:34,reach:0.3,cd:0.6,imp:0.02,unlock:2,len:0.33,focal:true},
  {id:'crowbar',name:'Pied-de-biche',icon:'🔧',type:'melee',kind:'blunt',dmg:36,reach:0.55,cd:0.7,imp:0.035,unlock:5,len:0.6},
];

/* ---------------- MEDICAL ITEMS ---------------- */
const MED_ITEMS=[
  {k:'bandage',n:'Pansement compressif',icon:'🩹',start:3,d:"Arrête les saignements veineux, réduit les saignements artériels."},
  {k:'tourniquet',n:'Garrot',icon:'🎗️',start:2,d:"Stoppe l'hémorragie d'un bras ou d'une jambe. Après un moment, le membre devient faible."},
  {k:'chestseal',n:'Pansement thoracique',icon:'🫁',start:1,d:"Ferme une plaie du thorax : le pneumothorax arrête de s'aggraver."},
  {k:'splint',n:'Attelle',icon:'🦴',start:2,d:"Immobilise la pire fracture d'un membre : moins de douleur, membre en partie utilisable."},
  {k:'morphine',n:'Morphine',icon:'💉',start:2,d:"Calme fortement la douleur. Trop de doses ralentissent la respiration."},
  {k:'blanket',n:'Couverture de survie',icon:'🟨',start:1,d:"Réchauffe et protège du froid et de la pluie."},
  {k:'water',n:'Eau',icon:'💧',start:2,d:"Éteint le feu et refroidit les brûlures (mouille les vêtements)."},
  {k:'oxygen',n:'Oxygène',icon:'🫧',start:2,d:"Augmente l'oxygène dans le sang (noyade, gaz toxique, poumon blessé)."},
  {k:'pls',n:'Position latérale de sécurité',icon:'🛌',start:99,unlimited:true,d:"Pour une personne inconsciente qui respire : libère les voies aériennes."},
  {k:'cpr',n:'Massage cardiaque (RCP)',icon:'🫀',start:99,unlimited:true,d:"Arrêt cardiaque : gagne du temps et peut faire repartir le cœur (surtout noyade, foudre, froid)."},
  {k:'aed',n:'Défibrillateur (DAE)',icon:'⚡',start:2,d:"Choc électrique en cas d'arrêt cardiaque (très efficace après une électrocution ou la foudre)."},
];

/* ---------------- BODY REGIONS ---------------- */
const REGIONS={
  head:{n:'Tête',tbsa:7},neck:{n:'Cou',tbsa:2},thorax:{n:'Thorax',tbsa:18},abdomen:{n:'Abdomen',tbsa:13},pelvis:{n:'Bassin',tbsa:5},
  uarmR:{n:'Bras D',tbsa:4.5},uarmL:{n:'Bras G',tbsa:4.5},larmR:{n:'Avant-bras D',tbsa:3.5},larmL:{n:'Avant-bras G',tbsa:3.5},
  handR:{n:'Main D',tbsa:1},handL:{n:'Main G',tbsa:1},
  thighR:{n:'Cuisse D',tbsa:9},thighL:{n:'Cuisse G',tbsa:9},shinR:{n:'Jambe D',tbsa:7},shinL:{n:'Jambe G',tbsa:7},
  footR:{n:'Pied D',tbsa:2},footL:{n:'Pied G',tbsa:2},
};
const REG_KEYS=Object.keys(REGIONS);
function limbOfReg(r){if(/^(uarm|larm|hand)/.test(r))return 'arm'+r.slice(-1);if(/^(thigh|shin|foot)/.test(r))return 'leg'+r.slice(-1);return null;}

/* ---------------- 206 BONES ---------------- */
const BONES=[],BONE_IDX={};
function addBone(key,name,group,region,str,extra){const b=Object.assign({id:BONES.length,key,name,group,region,str},extra||{});BONES.push(b);BONE_IDX[key]=b.id;return b;}
// Crâne (8)
addBone('frontal','Os frontal','Crâne','head',70);
for(const s of SIDES){addBone('parietal'+s,'Os pariétal '+SFR[s],'Crâne','head',55,{side:s});addBone('temporal'+s,'Os temporal '+SFR[s],'Crâne','head',40,{side:s});}
addBone('occipital','Os occipital','Crâne','head',60);
addBone('sphenoid','Os sphénoïde','Crâne','head',45);
addBone('ethmoid','Os ethmoïde','Crâne','head',30);
// Face (14)
for(const s of SIDES){const S=SFR[s];
  addBone('nasal'+s,'Os nasal '+S,'Face','head',12,{side:s});
  addBone('maxilla'+s,'Maxillaire '+S,'Face','head',35,{side:s});
  addBone('lacrimal'+s,'Os lacrymal '+S,'Face','head',10,{side:s});
  addBone('zygomatic'+s,'Os zygomatique '+S,'Face','head',30,{side:s});
  addBone('palatine'+s,'Os palatin '+S,'Face','head',25,{side:s});
  addBone('concha'+s,'Cornet nasal inférieur '+S,'Face','head',10,{side:s});}
addBone('vomer','Vomer','Face','head',15);
addBone('mandible','Mandibule','Face','head',45);
// Osselets (6)
for(const s of SIDES)for(const [k,n] of [['malleus','Marteau'],['incus','Enclume'],['stapes','Étrier']])addBone(k+s,n+' '+SFR[s],'Oreille moyenne','head',8,{side:s});
// Hyoïde (1)
addBone('hyoid','Os hyoïde','Cou','neck',15);
// Colonne (26)
for(let i=1;i<=7;i++)addBone('C'+i,'Vertèbre C'+i+(i===1?' (atlas)':i===2?' (axis)':''),'Colonne vertébrale','neck',55,{level:i});
for(let i=1;i<=12;i++)addBone('T'+i,'Vertèbre T'+i,'Colonne vertébrale','thorax',60,{level:i});
for(let i=1;i<=5;i++)addBone('L'+i,'Vertèbre L'+i,'Colonne vertébrale','abdomen',65,{level:i});
addBone('sacrum','Sacrum','Colonne vertébrale','pelvis',70);
addBone('coccyx','Coccyx','Colonne vertébrale','pelvis',20);
// Cage thoracique (25)
addBone('sternum','Sternum','Cage thoracique','thorax',40);
for(const s of SIDES)for(let i=1;i<=12;i++)addBone('rib'+s+i,'Côte '+i+' '+SFR[s],'Cage thoracique',i<=10?'thorax':'abdomen',i>10?18:25,{side:s,level:i});
// Ceinture scapulaire (4)
for(const s of SIDES){addBone('clavicle'+s,'Clavicule '+SFR[s],'Ceinture scapulaire','thorax',30,{side:s});addBone('scapula'+s,'Scapula (omoplate) '+SFR[s],'Ceinture scapulaire','thorax',50,{side:s});}
// Membres supérieurs (60)
const CARPALS=[['scaphoid','Scaphoïde'],['lunate','Lunatum (semi-lunaire)'],['triquetrum','Triquétrum (pyramidal)'],['pisiform','Pisiforme'],['trapezium','Trapèze'],['trapezoid','Trapézoïde'],['capitate','Capitatum (grand os)'],['hamate','Hamatum (os crochu)']];
const TARSALS=[['talus','Talus (astragale)'],['calcaneus','Calcanéus'],['navicular','Naviculaire'],['cuboid','Cuboïde'],['cuneiform1','Cunéiforme médial'],['cuneiform2','Cunéiforme intermédiaire'],['cuneiform3','Cunéiforme latéral']];
const DIG=['pouce','index','majeur','annulaire','auriculaire'];
const TOE=['gros orteil','2e orteil','3e orteil','4e orteil','5e orteil'];
for(const s of SIDES){const S=SFR[s];
  addBone('humerus'+s,'Humérus '+S,'Bras '+S,'uarm'+s,60,{side:s,long:1});
  addBone('radius'+s,'Radius '+S,'Bras '+S,'larm'+s,45,{side:s,long:1});
  addBone('ulna'+s,'Ulna (cubitus) '+S,'Bras '+S,'larm'+s,45,{side:s,long:1});
  for(const [k,n] of CARPALS)addBone(k+s,n+' '+S,'Main '+S,'hand'+s,20,{side:s,sub:'carpal'});
  for(let i=1;i<=5;i++)addBone('mc'+i+s,'Métacarpien '+i+' '+S,'Main '+S,'hand'+s,22,{side:s,sub:'metacarpal',digit:i-1});
  for(let i=0;i<5;i++){
    addBone('php'+i+s,'Phalange proximale ('+DIG[i]+') '+S,'Main '+S,'hand'+s,12,{side:s,sub:'phalanx',digit:i,seg:0});
    if(i>0)addBone('phm'+i+s,'Phalange moyenne ('+DIG[i]+') '+S,'Main '+S,'hand'+s,10,{side:s,sub:'phalanx',digit:i,seg:1});
    addBone('phd'+i+s,'Phalange distale ('+DIG[i]+') '+S,'Main '+S,'hand'+s,8,{side:s,sub:'phalanx',digit:i,seg:2});}
}
// Bassin (2)
for(const s of SIDES)addBone('hip'+s,'Os coxal '+SFR[s],'Bassin','pelvis',80,{side:s});
// Membres inférieurs (60)
for(const s of SIDES){const S=SFR[s];
  addBone('femur'+s,'Fémur '+S,'Jambe '+S,'thigh'+s,90,{side:s,long:1});
  addBone('patella'+s,'Patella (rotule) '+S,'Jambe '+S,'thigh'+s,40,{side:s});
  addBone('tibia'+s,'Tibia '+S,'Jambe '+S,'shin'+s,70,{side:s,long:1});
  addBone('fibula'+s,'Fibula (péroné) '+S,'Jambe '+S,'shin'+s,35,{side:s,long:1});
  for(const [k,n] of TARSALS)addBone(k+s,n+' '+S,'Pied '+S,'foot'+s,(k==='calcaneus'||k==='talus')?40:22,{side:s,sub:'tarsal'});
  for(let i=1;i<=5;i++)addBone('mt'+i+s,'Métatarsien '+i+' '+S,'Pied '+S,'foot'+s,25,{side:s,sub:'metatarsal',digit:i-1});
  for(let i=0;i<5;i++){
    addBone('pfp'+i+s,'Phalange proximale ('+TOE[i]+') '+S,'Pied '+S,'foot'+s,12,{side:s,sub:'phalanx',digit:i,seg:0});
    if(i>0)addBone('pfm'+i+s,'Phalange moyenne ('+TOE[i]+') '+S,'Pied '+S,'foot'+s,10,{side:s,sub:'phalanx',digit:i,seg:1});
    addBone('pfd'+i+s,'Phalange distale ('+TOE[i]+') '+S,'Pied '+S,'foot'+s,8,{side:s,sub:'phalanx',digit:i,seg:2});}
}
const BONE_STATUS=['Intact','Fêlure','Fracture fermée','Fracture ouverte','Fracture comminutive'];
const BONE_COL=['#e8e0cc','#f5c542','#ff8a1f','#ff2d2d','#d0006f'];
const BONE_ENERGY={femur:0.45,humerus:0.35,tibia:0.35,hip:0.4,sacrum:0.4,frontal:0.3,occipital:0.3,parietal:0.28,temporal:0.25,sphenoid:0.2,mandible:0.15,sternum:0.15,scapula:0.15,radius:0.18,ulna:0.18,fibula:0.12,patella:0.12,clavicle:0.12};
function boneKeyBase(k){return k.replace(/[RL]\d*$/,'').replace(/\d+$/,'');}
function boneEnergyLoss(key){const b=boneKeyBase(key);if(BONE_ENERGY[b]!==undefined)return BONE_ENERGY[b];if(/^[CTL]\d/.test(key))return 0.4;if(/^rib/.test(key))return 0.12;return 0.08;}
function bonePain(key){const b=boneKeyBase(key);if(b==='femur'||b==='hip')return 18;if(b==='tibia'||b==='humerus'||/^[CTL]\d/.test(key)||b==='sacrum')return 12;if(['frontal','parietal','temporal','occipital','sphenoid','ethmoid'].includes(b))return 10;if(b==='radius'||b==='ulna'||b==='mandible'||b==='clavicle')return 8;if(b==='rib'||b==='sternum'||b==='fibula'||b==='patella'||b==='scapula')return 6;return 3;}

/* ---------------- MUSCLES ---------------- */
const MUSCLES=[],MUS_IDX={};
function addMus(key,name,region,group){MUSCLES.push({id:MUSCLES.length,key,name,region,group});MUS_IDX[key]=MUSCLES.length-1;}
for(const s of SIDES){const S=SFR[s];
  addMus('masseter'+s,'Masséter '+S,'head','Tête et cou');
  addMus('temporalis'+s,'Muscle temporal '+S,'head','Tête et cou');
  addMus('scm'+s,'Sterno-cléido-mastoïdien '+S,'neck','Tête et cou');
  addMus('trapezius'+s,'Trapèze '+S,'neck','Tête et cou');}
for(const s of SIDES){const S=SFR[s];
  addMus('pectoral'+s,'Grand pectoral '+S,'thorax','Tronc');
  addMus('lats'+s,'Grand dorsal '+S,'thorax','Tronc');
  addMus('intercostal'+s,'Intercostaux '+S,'thorax','Tronc');
  addMus('oblique'+s,'Oblique externe '+S,'abdomen','Tronc');}
addMus('rectus',"Grand droit de l'abdomen",'abdomen','Tronc');
addMus('erector','Érecteurs du rachis','abdomen','Tronc');
addMus('diaphragm','Diaphragme','abdomen','Tronc');
for(const s of SIDES){const S=SFR[s];
  addMus('deltoid'+s,'Deltoïde '+S,'uarm'+s,'Bras '+S);
  addMus('biceps'+s,'Biceps brachial '+S,'uarm'+s,'Bras '+S);
  addMus('triceps'+s,'Triceps brachial '+S,'uarm'+s,'Bras '+S);
  addMus('brachialis'+s,'Brachial '+S,'uarm'+s,'Bras '+S);
  addMus('flexors'+s,"Fléchisseurs de l'avant-bras "+S,'larm'+s,'Bras '+S);
  addMus('extensors'+s,"Extenseurs de l'avant-bras "+S,'larm'+s,'Bras '+S);
  addMus('handm'+s,'Muscles de la main '+S,'hand'+s,'Bras '+S);}
for(const s of SIDES){const S=SFR[s];
  addMus('gluteMax'+s,'Grand fessier '+S,'pelvis','Jambe '+S);
  addMus('gluteMed'+s,'Moyen fessier '+S,'pelvis','Jambe '+S);
  addMus('psoas'+s,'Ilio-psoas '+S,'pelvis','Jambe '+S);
  addMus('quad'+s,'Quadriceps '+S,'thigh'+s,'Jambe '+S);
  addMus('hams'+s,'Ischio-jambiers '+S,'thigh'+s,'Jambe '+S);
  addMus('adductors'+s,'Adducteurs '+S,'thigh'+s,'Jambe '+S);
  addMus('gastroc'+s,'Gastrocnémien (mollet) '+S,'shin'+s,'Jambe '+S);
  addMus('soleus'+s,'Soléaire '+S,'shin'+s,'Jambe '+S);
  addMus('tibAnt'+s,'Tibial antérieur '+S,'shin'+s,'Jambe '+S);
  addMus('achilles'+s,"Tendon d'Achille "+S,'foot'+s,'Jambe '+S);
  addMus('footm'+s,'Muscles du pied '+S,'foot'+s,'Jambe '+S);}
for(const s of SIDES){const S=SFR[s];const G='Ligaments et tendons';
  addMus('acl'+s,'Ligament croisé antérieur (LCA) '+S,'shin'+s,G);
  addMus('pcl'+s,'Ligament croisé postérieur (LCP) '+S,'shin'+s,G);
  addMus('mcl'+s,'Ligament latéral interne du genou '+S,'shin'+s,G);
  addMus('lcl'+s,'Ligament latéral externe du genou '+S,'shin'+s,G);
  addMus('meniscus'+s,'Ménisques du genou '+S,'shin'+s,G);
  addMus('ankleLig'+s,'Ligaments de la cheville '+S,'foot'+s,G);
  addMus('rotCuff'+s,'Coiffe des rotateurs (épaule) '+S,'uarm'+s,G);
  addMus('wristLig'+s,'Ligaments du poignet '+S,'hand'+s,G);}
const LIG=new Set(['acl','pcl','mcl','lcl','meniscus','ankleLig','rotCuff','wristLig','achilles']);
function isLig(key){return LIG.has(key.slice(0,-1));}
function muscleStatus(hp,key){if(key&&isLig(key))return hp>=95?['Intact',0]:hp>=75?['Entorse légère',1]:hp>=45?['Entorse grave / déchirure partielle',2]:hp>=15?['Rupture partielle',3]:['Rupture complète',4];return hp>=95?['Sain',0]:hp>=75?['Contusion',1]:hp>=45?['Déchirure partielle',2]:hp>=15?['Déchirure importante',3]:['Rupture / sectionné',4];}

/* ---------------- ORGANS, VESSELS, NERVES ---------------- */
const ORGANS=[],ORG={};
function addOrg(key,name,region,group,extra){ORGANS.push(Object.assign({id:ORGANS.length,key,name,region,group},extra||{}));ORG[key]=ORGANS.length-1;}
addOrg('brain','Cerveau','head','Système nerveux');
addOrg('brainstem','Tronc cérébral','head','Système nerveux');
addOrg('cordC','Moelle épinière cervicale','neck','Système nerveux');
addOrg('cordT','Moelle épinière thoracique','thorax','Système nerveux');
addOrg('cordL','Moelle lombaire (queue de cheval)','abdomen','Système nerveux');
for(const s of SIDES){const S=SFR[s];
  addOrg('radialN'+s,'Nerf radial '+S,'uarm'+s,'Système nerveux',{nerve:1,role:'ouvre la main et le poignet'});
  addOrg('medianN'+s,'Nerf médian '+S,'larm'+s,'Système nerveux',{nerve:1,role:'pince pouce-index, flexion des doigts'});
  addOrg('ulnarN'+s,'Nerf ulnaire (cubital) '+S,'larm'+s,'Système nerveux',{nerve:1,role:'force de la poigne, petits doigts'});
  addOrg('sciatic'+s,'Nerf sciatique '+S,'thigh'+s,'Système nerveux',{nerve:1,role:'toute la jambe sous le genou'});
  addOrg('femoralN'+s,'Nerf fémoral '+S,'thigh'+s,'Système nerveux',{nerve:1,role:'tendre le genou (quadriceps)'});
  addOrg('peronealN'+s,'Nerf fibulaire (péronier) '+S,'shin'+s,'Système nerveux',{nerve:1,role:'relever le pied'});}
for(const s of SIDES){addOrg('eye'+s,'Œil '+SFR[s],'head','Organes des sens');addOrg('innerEar'+s,'Oreille interne '+SFR[s],'head','Organes des sens');}
addOrg('trachea','Trachée','neck','Respiratoire');
for(const s of SIDES)addOrg('lung'+s,'Poumon '+SFR[s],'thorax','Respiratoire');
addOrg('heart','Cœur','thorax','Cardiovasculaire');
addOrg('aorta','Aorte','thorax','Cardiovasculaire',{vessel:'art',bleed:160,internal:true});
addOrg('venaCava','Veine cave','abdomen','Cardiovasculaire',{vessel:'vein',bleed:80,internal:true});
for(const s of SIDES){const S=SFR[s];
  addOrg('carotid'+s,'Artère carotide '+S,'neck','Cardiovasculaire',{vessel:'art',bleed:60,junction:true});
  addOrg('jugular'+s,'Veine jugulaire '+S,'neck','Cardiovasculaire',{vessel:'vein',bleed:26,junction:true});
  addOrg('subclavian'+s,'Artère sous-clavière '+S,'thorax','Cardiovasculaire',{vessel:'art',bleed:45,junction:true});
  addOrg('brachial'+s,'Artère brachiale '+S,'uarm'+s,'Cardiovasculaire',{vessel:'art',bleed:28});
  addOrg('radialA'+s,'Artère radiale '+S,'larm'+s,'Cardiovasculaire',{vessel:'art',bleed:10});
  addOrg('iliac'+s,'Artère iliaque '+S,'pelvis','Cardiovasculaire',{vessel:'art',bleed:60,internal:true});
  addOrg('femoral'+s,'Artère fémorale '+S,'thigh'+s,'Cardiovasculaire',{vessel:'art',bleed:50});
  addOrg('popliteal'+s,'Artère poplitée '+S,'shin'+s,'Cardiovasculaire',{vessel:'art',bleed:28});}
addOrg('esophagus','Œsophage','neck','Digestif',{bleed:2});
addOrg('liver','Foie','abdomen','Digestif',{bleed:22});
addOrg('stomach','Estomac','abdomen','Digestif',{bleed:3});
addOrg('spleen','Rate','abdomen','Digestif',{bleed:16});
addOrg('pancreas','Pancréas','abdomen','Digestif',{bleed:5});
addOrg('smallInt','Intestin grêle','abdomen','Digestif',{bleed:3});
addOrg('colon','Côlon','abdomen','Digestif',{bleed:3});
for(const s of SIDES)addOrg('kidney'+s,'Rein '+SFR[s],'abdomen','Urinaire',{bleed:7});
addOrg('bladder','Vessie','pelvis','Urinaire',{bleed:2});
function organStatus(c,id){
  const o=ORGANS[id],hp=c.org[id];
  if(o.nerve)return hp>=95?['Intact',0]:hp>=70?['Contusion (fourmillements)',1]:hp>=40?['Lésé – faiblesse',2]:hp>10?['Partiellement sectionné',3]:['Sectionné – paralysie',4];
  if(o.vessel){if(c.cut[id]===2)return['Sectionnée – hémorragie',4];if(c.cut[id]===1)return['Lésée – saigne',3];return hp<95?['Contusion',1]:['Intacte',0];}
  if(o.key.startsWith('lung')){const s=o.key.endsWith('R')?0:1;if(hp<=0)return['Détruit',4];if(c.lungWater>30)return['Eau dans les poumons ('+Math.round(c.lungWater/2)+' ml)',c.lungWater>300?4:3];if(c.gasDose>1&&hp<90)return['Brûlé par le gaz (œdème)',3];if(c.collapse&&c.collapse[s]>0.05)return['Pneumothorax ('+Math.round(c.collapse[s]*100)+' % affaissé)',3];}
  if(o.key==='heart'&&c.tamp&&hp>0)return['Perforé – tamponnade',4];
  return hp>=95?['Sain',0]:hp>=70?['Contusion',1]:hp>=40?['Lésion',2]:hp>10?['Perforé / déchiré',3]:['Détruit',4];
}
const SEV_COL=['#7fd87f','#f5c542','#ff8a1f','#ff3b3b','#d0006f'];

const NAMES_M=['Marc','Luc','Paulo','Tom','Jeff','Carlos','Yves','Rui','Max','Ben','Gil','Raf','Nico','Pit','Steve','Jos','Henri','Lucas','Ahmed','Tiago','Pol','Jang','Mehdi','Kevin','Arno','Sven','Omar','Diego'];
const NAMES_F=['Julie','Sophie','Léa','Inès','Anna','Mia','Nora','Elsa','Chloé','Sara','Lina','Zoé','Ana','Lou','Carla','Mara','Fatima','Joana','Emma','Nadia','Yuki','Sofia','Camille','Laura','Tessa','Ines','Rita','Maja'];
const BLOOD_TYPES=[['O+',35],['A+',30],['B+',8],['AB+',3],['O-',7],['A-',6],['B-',2],['AB-',1]];
function pickBloodType(){let r=Math.random()*92;for(const [t,w] of BLOOD_TYPES){r-=w;if(r<=0)return t;}return'O+';}
const FIRST_NAMES=['Marc','Julie','Luc','Sophie','Paulo','Léa','Tom','Inès','Jeff','Anna','Carlos','Mia','Yves','Nora','Rui','Elsa','Max','Chloé','Ben','Sara','Gil','Lina','Raf','Zoé','Nico','Ana','Pit','Lou','Steve','Carla','Jos','Mara'];
