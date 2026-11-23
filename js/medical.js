"use strict";
/* =====================================================================
   MEDICAL : wound ballistics through anatomy, fractures, vessels,
             organs, physiology (blood, O2, heart, temperature, pain,
             consciousness), burns, falls, treatments
   ===================================================================== */
const THERM=2;
function initMedical(c){
  c.bone=new Float32Array(BONES.length).fill(100);c.boneSt=new Uint8Array(BONES.length);c.splint=new Uint8Array(BONES.length);
  c.mus=new Float32Array(MUSCLES.length).fill(100);c.org=new Float32Array(ORGANS.length).fill(100);c.cut=new Uint8Array(ORGANS.length);
  c.wounds=[];c.intB={};c.burn={};c.bruise={};c.soak={};for(const r of REG_KEYS){c.burn[r]={deg:0,dose:0,area:0};c.bruise[r]=0;c.soak[r]=0;}
  c.bloodMax=rnd(4700,5400);c.blood=c.bloodMax;c.lossF=0;c.extBleed=0;c.intBleed=0;c.tbsa=0;c.bsrc={};
  c.hr=rnd(64,80);c.sbp=rnd(112,128);c.dbp=c.sbp*0.65;c.rr=14;c.spo2=98;c.temp=36.9;c.gcs=15;c.conscious=true;c.oxy=1;c.heartFn=1;
  c.painInj=0;c.painEff=0;c.adren=0;c.morph=0;c.morphTotal=0;c.concussion=0;c.ich=0;c.ichRate=0;c.tamp=false;c.tampV=0;
  c.collapse=[0,0];c.pneumo=[0,0];c.seal=[0,0];c.openChest=[false,false];c.tq={armR:0,armL:0,legR:0,legL:0};
  c.wet=0;c.blanket=0;c.burning=0;c.burnSrc='thorax';c.fireHeat=0;c.arrest=false;c.arrestT=0;c.lowBpT=0;c.hypoxT=0;
  c.koT=0;c.faintT=0;c.tasedT=0;c.breathHold=0;c.headUnder=false;c.inWater=false;c.shivering=false;c.shiver=0;c.exert=0;
  c.legFn=[1,1];c.armFn=[1,1];c.grip=[1,1];c.support=1;c.canStand=true;c.speedF=1;c.dizzy=0;c.tetra=false;c.para=false;c.cordLvl=8;
  c.cause='';c.fallH=0;c.lastFallT=-99;c.fnT=0;c.dirty=true;c.shards=[];c.eyeRed=false;c.holdW=null;c.holdArm=1;c.crawling=false;c._lastAn=null;
  c.windT=0;c.lungWater=0;c.gasExp=0;c.gasDose=0;c.inhal=0;c.elec=false;c.o2T=0;c.pls=false;c.cprN=0;c.sayT=rnd(2,6);c.lastSay='';c.boneK=1;c.thermoK=1;
}

/* ---------------- local frames & anatomical volumes ---------------- */
function frameTorso(c){const P=c.P,o=P[c.pelvis];const up=norm(sub(P[c.neck],o));const right=orthoN(sub(P[c.sh[0]],P[c.sh[1]]),up);return{o,up,right,fwd:cross(up,right)};}
function frameNeck(c){const P=c.P,o=P[c.neck];const up=norm(sub(P[c.head],o));const right=orthoN(sub(P[c.sh[0]],P[c.sh[1]]),up);return{o,up,right,fwd:cross(up,right)};}
function locF(F,p){const d=sub(p,F.o);return{x:dot(d,F.right),y:dot(d,F.up),z:dot(d,F.fwd)};}
// [organ, cx, cy, cz, rx, ry, rz] in torso frame (x: right, y: up from pelvis, z: front)
const TORSO_ORG=[
  ['heart',-0.025,0.37,0.035,0.05,0.06,0.048],['lungR',0.078,0.38,0,0.06,0.11,0.07],['lungL',-0.08,0.39,0,0.052,0.1,0.065],
  ['aorta',-0.012,0.28,-0.045,0.016,0.17,0.016],['venaCava',0.02,0.24,-0.035,0.016,0.15,0.016],
  ['subclavianR',0.075,0.475,0.03,0.045,0.012,0.014],['subclavianL',-0.075,0.475,0.03,0.045,0.012,0.014],
  ['liver',0.06,0.235,0.02,0.085,0.05,0.07],['stomach',-0.06,0.235,0.04,0.055,0.045,0.045],['spleen',-0.105,0.23,-0.04,0.03,0.04,0.03],
  ['pancreas',-0.01,0.2,-0.01,0.07,0.015,0.02],['kidneyR',0.062,0.165,-0.065,0.028,0.05,0.025],['kidneyL',-0.062,0.175,-0.065,0.028,0.05,0.025],
  ['smallInt',0,0.08,0.035,0.1,0.07,0.06],['colon',0,0.1,0,0.13,0.1,0.08],['bladder',0,-0.03,0.05,0.04,0.035,0.035],
  ['iliacR',0.04,0,-0.02,0.02,0.04,0.012],['iliacL',-0.04,0,-0.02,0.02,0.04,0.012],['cordT',0,0.36,-0.088,0.008,0.15,0.008],['cordL',0,0.1,-0.088,0.009,0.12,0.009],
];
function torsoStructs(l,cav,shellOnly){
  const out=[];const ax=Math.abs(l.x),side=l.x>=0?'R':'L';
  const rn=Math.sqrt(l.x*l.x/0.0306+l.z*l.z/0.0132);
  if(rn>0.74||shellOnly){
    if(l.z<-0.062&&ax<0.03){if(l.y>=0.22)out.push(['bone','T'+clamp(Math.round(1+(0.5-l.y)/0.0255),1,12)]);else if(l.y>=0)out.push(['bone','L'+clamp(Math.round(1+(0.22-l.y)/0.046),1,5)]);else out.push(['bone',l.y>-0.09?'sacrum':'coccyx']);out.push(['mus','erector']);}
    if(l.z>0.07&&ax<0.03&&l.y>0.3&&l.y<0.5)out.push(['bone','sternum']);
    if(l.y>0.455&&l.z>0&&ax>0.02&&ax<0.18)out.push(['bone','clavicle'+side]);
    if(l.z<-0.04&&ax>0.05&&ax<0.16&&l.y>0.33&&l.y<0.49)out.push(['bone','scapula'+side]);
    if(l.y>0.2&&l.y<0.5&&!(ax<0.03&&(l.z>0.07||l.z<-0.062))){out.push(['bone','rib'+side+clamp(Math.round(1+(0.49-l.y)/0.026),1,12)]);out.push(['mus','intercostal'+side]);}
    if(l.y>0.32&&l.z>0.02)out.push(['mus','pectoral'+side]);
    if(l.y>0.25&&l.z<-0.03&&ax>0.05)out.push(['mus','lats'+side]);
    if(l.y>0.45&&l.z<0)out.push(['mus','trapezius'+side]);
    if(l.y<0.3&&l.y>0&&l.z>0.04&&ax<0.07)out.push(['mus','rectus']);
    if(l.y<0.3&&l.y>0&&ax>=0.07)out.push(['mus','oblique'+side]);
    if(l.y<0.03){if(ax>0.045)out.push(['bone','hip'+side]);if(l.z<-0.02&&ax>0.03)out.push(['mus','gluteMax'+side]);else if(ax>0.09)out.push(['mus','gluteMed'+side]);}
  }
  if(!shellOnly){
    for(const o of TORSO_ORG){const dx=(l.x-o[1])/(o[4]+cav),dy=(l.y-o[2])/(o[5]+cav),dz=(l.z-o[3])/(o[6]+cav);if(dx*dx+dy*dy+dz*dz<=1)out.push(['org',o[0]]);}
    if(l.y>0.255&&l.y<0.3&&rn<0.85)out.push(['mus','diaphragm']);
    if(l.y<0.03&&l.y>-0.1&&rn<0.7&&Math.abs(l.x)>0.03)out.push(['mus','psoas'+side]);
  }
  return out;
}
function skullBoneAt(l){const side=l.x>=0?'R':'L',ax=Math.abs(l.x);
  if(l.z>0.045&&l.y<0){if(l.y<-0.055)return'mandible';if(ax<0.018&&l.y>-0.035)return pick(['nasal'+side,'nasal'+side,'vomer','concha'+side]);if(ax>0.045&&l.y>-0.035)return'zygomatic'+side;if(ax>0.02&&ax<0.045&&l.y>-0.01)return pick(['lacrimal'+side,'maxilla'+side]);return pick(['maxilla'+side,'maxilla'+side,'palatine'+side]);}
  if(l.z>0.05&&l.y>=0)return'frontal';if(l.z<-0.05&&l.y<0.06)return'occipital';if(ax>0.07&&l.y<0.05)return'temporal'+side;if(l.y>0.05)return(ax<0.03&&l.z>0)?'frontal':'parietal'+side;return pick(['sphenoid','ethmoid','temporal'+side]);}
function headStructs(l,cav,shellOnly){
  const out=[];const side=l.x>=0?'R':'L',ax=Math.abs(l.x);
  const rn=Math.sqrt(l.x*l.x/0.0121+l.y*l.y/0.0156+l.z*l.z/0.0132);
  if(rn>0.8||shellOnly){out.push(['bone',skullBoneAt(l)]);if(ax>0.055&&l.y<0.03&&l.y>-0.07)out.push(['mus',(l.y<-0.025?'masseter':'temporalis')+side]);}
  if(!shellOnly){
    const inE=(cx,cy,cz,r)=>{const dx=l.x-cx,dy=l.y-cy,dz=l.z-cz;return dx*dx+dy*dy+dz*dz<=(r+cav)*(r+cav);};
    if(l.y>-0.04&&(l.x*l.x/0.0072+(l.y-0.02)*(l.y-0.02)/0.0058+(l.z+0.005)*(l.z+0.005)/0.0081)<=1)out.push(['org','brain']);
    if(inE(0,-0.045,-0.028,0.022))out.push(['org','brainstem']);
    for(const s of SIDES){const sg=s==='R'?1:-1;if(inE(sg*0.036,0.012,0.088,0.014))out.push(['org','eye'+s]);if(inE(sg*0.066,-0.005,-0.005,0.014)){out.push(['org','innerEar'+s]);out.push(['bone',pick(['malleus','incus','stapes'])+s]);}}
    if(l.z>0.03&&l.y<-0.02&&l.y>-0.055&&ax<0.04)out.push(['bone',pick(['palatine'+side,'vomer','maxilla'+side,'concha'+side])]);
    if(l.y<-0.02&&l.z<0.02&&l.z>-0.06&&ax<0.03)out.push(['bone',pick(['sphenoid','sphenoid','ethmoid'])]);
  }
  return out;
}
function neckStructs(l,cav,shellOnly){
  const out=[];const side=l.x>=0?'R':'L',ax=Math.abs(l.x);const lvl=clamp(Math.round(7-l.y/0.026),1,7);
  const near=(cx,cz,r)=>Math.hypot(l.x-cx,l.z-cz)<=r+cav;
  if(shellOnly){if(l.z>0.015&&ax<0.03){out.push(['org','trachea']);if(l.y>0.1)out.push(['bone','hyoid']);}if(l.z<-0.01)out.push(['bone','C'+lvl]);out.push(['mus',(l.z<-0.015?'trapezius':'scm')+side]);return out;}
  if(near(0,0.025,0.012))out.push(['org','trachea']);if(near(0,0.006,0.009))out.push(['org','esophagus']);
  for(const s of SIDES){const sg=s==='R'?1:-1;if(near(sg*0.022,0.012,0.007))out.push(['org','carotid'+s]);if(near(sg*0.033,0.016,0.008))out.push(['org','jugular'+s]);}
  if(near(0,-0.022,0.016)){out.push(['bone','C'+lvl]);if(near(0,-0.022,0.007))out.push(['org','cordC',lvl]);}
  if(l.y>0.11&&l.z>0.015&&ax<0.025)out.push(['bone','hyoid']);
  if(ax>0.028&&l.z>-0.012)out.push(['mus','scm'+side]);if(l.z<-0.025)out.push(['mus','trapezius'+side]);
  return out;
}
function kneeLigs(S,lat,fr){const o=[];if(lat>0.015)o.push(['mus','lcl'+S]);else if(lat<-0.015)o.push(['mus','mcl'+S]);if(fr>0.01)o.push(['mus','acl'+S]);else if(fr<-0.01)o.push(['mus','pcl'+S]);if(Math.abs(lat)<0.025)o.push(['mus','meniscus'+S]);if(!o.length)o.push(['mus','acl'+S]);return o;}
function handBone(S,t){if(t<0.35)return pick(CARPALS)[0]+S;if(t<0.7)return'mc'+rndi(1,5)+S;const i=rndi(0,4);const seg=i===0?pick(['php','phd']):pick(['php','phm','phd']);return seg+i+S;}
function footBone(S,t){if(t<0.15)return'calcaneus'+S;if(t<0.3)return pick(['talus','navicular','cuboid'])+S;if(t<0.45)return pick(['cuneiform1','cuneiform2','cuneiform3','cuboid'])+S;if(t<0.82)return'mt'+rndi(1,5)+S;const i=rndi(0,4);const seg=i===0?pick(['pfp','pfd']):pick(['pfp','pfm','pfd']);return seg+i+S;}
function limbStructs(base,S,t,lat,fr,cav,shellOnly){
  const out=[];const rad=Math.hypot(lat,fr);const near=(a,b,r)=>Math.hypot(lat-a,fr-b)<=r+cav;
  switch(base){
    case 'uarm':if(rad<0.017||shellOnly)out.push(['bone','humerus'+S]);if(t<0.25)out.push(['mus','deltoid'+S]);if(t<0.15)out.push(['mus','rotCuff'+S]);if(fr>0.012&&t>=0.2)out.push(['mus','biceps'+S]);if(fr<-0.012)out.push(['mus','triceps'+S]);if(rad<0.03&&fr>-0.01&&t>0.3)out.push(['mus','brachialis'+S]);
      if(!shellOnly){if(near(-0.026,0.008,0.009))out.push(['org','brachial'+S]);if(near(0.012,-0.022,0.009))out.push(['org','radialN'+S]);if(near(-0.024,0.014,0.008))out.push(['org','medianN'+S]);if(near(-0.026,-0.012,0.008))out.push(['org','ulnarN'+S]);}if(t>0.85&&lat<-0.018&&fr<0)out.push(['org','ulnarN'+S]);break;
    case 'larm':if(near(0.011,0,0.01)||(shellOnly&&lat>0))out.push(['bone','radius'+S]);if(near(-0.011,-0.003,0.01)||(shellOnly&&lat<=0))out.push(['bone','ulna'+S]);if(fr>0.006)out.push(['mus','flexors'+S]);else if(fr<-0.006)out.push(['mus','extensors'+S]);
      if(!shellOnly){if(t>0.35&&near(0.016,0.016,0.007))out.push(['org','radialA'+S]);if(near(0,0.014,0.008))out.push(['org','medianN'+S]);if(near(-0.016,0.006,0.007))out.push(['org','ulnarN'+S]);if(t<0.5&&near(0.016,0.002,0.007))out.push(['org','radialN'+S]);}break;
    case 'hand':out.push(['bone',handBone(S,t)]);out.push(['mus','handm'+S]);if(t<0.3)out.push(['mus','wristLig'+S]);if(!shellOnly&&Math.random()<0.5)out.push(['bone',handBone(S,t)]);break;
    case 'thigh':if(rad<0.02||shellOnly)out.push(['bone','femur'+S]);if(t>0.86&&fr>0.02)out.push(['bone','patella'+S]);if(t<0.22&&fr<-0.01)out.push(['mus','gluteMax'+S]);
      if(fr>0.012)out.push(['mus','quad'+S]);if(fr<-0.015)out.push(['mus','hams'+S]);if(lat<-0.02)out.push(['mus','adductors'+S]);if(t>0.9)out.push(...kneeLigs(S,lat,fr));
      if(!shellOnly){if(t<0.75&&near(-0.028,0.022,0.011))out.push(['org','femoral'+S]);if(t>0.82&&near(0,-0.03,0.012))out.push(['org','popliteal'+S]);if(near(0,-0.022,0.011))out.push(['org','sciatic'+S]);if(t<0.4&&near(-0.02,0.03,0.01))out.push(['org','femoralN'+S]);}break;
    case 'shin':if(near(-0.004,0.008,0.016)||(shellOnly&&fr>0))out.push(['bone','tibia'+S]);if(near(0.024,-0.004,0.009)||(shellOnly&&lat>0.02))out.push(['bone','fibula'+S]);
      if(t<0.15){out.push(...kneeLigs(S,lat,fr));if(!shellOnly&&fr<-0.02)out.push(['org','popliteal'+S]);}
      if(fr<-0.012)out.push(['mus',t<0.55?'gastroc'+S:'soleus'+S]);if(fr>0.01&&lat>0)out.push(['mus','tibAnt'+S]);if(t>0.82&&fr<-0.012)out.push(['mus','achilles'+S]);if(t>0.92)out.push(['bone','talus'+S]);if(t<0.22&&(near(0.03,-0.008,0.009)||(shellOnly&&lat>0.025)))out.push(['org','peronealN'+S]);break;
    case 'foot':out.push(['bone',footBone(S,t)]);out.push(['mus','footm'+S]);if(t<0.3)out.push(['mus','ankleLig'+S]);if(t<0.2&&fr<0)out.push(['mus','achilles'+S]);break;
  }
  return out;
}
function limbDef(c,reg){const S=reg.slice(-1),s=S==='R'?0:1,A=c.arms[s],L=c.legs[s],b=reg.slice(0,-1);
  if(b==='uarm')return{a:A.sh,b:A.el,r:0.064,s,S,base:b};if(b==='larm')return{a:A.el,b:A.ha,r:0.052,s,S,base:b};if(b==='hand')return{a:A.fm,b:A.ha,r:0.052,s,S,base:b,ext:0.09,t0:0.6};
  if(b==='thigh')return{a:L.hip,b:L.kn,r:0.092,s,S,base:b};if(b==='shin')return{a:L.kn,b:L.ft,r:0.068,s,S,base:b};return{a:L.ft,b:L.toe,r:0.05,s,S,base:'foot',ext:0.03};}
function volumeFor(c,reg){
  if(reg==='thorax'||reg==='abdomen'||reg==='pelvis'){const F=frameTorso(c);return{kind:'torso',local:p=>locF(F,p),inside:l=>l.y>-0.17&&l.y<0.56&&(l.x*l.x/0.0306+l.z*l.z/0.0132)<=1,structs:(l,cav,sh)=>torsoStructs(l,cav,sh)};}
  if(reg==='neck'){const F=frameNeck(c);return{kind:'neck',local:p=>locF(F,p),inside:l=>l.y>-0.03&&l.y<0.2&&(l.x*l.x+l.z*l.z)<=0.0036,structs:(l,cav,sh)=>neckStructs(l,cav,sh)};}
  if(reg==='head'){const F=frameNeck(c);F.o=c.P[c.head];return{kind:'head',local:p=>locF(F,p),inside:l=>(l.x*l.x/0.0121+l.y*l.y/0.0156+l.z*l.z/0.0132)<=1,structs:(l,cav,sh)=>headStructs(l,cav,sh)};}
  const d=limbDef(c,reg);const P=c.P,a=P[d.a],b0=P[d.b];const ax=sub(b0,a);const Lr=vlen(ax)||1e-6;const u=mul(ax,1/Lr);const T=frameTorso(c);
  const fr=orthoN(T.fwd,u);const latRaw=d.s===0?T.right:mul(T.right,-1);const lat=norm(sub(sub(latRaw,mul(u,dot(latRaw,u))),mul(fr,dot(latRaw,fr))));const L=Lr+(d.ext||0);const t0=d.t0||0;
  return{kind:'limb',local:p=>{const q=sub(p,a);const al=dot(q,u);const rv=sub(q,mul(u,al));const tt=al/L;return{t:t0?clamp((tt-t0)/(1-t0),0,1):tt,tr:tt,lat:dot(rv,lat),fr:dot(rv,fr)};},
    inside:l=>l.tr>-0.06&&l.tr<1.06&&Math.hypot(l.lat,l.fr)<=d.r,structs:(l,cav,sh)=>limbStructs(d.base,d.S,clamp(l.t,0,1),l.lat,l.fr,cav,sh)};
}
function regionAtPoint(c,p){let best=null,bd=1e9;for(const h of c.H){const r=pointSeg(p,capA(c,h),capB(c,h));const d=r.d-h.r;if(d<bd){bd=d;best=(h.split!==undefined&&r.t>h.split)?h.reg2:h.reg;}}return best;}

/* ---------------- hit resolution ---------------- */
function applyHit(c,hi,t,point,dir,w,src,E){
  if(!c)return null;wake(c);
  const h=c.H[hi];const reg=(h.split!==undefined&&t>h.split)?h.reg2:h.reg;
  const P=c.P,pa=P[h.a],pb=P[h.b];const tt=(h.ta||0)+t*((h.tb!==undefined?h.tb:1)-(h.ta||0));
  const imp=mul(dir,w.imp*(E!==undefined?clamp(E,0.3,1.6):1));
  const push=(p,s)=>{p.ox-=imp.x*s;p.oy-=imp.y*s;p.oz-=imp.z*s;};push(pa,1-tt);push(pb,tt);push(P[c.chest],0.3);
  c.lastHit=src;if(src&&src.isPlayer){hitMarker=0.15;if(typeof lastTarget!=='undefined'){lastTarget=c;lastTargetT=GT;}}if(c.isPlayer)hurtFlash=Math.min(0.6,hurtFlash+0.25);
  const inj=[];const dm=(src&&src.dmgMul)||1;let res=null;
  c.adren=1;c._lastAn=anchorAt(c,point);
  const zone=hitZone(c,reg,point);inj.push({t:hitVerb(w)+' → '+zone.n,sev:1,hdr:true});
  if(w.kind==='blunt'){const d=w.dmg*dm*rnd(0.85,1.2);applyBlunt(c,reg,point,dir,d,inj);bluntZone(c,zone,d,inj,point);}
  else if(w.kind==='taser')applyTaser(c,reg,point,inj);
  else{res=penetrate(c,reg,point,dir,w,E!==undefined?E:(w.energy||1));applyPenetrating(c,reg,res,w,dm,point,inj);}
  sfxAt(point);
  if(w.kind==='blunt')(w.dmg*dm>15?SFX.blunt:SFX.punch)();else if(w.kind==='stab')SFX.stab();else if(w.kind==='slash')SFX.slash();else if(w.kind==='bullet')SFX.flesh();
  const nb=w.kind==='bullet'?8:w.kind==='stab'?5:w.kind==='slash'?11:(w.dmg*dm>15?3:0);
  for(let i=0;i<nb;i++)spawnP(point,{x:imp.x*0.5+rnd(-0.015,0.015),y:imp.y*0.5+rnd(-0.004,0.025),z:imp.z*0.5+rnd(-0.015,0.015)},'blood');
  if(res&&res.exit)for(let i=0;i<6;i++)spawnP(res.exit,{x:dir.x*0.04+rnd(-0.012,0.012),y:dir.y*0.04+rnd(-0.004,0.02),z:dir.z*0.04+rnd(-0.012,0.012)},'blood');
  if(w.kind==='bullet'){const big=(E||w.energy||1)>1.8&&(reg==='thorax'||reg==='abdomen'||reg==='pelvis'||reg==='head');c.stun=Math.max(c.stun,big?rnd(0.9,1.4):(/thigh|shin|pelvis/.test(reg)?rnd(0.4,0.9):rnd(0.15,0.45)));}
  if(w.kind==='blunt'&&w.dmg*dm>22)c.stun=Math.max(c.stun,0.3+w.dmg*dm/80);
  if(w.kind==='slash'||w.kind==='stab')c.stun=Math.max(c.stun,0.2);
  reportInjuries(c,inj,point);
  if(c.alive&&c.conscious&&c.groanT<=0){sfxAt(P[c.head]);(c.painEff>45||w.kind!=='blunt'?SFX.scream:SFX.groan)(c.isPlayer?0.85:1);c.groanT=rnd(0.7,1.4);}
  c.dirty=true;computeFunctions(c);
  if(c.wounds.length>40)c.wounds.splice(0,c.wounds.length-40);
  return res;
}
function penetrate(c,reg,point,dir,w,E){
  const kind=w.kind;const cav=(w.cavity||0)+(kind==='bullet'?0.004:0.002);
  const vol=volumeFor(c,reg);const maxD=kind==='bullet'?0.7:(w.depth||0.1);
  const res={hits:[],entry:null,exit:null,exitE:0,reg,lodged:false,graze:false};
  const seen=new Set();let entered=false,depth=0;const step=0.008;
  for(let s=-0.05;s<=maxD+0.12;s+=step){
    const p=add(point,mul(dir,s));const l=vol.local(p);
    if(vol.inside(l)){
      if(!entered){entered=true;res.entry=p;}depth+=step;
      for(const h of vol.structs(l,cav,false)){const id=h[0]+h[1];if(seen.has(id))continue;seen.add(id);res.hits.push({type:h[0],key:h[1],E,depth,lvl:h[2]});if(h[0]==='bone'&&kind==='bullet')E-=boneEnergyLoss(h[1]);}
      if(kind==='bullet'){E-=step*1.25;if(E<=0.04){res.lodged=true;break;}}else if(depth>=maxD)break;
    }else if(entered){if(kind==='bullet'&&E>0.06){res.exit=p;res.exitE=E;}break;}
  }
  if(!entered)res.graze=true;
  return res;
}
function mkWound(c,reg,p,type,ven,size){return{reg,limb:limbOfReg(reg),an:anchorAt(c,p),type,ven,art:0,artKey:null,lost:0,cur:0,size:size||0.016,bandaged:false,junction:false};}
function applyPenetrating(c,reg,res,w,dm,point,inj){
  const kind=w.kind;let musN=0,art=0,artKey=null,junction=false;
  for(const h of res.hits){
    const pw=kind==='bullet'?clamp(h.E,0.2,2.5):1;
    const base=w.dmg*dm*(kind==='bullet'?(0.55+0.45*pw):1)*(w.cavity?1.25:1);
    if(h.type==='bone')boneDamage(c,BONE_IDX[h.key],base*(kind==='bullet'?2.2:kind==='slash'?1.1:0.9),true,inj);
    else if(h.type==='mus'){muscleDamage(c,MUS_IDX[h.key],base*(kind==='slash'?1.8:1.3),inj);musN++;}
    else{const r=organDamage(c,ORG[h.key],base*(kind==='bullet'?1.6:1.3),kind,inj,h.lvl);if(r){art+=r.rate;artKey=r.key;junction=junction||!!ORGANS[ORG[r.key]].junction;}}
  }
  const ep=res.entry||point;
  const wd=mkWound(c,reg,ep,kind==='bullet'?"Plaie d'entrée par balle":kind==='stab'?'Plaie par arme blanche':'Lacération profonde',(kind==='slash'?3.5:kind==='stab'?2:1.2)+musN*0.7+(reg==='head'?1.5:0),kind==='slash'?0.03:0.02);
  let ex=null;if(res.exit){ex=mkWound(c,regionAtPoint(c,res.exit),res.exit,'Plaie de sortie',1.6+musN*0.4,0.028);ex.exit=true;}
  if(art>0){const tw=ex&&Math.random()<0.5?ex:wd;tw.art=art;tw.artKey=artKey;tw.junction=junction;}
  if(res.graze){wd.type='Éraflure par balle';wd.ven=0.6;wd.size=0.014;}
  c.wounds.push(wd);if(ex)c.wounds.push(ex);
  if(res.lodged&&kind==='bullet'&&!res.graze)inj.push({t:'Balle logée ('+REGIONS[reg].n+')',sev:1});
  if(res.exit)inj.push({t:'Plaie transfixiante (entrée + sortie)',sev:1});
  c.painInj+=res.graze?6:kind==='bullet'?22:kind==='stab'?20:26;
}
function addInt(c,key,rate,cap,name){const b=c.intB[key];if(b)b.rate=Math.min(b.rate+rate*0.6,160);else c.intB[key]={rate,cap:cap||0,lost:0,name:name||key};}
function organDamage(c,id,dmg,kind,inj,lvl){
  if(id===undefined)return null;
  const o=ORGANS[id],k=o.key;const before=c.org[id];c.org[id]=Math.max(0,before-dmg);const pen=kind!=='blunt';
  if(o.vessel){
    if(!pen){if(dmg>30&&Math.random()<0.25&&!c.cut[id]){c.cut[id]=1;const rate=o.bleed*0.3;inj.push({t:o.name+' déchirée',sev:3});if(o.internal){addInt(c,k,rate,0,o.name);return null;}return{rate,key:k};}return null;}
    if(c.cut[id]===2)return null;
    const full=dmg>18||Math.random()<0.55;c.cut[id]=full?2:1;const rate=o.bleed*(full?1:0.45);
    inj.push({t:o.name+(full?' sectionnée !':' touchée'),sev:4});
    if(o.internal){addInt(c,k,rate,0,o.name);return null;}
    return{rate,key:k};
  }
  const lost=before-c.org[id];if(lost<=0)return null;
  const S=k.slice(-1),side=S==='R'?0:1;
  if(k==='brain'){if(pen){c.org[id]=Math.max(0,before-dmg*2.6);inj.push({t:'Lésion cérébrale',sev:4});c.concussion+=60;c.ichRate+=0.8;}else inj.push({t:'Contusion cérébrale',sev:3});}
  else if(k==='brainstem'){if(pen){c.org[id]=0;inj.push({t:'Tronc cérébral détruit',sev:4});}}
  else if(k==='heart'){if(pen){addInt(c,'heart',30+dmg*0.8,0,'Cœur');c.tamp=true;inj.push({t:'Cœur perforé !',sev:4});}else inj.push({t:'Contusion cardiaque',sev:2});}
  else if(k.startsWith('lung')){if(pen){c.pneumo[side]=1;c.openChest[side]=true;addInt(c,'hemothorax'+S,4+dmg*0.08,1500,'Hémothorax '+SFR[S]);inj.push({t:'Poumon '+SFR[S]+' perforé – pneumothorax',sev:3});}else inj.push({t:'Contusion pulmonaire '+SFR[S],sev:2});}
  else if(k==='trachea')inj.push({t:pen?'Trachée perforée':'Larynx / trachée contus',sev:3});
  else if(k.startsWith('cord')){if(k==='cordC')c.cordLvl=Math.min(c.cordLvl,lvl||5);inj.push({t:o.name+' lésée'+(c.org[id]<45?' – paralysie':''),sev:4});}
  else if(k.startsWith('eye')){c.eyeRed=true;inj.push({t:o.name+(c.org[id]<30?' crevé':' blessé'),sev:3});}
  else if(k.startsWith('innerEar')){inj.push({t:o.name+' lésée (audition)',sev:2});if(c.isPlayer){SV=1;SFX.ring();}}
  else if(o.nerve)inj.push({t:o.name+(c.org[id]<40?' sectionné – paralysie ('+o.role+')':pen?' lésé – faiblesse':' contus – fourmillements'),sev:c.org[id]<40?3:2});
  else{if(o.bleed)addInt(c,k,o.bleed*(pen?1:0.4)*clamp(lost/50,0.3,1.4),0,o.name);inj.push({t:o.name+(pen?(c.org[id]<30?' déchiré':' perforé'):' contus'),sev:pen?3:2});}
  return null;
}
function boneDamage(c,id,dmg,pen,inj){
  if(id===undefined)return;const b=BONES[id];c.bone[id]=Math.max(0,c.bone[id]-dmg*100/(b.str*(c.boneK||1)));
  const v=c.bone[id],st=c.boneSt[id];let ns=st;
  if(v<12)ns=4;else if(v<45)ns=Math.max(st,2);else if(v<75)ns=Math.max(st,1);
  if(ns>=2&&pen&&ns<4)ns=3;else if(ns===2&&v<25&&b.long&&Math.random()<0.4)ns=3;
  if(ns>st){c.boneSt[id]=ns;c.splint[id]=0;inj.push({t:BONE_STATUS[ns]+' : '+b.name,sev:ns>=3?3:ns===2?2:1});if(ns>=2)onFracture(c,b,ns,st);}
}
function onFracture(c,b,ns,prev){
  if(prev<2){sfxAt(c.P[c.pelvis]);SFX.crack();}
  c.painInj+=bonePain(b.key)*1.3+8;c.stun=Math.max(c.stun,b.long?0.9:0.3);
  const k=b.key,base=boneKeyBase(k);
  if(base==='femur')addInt(c,'frac_'+k,2.2,1300,'Fracture '+b.name);
  if(base==='hip')addInt(c,'frac_'+k,3.2,2000,'Fracture du bassin');
  if(base==='tibia')addInt(c,'frac_'+k,0.8,500,'Fracture '+b.name);
  if(base==='humerus')addInt(c,'frac_'+k,0.8,600,'Fracture '+b.name);
  if(/^C\d/.test(k)&&Math.random()<(ns>=3?0.8:0.35)){c.org[ORG.cordC]=Math.min(c.org[ORG.cordC],rnd(10,50));c.cordLvl=Math.min(c.cordLvl,b.level);}
  if(/^T\d/.test(k)&&Math.random()<(ns>=3?0.7:0.3))c.org[ORG.cordT]=Math.min(c.org[ORG.cordT],rnd(10,50));
  if(/^L\d/.test(k)&&Math.random()<(ns>=3?0.6:0.25))c.org[ORG.cordL]=Math.min(c.org[ORG.cordL],rnd(15,55));
  if(['frontal','parietal','temporal','occipital','sphenoid'].includes(base)){c.concussion+=25;c.org[ORG.brain]=Math.max(0,c.org[ORG.brain]-(ns>=3?25:8));if(base==='temporal'&&Math.random()<0.5)c.ichRate+=0.35;}
  if(ns>=3&&(b.long||base==='rib'||base==='clavicle'||base==='mandible')){const an=c._lastAn||anchorAt(c,c.P[c.pelvis]);c.shards.push({an:Object.assign({},an),id:b.id,e:new THREE.Euler(rnd(0,3),rnd(0,3),rnd(0,3))});if(c.shards.length>8)c.shards.shift();c.wounds.push(Object.assign(mkWound(c,b.region,anchorPos(c,an),'Fracture ouverte ('+b.name+')',2,0.024)));}
}
function muscleDamage(c,id,dmg,inj){if(id===undefined)return;const before=c.mus[id];c.mus[id]=Math.max(0,before-dmg);const k=MUSCLES[id].key;const a=muscleStatus(before,k)[1],b=muscleStatus(c.mus[id],k);if(isLig(k)&&b[1]>a&&b[1]>=1){inj.push({t:b[0]+' : '+MUSCLES[id].name,sev:b[1]>=3?3:2});return;}if(b[1]>a&&b[1]>=2)inj.push({t:b[0]+' : '+MUSCLES[id].name,sev:b[1]>=3?2:1});}
function applyBlunt(c,reg,point,dir,dmg,inj){
  c.bruise[reg]=Math.min(1,c.bruise[reg]+dmg/45);
  const vol=volumeFor(c,reg);let l=null;
  for(let s=-0.05;s<0.2;s+=0.01){const q=vol.local(add(point,mul(dir,s)));if(vol.inside(q)){l=vol.local(add(point,mul(dir,s+0.012)));break;}}
  if(!l)l=vol.local(point);
  const list=vol.structs(l,0,true);
  for(const h of list){if(h[0]==='bone')boneDamage(c,BONE_IDX[h[1]],dmg*(reg==='head'?0.85:1),false,inj);else if(h[0]==='mus')muscleDamage(c,MUS_IDX[h[1]],dmg*0.55,inj);else organDamage(c,ORG[h[1]],dmg*0.5,'blunt',inj,h[2]);}
  if(vol.kind==='torso'){const deep=vol.local(add(point,mul(dir,0.09)));for(const h of torsoStructs(deep,0.02,false))if(h[0]==='org'){const o=ORGANS[ORG[h[1]]];if(!o.vessel||dmg>35)organDamage(c,ORG[h[1]],dmg*0.32,'blunt',inj);}
    for(const h of list)if(h[1].startsWith('rib')&&c.boneSt[BONE_IDX[h[1]]]>=2&&dmg>18&&Math.random()<0.35){const S=h[1][3];c.pneumo[S==='R'?0:1]=1;organDamage(c,ORG['lung'+S],20,'pen',inj);inj.push({t:'Côte déplacée : poumon '+SFR[S]+' perforé',sev:3});break;}}
  if(reg==='head'){const before=c.concussion;c.concussion+=dmg*1.15*rnd(0.8,1.3);
    if(c.concussion>=45&&c.koT<=0&&c.alive){c.koT=3+c.concussion/12;inj.push({t:'K.O. – perte de connaissance',sev:3});}else if(c.concussion>=15&&before<15)inj.push({t:'Commotion cérébrale – sonné',sev:2});
    if(dmg>12)c.wounds.push(mkWound(c,reg,point,'Plaie du cuir chevelu',rnd(1.2,2.6)));}
  else if(dmg>16&&Math.random()<0.5)c.wounds.push(mkWound(c,reg,point,'Lacération',rnd(0.3,0.9)));
  c.painInj+=dmg*0.9;
}
function applyTaser(c,reg,point,inj){c.tasedT=5;c.stun=Math.max(c.stun,5.2);c.painInj+=40;c.wounds.push(mkWound(c,reg,point,'Piqûre (ardillon de taser)',0.05,0.007));inj.push({t:'Neutralisé (taser) – muscles contractés',sev:2});sfxAt(point);SFX.taser();}

/* ---------------- falls ---------------- */
function fallInjury(c,pi,v){
  if(v<6.5)return;
  const P=c.P;const h=v*v/19.6;c.fallH=h;c.lastFallT=GT;
  const sev=(v-6.5)*(v-6.5)*1.6;const inj=[];
  sfxAt(P[pi]);SFX.thud();wake(c);
  const L0=c.legs[0],L1=c.legs[1],A0=c.arms[0],A1=c.arms[1];
  const feet=[L0.ft,L0.toe,L1.ft,L1.toe,L0.sm,L1.sm].includes(pi),headHit=pi===c.head||pi===c.neck,handHit=[A0.ha,A1.ha,A0.fm,A1.fm,A0.el,A1.el].includes(pi);
  const B=(k,m)=>boneDamage(c,BONE_IDX[k],sev*m*rnd(0.7,1.3),false,inj);
  c._lastAn=anchorAt(c,P[pi]);
  const Mu=(k,m)=>muscleDamage(c,MUS_IDX[k],sev*m*rnd(0.6,1.4),inj);
  if(feet){for(const s of SIDES){Mu('ankleLig'+s,2.2);Mu('acl'+s,1.2);Mu('meniscus'+s,1.5);B('calcaneus'+s,1.4);B('talus'+s,1.0);B('tibia'+s,0.9);B('fibula'+s,0.6);B('femur'+s,0.55);B('hip'+s,0.5);}B('L1',0.6);B('T12',0.5);}
  else if(headHit){B(pick(['frontal','parietalR','parietalL','occipital','temporalR','temporalL']),1.3);B('C'+rndi(4,7),0.9);c.concussion+=sev*1.4;organDamage(c,ORG.brain,sev*0.5,'blunt',inj);}
  else if(handHit){const s=(pi===A0.ha||pi===A0.fm||pi===A0.el)?'R':'L';Mu('wristLig'+s,2);Mu('rotCuff'+s,1);B('radius'+s,1.3);B('scaphoid'+s,1.1);B('ulna'+s,0.8);B('humerus'+s,0.6);B('clavicle'+s,0.6);}
  else{const s=Math.random()<0.5?'R':'L';for(let i=0;i<4;i++)B('rib'+s+rndi(3,11),0.9);B('T'+rndi(6,12),0.7);B('L'+rndi(1,5),0.6);B('hip'+s,0.6);B('scapula'+s,0.5);}
  if(sev>25)for(const k of ['spleen','liver','lungR','lungL','kidneyR','kidneyL'])if(Math.random()<clamp(sev/220,0,0.8))organDamage(c,ORG[k],sev*rnd(0.2,0.5),'blunt',inj);
  if(sev>110&&Math.random()<0.6)organDamage(c,ORG.aorta,40,'decel',inj);
  if(sev>60){c.concussion+=sev*0.3;organDamage(c,ORG.brain,sev*0.25,'blunt',inj);}
  for(const r of ['thorax','pelvis','thighR','thighL'])c.bruise[r]=Math.min(1,c.bruise[r]+sev/80);
  c.painInj+=sev*0.7;c.stun=Math.max(c.stun,clamp(sev/30,0.5,4));c.adren=1;
  if(sev>8)inj.unshift({t:'Chute de '+h.toFixed(1)+' m',sev:sev>60?4:sev>25?3:2});
  reportInjuries(c,inj,P[pi]);c.dirty=true;computeFunctions(c);
}

/* ---------------- burns ---------------- */
const BURN_SPREAD={head:['head','neck'],neck:['neck','head','thorax'],thorax:['thorax','abdomen','uarmR','uarmL','neck'],abdomen:['abdomen','thorax','pelvis'],pelvis:['pelvis','abdomen','thighR','thighL'],
  uarmR:['uarmR','thorax','larmR'],uarmL:['uarmL','thorax','larmL'],larmR:['larmR','uarmR','handR'],larmL:['larmL','uarmL','handL'],handR:['handR','larmR'],handL:['handL','larmL'],
  thighR:['thighR','shinR','pelvis'],thighL:['thighL','shinL','pelvis'],shinR:['shinR','footR','thighR'],shinL:['shinL','footL','thighL'],footR:['footR','shinR'],footL:['footL','shinL']};
function burnDose(c,reg,d){const b=c.burn[reg];b.dose+=d;b.area=Math.min(1,b.area+d*0.12);const deg=b.dose>9?3:b.dose>3.5?2:b.dose>0.6?1:0;
  if(deg>b.deg){b.deg=deg;if(deg>=2)reportInjuries(c,[{t:'Brûlure '+deg+'e degré : '+REGIONS[reg].n,sev:deg}],c.P[c.chest]);c.painInj+=deg===2?16:8;}
  if(b.deg===3)for(const m of MUSCLES)if(m.region===reg)c.mus[m.id]=Math.max(0,c.mus[m.id]-d*2);}
function ignite(c,reg,t){if(c.inWater)return;if(c.burning<=0){c.burnSrc=reg||'thorax';reportInjuries(c,[{t:'Prend feu !',sev:4}],c.P[c.chest]);}c.burning=Math.max(c.burning,t||9);wake(c);}
function burnTick(c,dt){
  if(c.burning<=0)return;
  c.burning-=dt*((!c.alive||!c.canStand||!c.conscious)?2.2:1)*(SET.rain&&!SNOW?1.7:1);if(c.inWater)c.burning=0;
  if(c.burning<=0)return;
  const regs=BURN_SPREAD[c.burnSrc]||REG_KEYS;for(let i=0;i<2;i++)burnDose(c,pick(regs),dt*1.5);if(Math.random()<dt*0.5)c.burnSrc=pick(regs);
  c.lastBurnT=GT;c.painInj+=dt*5;c.adren=1;c.wet=Math.max(0,c.wet-dt*0.2);if(c.alive&&(c.burn.head.deg>=2||c.burn.neck.deg>=2))c.inhal=Math.min(1,c.inhal+dt*0.06);
  const P=c.P;for(let i=0;i<2;i++){const p=P[rndi(0,P.length-1)];emitFlame(p.x+rnd(-0.06,0.06),p.y,p.z+rnd(-0.06,0.06),1);}if(Math.random()<0.3){const p=P[c.chest];emitSmoke(p.x,p.y+0.3,p.z,0.18);}
  if(c.alive&&c.conscious&&Math.random()<dt*1.1){sfxAt(P[c.head]);SFX.scream(c.isPlayer?0.85:1.05);}
}
function burnTBSA(c){let t=0;for(const r of REG_KEYS){const b=c.burn[r];if(b.deg>=2)t+=REGIONS[r].tbsa*b.area;}return t;}

/* ---------------- physiology ---------------- */
function srcAdd(c,name,ml){c.bsrc[name]=(c.bsrc[name]||0)+ml;}
function topBleed(c){let b=null,v=0;for(const k in c.bsrc)if(c.bsrc[k]>v){v=c.bsrc[k];b=k;}return b||'hémorragie';}
function drip(c,w,r){const p=anchorPos(c,w.an,0.004);if(w.art>0.5&&!w.bandaged&&!c.tq[w.limb]){const F=capFrame(c,w.an.hi);const q=lerp3(F.a,F.b,w.an.t);const n=norm(sub(p,q));for(let i=0;i<2;i++)spawnP(p,{x:n.x*0.035+rnd(-0.004,0.004),y:n.y*0.035+rnd(0,0.01),z:n.z*0.035+rnd(-0.004,0.004)},'blood');}else spawnP(p,{x:rnd(-0.002,0.002),y:-0.002,z:rnd(-0.002,0.002)},'blood');}
function physiology(c,dt){
  const P=c.P;
  if(!c.alive){c.deadT+=dt;c.temp+=(SET.temp-c.temp)*dt*0.004*THERM;for(const w of c.wounds){w.ven*=0.96;w.art*=0.94;w.cur=w.ven+w.art;if(w.cur>0.3&&Math.random()<w.cur*dt*0.6)drip(c,w,w.cur);c.soak[w.reg]+=w.cur*dt;}return;}
  const pel=P[c.pelvis];c.exert=clamp(Math.hypot(pel.x-pel.ox,pel.z-pel.oz)/0.045,0,1);
  // bleeding
  const press=clamp(c.sbp/115,0.1,1.15);let ext=0;
  for(const w of c.wounds){
    if(!w.bandaged)w.ven*=Math.exp(-0.011*dt);if(c.sbp<60)w.art*=Math.exp(-0.004*dt);
    let r=(w.limb&&c.tq[w.limb])?0:((w.bandaged?0:w.ven)+w.art*(w.bandaged?(w.junction?0.5:0.4):1));
    r*=press;w.cur=r;ext+=r;w.lost+=r*dt;c.soak[w.reg]+=r*dt;
    if(r>0.25&&Math.random()<Math.min(1,r*dt*1.3))drip(c,w,r);
    if(r>0)srcAdd(c,w.artKey?ORGANS[ORG[w.artKey]].name:('plaie – '+REGIONS[w.reg].n),r*dt);
  }
  let int=0;
  for(const k in c.intB){const b=c.intB[k];if(b.cap&&b.lost>=b.cap)continue;const r=b.rate*press;if(k==='liver'||k==='spleen'||k.startsWith('kidney')||k.startsWith('hemothorax'))b.rate*=Math.exp(-0.002*dt);int+=r;b.lost+=r*dt;srcAdd(c,b.name+' (interne)',r*dt);}
  const tbsa=burnTBSA(c);c.blood=Math.max(0,c.blood-(ext+int+tbsa*0.06)*dt);c.extBleed=ext;c.intBleed=int;c.tbsa=tbsa;
  const f=clamp(1-c.blood/c.bloodMax,0,1);c.lossF=f;
  if(c.tamp)c.tampV=Math.min(450,c.tampV+(c.intB.heart?c.intB.heart.rate*0.5:0)*dt);
  // respiration
  for(let s=0;s<2;s++)if(c.pneumo[s]&&!c.seal[s])c.collapse[s]=Math.min(1,c.collapse[s]+dt*0.022);
  const lungs=[0,1].map(s=>(c.org[ORG['lung'+SIDES[s]]]/100)*(1-c.collapse[s]));
  let aw=c.org[ORG.trachea]<45?c.org[ORG.trachea]/45:1;if(!c.conscious&&!c.pls)aw*=c.boneSt[BONE_IDX.mandible]>=2?0.7:0.88;if(c.conscious)c.pls=false;
  if(c.headUnder){c.breathHold+=dt;const bh=(c.sink||0)>0.5?12:35;if(!c.conscious||c.breathHold>bh){aw=0;c.lungWater=Math.min(3000,c.lungWater+dt*(c.conscious?16:10));}else aw*=clamp(1-c.breathHold/(bh+10),0,1);}
  else{c.breathHold=Math.max(0,c.breathHold-dt*4);if(c.lungWater>0&&c.rr>0)c.lungWater=Math.max(0,c.lungWater-dt*(c.conscious?1.6:0.6));}
  if(c.gasExp>0){const g=c.gasExp;c.gasDose+=g*dt;for(const s of SIDES)c.org[ORG['lung'+s]]=Math.max(0,c.org[ORG['lung'+s]]-g*dt*5);c.org[ORG.trachea]=Math.max(0,c.org[ORG.trachea]-g*dt*2.5);aw*=1-clamp(g,0,1)*0.5;for(const s of SIDES)c.org[ORG['eye'+s]]=Math.max(30,c.org[ORG['eye'+s]]-g*dt*1.5);c.painInj+=g*dt*4;c.gasExp=0;}
  if(c.inhal>0)aw*=1-clamp(c.inhal,0,1)*0.65;
  if(c.windT>0){c.windT-=dt;aw*=0.25;}
  const cordCd=1-c.org[ORG.cordC]/100;let drive=1;if(cordCd>0.55&&c.cordLvl<=4)drive=0;else if(cordCd>0.55)drive=0.6;
  drive*=clamp(1-Math.max(0,c.morph-2)*0.28,0,1);if(c.temp<28)drive*=0.5;if(c.arrest)drive=0;c.drive=drive;
  let ribs=0;for(const s of SIDES)for(let i=1;i<=12;i++)if(c.boneSt[BONE_IDX['rib'+s+i]]>=2)ribs++;c.ribs=ribs;
  const oxy=((lungs[0]+lungs[1])/2)*aw*drive*(ribs>=4?0.85:1-ribs*0.02)*(0.55+0.45*c.mus[MUS_IDX.diaphragm]/100)/(1+c.lungWater/250);c.oxy=oxy;
  if(c.o2T>0)c.o2T-=dt;
  c.spo2+=((40+58*clamp(oxy*1.15*(c.o2T>0&&drive>0?1.45:1),0,1))-c.spo2)*clamp(dt*0.2,0,1);
  // heart & circulation
  let heartFn=c.org[ORG.heart]/100;if(c.tamp)heartFn*=clamp(1-c.tampV/450,0.08,1);c.heartFn=heartFn;
  if(!c.arrest){
    let hr=72+(f<0.15?f*80:12+(f-0.15)*260)+c.painEff*0.3+c.exert*30+(c.adren>0?12:0);
    if(c.temp<35)hr*=clamp((c.temp-26)/9,0.3,1);if(c.temp>38)hr+=(c.temp-38)*10;if(f>0.42)hr*=0.75;
    c.hr+=(clamp(hr,28,185)-c.hr)*clamp(dt*0.5,0,1);
    let sbp=120*Math.min(1,heartFn*1.15)*(1-Math.max(0,f-0.12)*2.3);if(c.spo2<60)sbp*=0.7;if(c.temp<30)sbp*=0.7;if(tbsa>25)sbp*=0.9;
    c.sbp+=(clamp(sbp,0,160)-c.sbp)*clamp(dt*0.4,0,1);c.dbp=c.sbp*0.66;
    c.rr=drive<=0?0:clamp(14+f*28+(1-oxy)*18+c.painEff*0.08+ribs*0.8,6,48);
  }else{c.hr=0;c.sbp=0;c.dbp=0;c.rr=0;}
  // temperature
  const inW=c.inWater,amb=inW?clamp(SET.temp,3,21):SET.temp;
  if(inW)c.wet=1;else if(SET.rain&&!SNOW)c.wet=Math.min(0.85,c.wet+dt*(c.blanket>0?0.001:0.006));else if(SNOW)c.wet=Math.min(0.5,c.wet+dt*0.002);else c.wet=Math.max(0,c.wet-dt*(0.004+c.fireHeat*0.03));
  const loss=0.00019*(c.temp-amb)*(c.blanket>0?0.35:1)*c.insul*(1+c.wet*1.6)*(inW?2.5:1)*(1+f*1.5)*(typeof WAVE!=='undefined'&&WAVE.kind?2:1);
  c.shivering=c.temp<36.4&&c.temp>32&&!c.arrest;
  let prod=c.arrest?0:(0.0042+(c.shivering?0.0025:0)+c.exert*0.0018)*c.thermoK;
  if(c.temp>37.2&&!c.arrest)prod-=(c.temp-37)*0.006*(f>0.3?0.4:1);
  prod+=c.fireHeat*0.006+(c.burning>0?0.012:0);
  c.temp+=(prod-loss)*dt*THERM;c.blanket=Math.max(0,c.blanket-dt);
  // pain
  let base=0;
  for(let i=0;i<BONES.length;i++){const st=c.boneSt[i];if(st>=2)base+=c.splint[i]?bonePain(BONES[i].key)*0.4:bonePain(BONES[i].key)*(st>=3?1.3:1);else if(st===1)base+=2;}
  for(let i=0;i<MUSCLES.length;i++){const hh=c.mus[i];if(hh<95)base+=(100-hh)*0.04;}
  base+=c.wounds.length*1.2;
  for(const r of REG_KEYS){const b=c.burn[r];const a=REGIONS[r].tbsa*b.area;if(b.deg===2)base+=a*2.2;else if(b.deg===1)base+=a*0.8;else if(b.deg===3)base+=a*0.6;}
  for(const k in c.tq)if(c.tq[k])base+=14;
  for(const k of ['liver','stomach','spleen','smallInt','colon','kidneyR','kidneyL','bladder','pancreas'])if(c.org[ORG[k]]<70)base+=8;
  c.painInj*=Math.exp(-0.03*dt);
  const prevPain=c.painEff;
  c.painEff=clamp((c.painInj+Math.min(base,75)-c.morph*30)*(c.adren>0?0.72:1)*(c.conscious?1:0.3),0,100);
  if(c.painEff-prevPain>30&&Math.random()<0.35&&c.conscious)c.faintT=rnd(2,5);
  // brain
  c.concussion=Math.max(0,c.concussion-dt*0.12);
  if(c.ichRate>0){c.ich+=c.ichRate*dt;if(c.ich>35)c.org[ORG.brain]=Math.max(0,c.org[ORG.brain]-(c.ich-35)*0.015*dt);}
  if(c.spo2<65)c.org[ORG.brain]=Math.max(0,c.org[ORG.brain]-(65-c.spo2)*0.02*dt);
  if(c.sbp<45&&!c.arrest)c.org[ORG.brain]=Math.max(0,c.org[ORG.brain]-(45-c.sbp)*0.006*dt);
  c.morph=Math.max(0,c.morph-dt/90);c.adren=Math.max(0,c.adren-dt/50);c.koT-=dt;c.faintT-=dt;
  // consciousness (Glasgow)
  let g=15-c.concussion/12-(100-c.org[ORG.brain])/7-c.ich/9;
  if(f>0.3)g-=2;if(f>0.37)g-=5;if(c.spo2<85)g-=2;if(c.spo2<75)g-=4;if(c.spo2<65)g-=5;
  if(c.temp<33)g-=2;if(c.temp<30)g-=5;if(c.temp<28)g-=8;if(c.temp>40.5)g-=3;if(c.temp>42)g-=7;
  g-=Math.max(0,c.morph-1)*1.5;if(c.koT>0||c.faintT>0)g=Math.min(g,7);if(c.arrest)g=3;
  c.gcs=clamp(Math.round(g),3,15);
  const wasC=c.conscious;c.conscious=c.gcs>8;
  if(wasC&&!c.conscious){reportInjuries(c,[{t:'Perd connaissance',sev:4}],P[c.head]);}
  c.fnT-=dt;if(c.fnT<=0||c.dirty){computeFunctions(c);c.fnT=0.5;c.dirty=false;}
  // cardiac arrest & death
  if(!c.arrest){
    if(c.sbp<45)c.lowBpT+=dt;else c.lowBpT=Math.max(0,c.lowBpT-dt);
    if(c.spo2<48)c.hypoxT+=dt;else c.hypoxT=Math.max(0,c.hypoxT-dt);
    let why=null,instant=false;
    if(c.org[ORG.brainstem]<35){why='Lésion du tronc cérébral';instant=true;}
    else if(c.org[ORG.brain]<10){why='Lésion cérébrale irréversible';instant=c.org[ORG.brain]<3;}
    else if(c.org[ORG.heart]<30)why='Plaie du cœur';
    else if(f>0.42||c.lowBpT>3)why='Choc hémorragique – '+topBleed(c);
    else if(c.hypoxT>6)why=(c.headUnder||c.lungWater>150)?'Noyade (eau dans les poumons : '+Math.round(c.lungWater)+' ml)':c.gasDose>2?'Asphyxie (gaz toxique)':c.inhal>0.5?'Asphyxie (brûlure des voies respiratoires)':(drive<=0&&cordCd>0.55)?'Arrêt respiratoire (moelle cervicale)':c.morph>3?'Dépression respiratoire (surdose de morphine)':c.org[ORG.trachea]<45?'Asphyxie (trachée)':(c.collapse[0]>0.6&&c.collapse[1]>0.6)?'Asphyxie (pneumothorax bilatéral)':'Asphyxie';
    else if(c.temp<24)why='Hypothermie sévère';else if(c.temp>44)why='Coup de chaleur';
    if(why){if(GT-c.lastFallT<4&&c.fallH>6)why='Chute de '+Math.round(c.fallH)+' m – '+why;c.cause=why;if(instant){kill(c,why);return;}c.arrest=true;c.arrestT=0;if(c.isPlayer){SV=1;SFX.flat();}reportInjuries(c,[{t:'Arrêt cardiaque !',sev:4}],P[c.chest]);}
  }else{c.arrestT+=dt;if(c.arrestT>10)kill(c,c.cause);}
}
function computeFunctions(c){
  const bs=k=>c.boneSt[BONE_IDX[k]],sp=k=>c.splint[BONE_IDX[k]],m=k=>c.mus[MUS_IDX[k]]/100,o=k=>c.org[ORG[k]]/100;
  const cordCd=1-o('cordC'),cordTd=1-o('cordT'),cordLd=1-o('cordL');
  c.tetra=cordCd>0.55;c.para=c.tetra||cordTd>0.55||cordLd>0.6;
  const cordArm=c.tetra?(c.cordLvl>=5?0.25:0):1-cordCd*0.5;
  for(let s=0;s<2;s++){const S=SIDES[s];
    let L=1;const fem=bs('femur'+S),tib=bs('tibia'+S);
    if(fem>=2)L=Math.min(L,sp('femur'+S)?0.3:0);else if(fem===1)L=Math.min(L,0.75);
    if(tib>=2)L=Math.min(L,sp('tibia'+S)?0.45:0.08);else if(tib===1)L=Math.min(L,0.8);
    if(bs('fibula'+S)>=2)L=Math.min(L,0.72);if(bs('patella'+S)>=2)L=Math.min(L,0.3);if(bs('hip'+S)>=2)L=Math.min(L,0.2);if(bs('sacrum')>=2)L=Math.min(L,0.45);
    if(bs('calcaneus'+S)>=2||bs('talus'+S)>=2)L=Math.min(L,0.3);
    for(const k of ['navicular','cuboid','cuneiform1','cuneiform2','cuneiform3','mt1','mt2','mt3','mt4','mt5'])if(bs(k+S)>=2)L*=0.88;
    L*=(0.22+0.78*m('quad'+S))*(0.6+0.4*m('hams'+S))*(0.6+0.4*m('gluteMax'+S))*(0.8+0.2*m('gluteMed'+S))*(0.7+0.3*m('psoas'+S))*(0.85+0.15*m('adductors'+S))*(0.45+0.55*Math.min(m('acl'+S),m('pcl'+S),m('mcl'+S),m('lcl'+S)))*(0.8+0.2*m('meniscus'+S))*(0.6+0.4*m('ankleLig'+S))*(0.5+0.5*(m('gastroc'+S)+m('soleus'+S))/2)*(0.65+0.35*m('tibAnt'+S))*(m('achilles'+S)<0.4?0.3:1)*(0.85+0.15*m('footm'+S));
    L*=(0.1+0.9*o('sciatic'+S))*(0.3+0.7*o('femoralN'+S))*(0.65+0.35*o('peronealN'+S));if(c.tq['leg'+S]&&GT-c.tq['leg'+S]>45)L*=0.55;if(c.para)L=0;
    c.legFn[s]=clamp(L,0,1);
    let A=1;
    if(bs('humerus'+S)>=2)A=Math.min(A,sp('humerus'+S)?0.35:0.05);else if(bs('humerus'+S)===1)A=Math.min(A,0.75);
    const rb=bs('radius'+S),ub=bs('ulna'+S);if(rb>=2||ub>=2){const spl=sp('radius'+S)||sp('ulna'+S);A=Math.min(A,(rb>=2&&ub>=2)?(spl?0.35:0.12):(spl?0.6:0.4));}
    if(bs('clavicle'+S)>=2)A=Math.min(A,0.4);if(bs('scapula'+S)>=2)A=Math.min(A,0.6);
    let grip=1;for(const b of BONES)if(b.region==='hand'+S&&c.boneSt[b.id]>=2)grip*=b.sub==='phalanx'?0.93:0.8;
    grip*=(0.6+0.4*m('wristLig'+S))*(0.4+0.6*m('flexors'+S))*(0.6+0.4*m('handm'+S));
    A*=(0.55+0.45*m('rotCuff'+S))*(0.5+0.5*m('deltoid'+S))*(0.6+0.4*m('biceps'+S))*(0.7+0.3*m('triceps'+S))*(0.85+0.15*m('brachialis'+S))*(0.75+0.25*m('extensors'+S));
    const nR=o('radialN'+S),nM=o('medianN'+S),nU=o('ulnarN'+S);grip*=(0.35+0.65*nM)*(0.55+0.45*nU)*(0.45+0.55*nR);
    A*=(0.35+0.65*nR)*(0.8+0.2*nM)*cordArm;if(c.tq['arm'+S]&&GT-c.tq['arm'+S]>45)A*=0.55;
    c.grip[s]=clamp(grip,0,1);c.armFn[s]=clamp(A*(0.35+0.65*grip),0,1);
  }
  const lf=c.legFn,mx=Math.max(lf[0],lf[1]),mn=Math.min(lf[0],lf[1]);
  c.support=mx*0.6+mn*0.4;
  c.dizzy=clamp(c.concussion*0.9+(c.lossF>0.25?(c.lossF-0.25)*150:0)+(c.spo2<88?(88-c.spo2)*2:0)+Math.max(0,c.morph-1)*12+(c.temp<33?(33-c.temp)*10:0)+(c.temp>40?(c.temp-40)*15:0)+(c.ich>10?c.ich:0),0,100);
  c.canStand=c.support>=0.33&&mn>=0.1&&c.painEff<88&&!c.para&&c.temp>30&&c.lossF<0.38&&c.dizzy<85;
  c.speedF=clamp(c.support*1.1,0.12,1)*(1-c.painEff*0.004)*(c.temp<35?clamp((c.temp-29)/6,0.3,1):1)*(c.lossF>0.2?clamp(1-(c.lossF-0.2)*2.5,0.4,1):1)*(1-Math.min(0.4,c.tbsa*0.01))*(c.temp>40?0.7:1);
  c.shiver=c.shivering?clamp((36.4-c.temp)/2,0.15,1):0;
  for(const st of c.S){if(st.kind!=='stiff')continue;const p=st.part,S=p.slice(-1);
    if(p==='neckS'){let cf=false;for(let i=1;i<=7;i++)if(bs('C'+i)>=2)cf=true;st.k=cf?0.05:st.k0;continue;}
    let fl=false;
    if(p.startsWith('thigh'))fl=bs('femur'+S)>=2&&!sp('femur'+S);
    else if(p.startsWith('shin'))fl=(bs('tibia'+S)>=2&&!sp('tibia'+S))||bs('fibula'+S)>=4;
    else if(p.startsWith('uarm'))fl=bs('humerus'+S)>=2&&!sp('humerus'+S);
    else if(p.startsWith('larm'))fl=((bs('radius'+S)>=2&&bs('ulna'+S)>=2)||bs('radius'+S)>=4||bs('ulna'+S)>=4)&&!sp('radius'+S)&&!sp('ulna'+S);
    else if(p.startsWith('foot'))fl=bs('calcaneus'+S)>=3||bs('talus'+S)>=3;
    st.active=!fl;}
  c.holdW=null;
  if(!c.isPlayer&&c.alive&&c.conscious){let best=null;for(const w of c.wounds)if(w.cur>0.7&&(!best||w.cur>best.cur))best=w;
    if(best){let arm=c.hasWeapon?1-Math.max(0,c.useArm):(best.reg.endsWith('R')?1:0);const lb=limbOfReg(best.reg);if(lb==='arm'+SIDES[arm])arm=1-arm;if(c.armFn[arm]>0.25&&lb!=='arm'+SIDES[arm]){c.holdW=best;c.holdArm=arm;}}}
}

/* ---------------- treatments ---------------- */
const INV={};function resetInv(){for(const it of MED_ITEMS)INV[it.k]=it.start;}
function rosc(t){t.arrest=false;t.arrestT=0;t.lowBpT=0;t.hypoxT=0;t.sbp=Math.max(t.sbp,72);t.hr=100;t.spo2=Math.max(t.spo2,80);t.cause='';t.koT=Math.max(t.koT,20);reportInjuries(t,[{t:'Le cœur repart (pouls retrouvé)',sev:2}],t.P[t.chest]);}
const LIMB_NAMES={armR:'bras droit',armL:'bras gauche',legR:'jambe droite',legL:'jambe gauche'};
function applyItem(k,t){
  const it=MED_ITEMS.find(i=>i.k===k);
  if(!SET.infiniteMed&&!it.unlimited&&INV[k]<=0)return'Plus de '+it.n.toLowerCase()+'.';
  if(!t.alive)return'Cette personne est décédée.';
  let msg=null;
  if(k==='bandage'){const ws=t.wounds.filter(w=>!w.bandaged&&(w.ven+w.art)>0.05);if(!ws.length)return'Aucune plaie qui saigne.';for(const w of ws){w.bandaged=true;w.ven=0;}t.painInj=Math.max(0,t.painInj-5);msg=ws.length+' plaie(s) pansée(s).'+(ws.some(w=>w.art>0)?' Saignement artériel seulement réduit : posez un garrot !':'');}
  else if(k==='tourniquet'){let best=null,bv=0;for(const limb of ['legR','legL','armR','armL']){if(t.tq[limb])continue;let v=0;for(const w of t.wounds)if(w.limb===limb)v+=w.art*4+(w.bandaged?0:w.ven);if(v>bv){bv=v;best=limb;}}
    if(!best||bv<0.3)return'Aucune hémorragie de bras ou de jambe.';t.tq[best]=GT;t.painInj+=15;msg='Garrot posé : '+LIMB_NAMES[best]+'.';}
  else if(k==='chestseal'){let n=0;for(let s=0;s<2;s++)if(t.pneumo[s]&&!t.seal[s]){t.seal[s]=1;t.collapse[s]=Math.max(0,t.collapse[s]-0.2);n++;}if(!n)return'Pas de plaie thoracique soufflante.';msg='Pansement thoracique posé.';}
  else if(k==='splint'){let id=null;for(const b of ['femur','tibia','humerus','radius','ulna','fibula','patella','clavicle']){for(const s of SIDES){const i=BONE_IDX[b+s];if(i!==undefined&&t.boneSt[i]>=2&&!t.splint[i]){id=i;break;}}if(id!==null)break;}
    if(id===null)return'Aucune fracture de membre à immobiliser.';t.splint[id]=1;t.painInj=Math.max(0,t.painInj-10);msg='Attelle : '+BONES[id].name+'.';}
  else if(k==='morphine'){t.morph+=1;t.morphTotal++;msg='Morphine injectée'+(t.morph>2.5?' – attention : la respiration ralentit !':'.');}
  else if(k==='blanket'){t.blanket=150;t.wet=Math.max(0,t.wet-0.4);msg='Couverture de survie posée.';}
  else if(k==='water'){const wasB=t.burning>0;t.burning=0;t.wet=Math.min(1,t.wet+0.6);t.painInj=Math.max(0,t.painInj-12);for(const r of REG_KEYS){const b=t.burn[r];if(b.deg>0)b.dose=Math.max(0,b.dose-0.3);}msg=wasB?'Feu éteint !':'Brûlures refroidies.';}
  else if(k==='oxygen'){t.o2T=150;msg='Masque à oxygène posé.';}
  else if(k==='pls'){if(t.conscious)return'Il est conscient : pas besoin de PLS.';if(t.arrest)return'Il ne respire plus : massage cardiaque (RCP) !';t.pls=true;const P=t.P;for(const q of P){q.ox=q.x;q.oz=q.z;}msg='Mis en position latérale de sécurité : voies aériennes libres.';}
  else if(k==='cpr'){if(!t.arrest)return'Pas en arrêt cardiaque : le cœur bat encore.';t.arrestT=Math.max(0,t.arrestT-3.5);t.cprN++;t.lungWater=Math.max(0,t.lungWater-150);
    const cs=t.cause||'';let p=0.07;if(/Noyade|Asphyxie|Hypotherm|foudr|électr|respiratoire|gaz/.test(cs))p=0.32;if(/hémorragique/.test(cs))p=t.lossF>0.4?0.01:0.05;if(/cœur|cérébral|tronc|Tronc/.test(cs))p=0;
    if(Math.random()<p){rosc(t);msg='Le cœur repart ! La RCP a marché.';}else msg='Massage cardiaque : 30 compressions, 2 insufflations… continuez !';}
  else if(k==='aed'){if(!t.arrest)return"Le DAE analyse : rythme non choquable (le cœur bat).";const cs=t.cause||'';let p=/foudr|électr/.test(cs)?0.6:/Hypotherm/.test(cs)?0.25:/Noyade|Asphyxie|gaz/.test(cs)?0.15:0.1;if(/hémorragique/.test(cs))p=t.lossF>0.4?0.02:0.08;if(/cœur|cérébral|tronc|Tronc/.test(cs))p=0;
    if(Math.random()<p){rosc(t);msg='Choc délivré : le cœur repart !';}else{t.arrestT=Math.max(0,t.arrestT-2);msg='Choc délivré… pas de reprise. Continuez le massage.';}}
  if(!SET.infiniteMed&&!it.unlimited)INV[k]--;
  SV=1;SFX.heal();t.dirty=true;computeFunctions(t);if(t!==player&&t.conscious)say(t,'thanks',true);
  return msg;
}

/* ---------------- blood report ---------------- */
function fmtT(s){s=Math.max(0,s);if(s<60)return Math.round(s)+' s';const m=Math.floor(s/60);return m+' min '+String(Math.round(s%60)).padStart(2,'0')+' s';}
function woundBleedStatus(c,w){
  if(w.limb&&c.tq[w.limb])return['Arrêté (garrot)',0];
  if(w.cur<0.03)return[w.lost>3?'Arrêté (caillot)':'Ne saigne pas',0];
  if(w.art>0.3)return[w.bandaged?"Artériel – freiné par le pansement, ne s'arrête pas seul":"Artériel, en jets – ne s'arrête pas seul !",4];
  if(w.bandaged)return['Pansé – suinte',1];
  return["Veineux – ralentit, caillot dans ~"+fmtT(Math.log(Math.max(w.ven,0.051)/0.05)/0.011),2];
}
function intBleedStatus(k,b){
  if(b.cap&&b.lost>=b.cap)return['Arrêté (hématome formé)',1];
  if(b.cap)return["S'arrêtera après ~"+Math.round(b.cap-b.lost)+' ml (hématome)',2];
  if(k==='aorta'||k==='venaCava'||k==='heart'||k.startsWith('iliac'))return["Ne s'arrête pas – chirurgie nécessaire",4];
  if(k==='liver'||k==='spleen'||k.startsWith('kidney')||k.startsWith('hemothorax'))return['Interne – ralentit très lentement',3];
  return['Interne',3];
}
function bloodReport(c){
  const tot=c.extBleed+c.intBleed+c.tbsa*0.06;const lost=c.bloodMax-c.blood;
  const art=c.wounds.some(w=>w.art>0.3&&w.cur>0.03);const major=Object.keys(c.intB).some(k=>{const b=c.intB[k];return(!b.cap||b.lost<b.cap)&&intBleedStatus(k,b)[1]>=3;});
  let trend;if(!c.alive)trend='Décédé – le cœur ne pompe plus';else if(tot<0.05)trend="Le saignement s'est arrêté";else if(art||major)trend="Ne s'arrêtera pas tout seul – soins urgents";else trend='Ralentit – le sang coagule';
  const toCrit=tot>0.05&&c.alive?Math.max(0,(c.blood-c.bloodMax*0.6))/tot:null,toDeath=tot>0.05&&c.alive?Math.max(0,(c.blood-c.bloodMax*0.5))/tot:null;
  return{tot,lost,trend,toCrit,toDeath,kg:Math.round(c.bloodMax/70)};
}

/* ---------------- summaries ---------------- */
function shockClass(f){return f<0.15?'classe I':f<0.3?'classe II':f<0.4?'classe III':'classe IV';}
function stateLabel(c){if(!c.alive)return'Décédé';if(c.arrest)return'Arrêt cardiaque';if(!c.conscious)return'Inconscient';if(c.tasedT>0)return'Neutralisé';if(c.stun>0.5)return'Sonné';if(!c.canStand)return'Au sol';if(c.dizzy>25)return'Étourdi';return'Conscient';}
function medSummary(c){
  const L=[];
  if(!c.alive)L.push({t:'Décédé – '+c.cause,sev:4});else if(c.arrest)L.push({t:'Arrêt cardiaque ('+Math.max(0,10-c.arrestT).toFixed(0)+' s)',sev:4});else if(!c.conscious)L.push({t:'Inconscient (Glasgow '+c.gcs+')',sev:4});
  for(const w of c.wounds)if(w.art>0.5&&w.cur>0.3)L.push({t:'Hémorragie artérielle : '+ORGANS[ORG[w.artKey]].name+' ('+w.cur.toFixed(0)+' ml/s)',sev:4});
  if(c.extBleed>0.5)L.push({t:'Saignement externe : '+c.extBleed.toFixed(1)+' ml/s',sev:c.extBleed>10?4:c.extBleed>3?3:2});
  if(c.intBleed>0.5)L.push({t:'Hémorragie interne : '+c.intBleed.toFixed(1)+' ml/s',sev:c.intBleed>10?4:3});
  const lp=Math.round(c.lossF*100);if(lp>=5)L.push({t:'Sang perdu : '+Math.round(c.bloodMax-c.blood)+' ml ('+lp+' %) – choc '+shockClass(c.lossF),sev:c.lossF>0.3?4:c.lossF>0.15?3:2});
  for(let s=0;s<2;s++)if(c.collapse[s]>0.05)L.push({t:'Pneumothorax '+SFR[SIDES[s]]+(c.seal[s]?' (pansement posé)':" – s'aggrave"),sev:3});
  if(c.tamp)L.push({t:'Tamponnade cardiaque',sev:4});
  if(c.alive&&c.spo2<92)L.push({t:'Hypoxie (SpO₂ '+Math.round(c.spo2)+' %)',sev:c.spo2<80?4:3});
  if(c.alive&&c.headUnder)L.push({t:"Tête sous l'eau – noyade",sev:4});
  if(c.tetra)L.push({t:'Tétraplégie (moelle cervicale C'+Math.min(7,c.cordLvl)+')',sev:4});else if(c.para)L.push({t:'Paraplégie (moelle épinière)',sev:4});
  if(c.concussion>=15)L.push({t:'Commotion cérébrale '+(c.concussion>45?'sévère':c.concussion>28?'modérée':'légère'),sev:c.concussion>45?3:2});
  if(c.ich>5)L.push({t:'Hématome intracrânien en expansion',sev:4});
  if(c.org[ORG.brain]<85)L.push({t:'Lésion cérébrale (fonction '+Math.round(c.org[ORG.brain])+' %)',sev:4});
  const tc=c.temp;if(tc<35)L.push({t:'Hypothermie '+(tc<28?'sévère':tc<32?'modérée':'légère')+' ('+tc.toFixed(1)+' °C)',sev:tc<32?4:3});else if(tc<36.3&&c.alive)L.push({t:'Frissons – se refroidit ('+tc.toFixed(1)+' °C)',sev:1});
  if(tc>39&&c.alive)L.push({t:(tc>40.5?'Coup de chaleur':'Hyperthermie')+' ('+tc.toFixed(1)+' °C)',sev:tc>40.5?4:2});
  if(c.burning>0)L.push({t:'EN FEU !',sev:4});
  if(c.tbsa>=1)L.push({t:'Brûlures graves : '+c.tbsa.toFixed(0)+' % de la surface du corps',sev:c.tbsa>20?4:c.tbsa>9?3:2});
  const fr=[];for(let i=0;i<BONES.length;i++)if(c.boneSt[i]>=2)fr.push(i);
  if(fr.length)L.push({t:'Fractures : '+fr.length+' ('+fr.slice(0,3).map(i=>BONES[i].name).join(', ')+(fr.length>3?'…':'')+')',sev:3});
  for(const lm in c.tq)if(c.tq[lm])L.push({t:'Garrot '+LIMB_NAMES[lm]+' depuis '+Math.round(GT-c.tq[lm])+' s',sev:2});
  if(c.alive&&c.painEff>30)L.push({t:'Douleur '+(c.painEff>80?'insupportable':c.painEff>55?'intense':'modérée')+' ('+Math.round(c.painEff)+' %)',sev:c.painEff>80?3:2});
  if(c.morph>0.2)L.push({t:'Sous morphine ('+c.morphTotal+' dose(s))',sev:1});
  if(c.tasedT>0)L.push({t:'Neutralisé par taser',sev:2});
  if(c.alive&&(c.support<0.33||Math.min(c.legFn[0],c.legFn[1])<0.1))L.push({t:'Ne peut pas marcher (jambes D '+Math.round(c.legFn[0]*100)+' %, G '+Math.round(c.legFn[1]*100)+' %)',sev:3});else if(c.alive&&c.conscious&&!c.canStand)L.push({t:'Ne peut pas tenir debout',sev:3});else if(c.alive&&c.support<0.8)L.push({t:'Boite (jambes à '+Math.round(c.support*100)+' %)',sev:2});
  if(c.alive&&(c.armFn[0]<0.6||c.armFn[1]<0.6))L.push({t:'Bras affaiblis (D '+Math.round(c.armFn[0]*100)+' %, G '+Math.round(c.armFn[1]*100)+' %)',sev:2});
  for(const o of ORGANS)if(o.nerve&&c.org[o.id]<70)L.push({t:o.name+(c.org[o.id]<40?' sectionné':' lésé')+' → '+o.role+' '+(c.org[o.id]<40?'impossible':'affaibli'),sev:c.org[o.id]<40?3:2});
  for(const m of MUSCLES)if(isLig(m.key)&&c.mus[m.id]<75)L.push({t:muscleStatus(c.mus[m.id],m.key)[0]+' : '+m.name,sev:c.mus[m.id]<45?3:2});
  if(c.wet>0.5)L.push({t:'Vêtements mouillés',sev:1});
  if(!L.length)L.push({t:'Aucune blessure',sev:0});
  return L;
}

/* ---------------- survival (real trauma scores) ----------------
   ISS / AIS-like regional severity, RTS (Champion 1989) and TRISS
   (MTOS coefficients), revised Baux score for burns.            */
function aisReport(c){
  const R={head:0,face:0,chest:0,abdo:0,extr:0,ext:0};const up=(r,v)=>{if(v>R[r])R[r]=v;};
  const o=k=>c.org[ORG[k]],bs=k=>c.boneSt[BONE_IDX[k]];
  const br=o('brain');if(br<98)up('head',br<5?6:br<30?5:br<60?4:br<85?3:2);if(o('brainstem')<60)up('head',6);
  if(c.concussion>=15)up('head',c.concussion>45?3:2);if(c.ich>5)up('head',c.ich>30?5:4);
  for(const k of ['frontal','parietalR','parietalL','temporalR','temporalL','occipital','sphenoid','ethmoid'])if(bs(k)>=2)up('head',bs(k)>=3?4:3);
  for(let i=1;i<=7;i++)if(bs('C'+i)>=2)up('head',3);
  const cc=1-o('cordC')/100;if(cc>0.55)up('head',c.cordLvl<=3?6:5);else if(cc>0.1)up('head',4);
  for(const s of SIDES){if(c.cut[ORG['carotid'+s]])up('head',4);if(c.cut[ORG['jugular'+s]])up('head',3);}
  if(o('trachea')<70)up('head',o('trachea')<40?4:3);if(c.inhal>0.2)up('head',c.inhal>0.6?4:3);
  for(const b of BONES)if(b.group==='Face'&&c.boneSt[b.id]>=2)up('face',(b.key==='mandible'||b.key.startsWith('maxilla'))?3:2);
  for(const s of SIDES){if(o('eye'+s)<70)up('face',o('eye'+s)<30?3:2);if(o('innerEar'+s)<70)up('face',2);}
  let ribs=0;for(const s of SIDES)for(let i=1;i<=12;i++)if(bs('rib'+s+i)>=2)ribs++;if(ribs)up('chest',ribs>=5?4:ribs>=3?3:2);if(bs('sternum')>=2)up('chest',2);
  for(let s=0;s<2;s++){const L=o('lung'+SIDES[s]);if(c.collapse[s]>0.05||c.pneumo[s])up('chest',3);if(L<85)up('chest',L<30?5:L<60?4:3);}
  if(c.lungWater>100)up('chest',c.lungWater>800?5:c.lungWater>300?4:3);
  if(o('heart')<95)up('chest',c.tamp?5:o('heart')<50?6:4);if(c.cut[ORG.aorta])up('chest',c.cut[ORG.aorta]===2?6:5);
  for(const s of SIDES)if(c.cut[ORG['subclavian'+s]])up('chest',4);
  if(1-o('cordT')/100>0.55)up('chest',5);for(let i=1;i<=12;i++)if(bs('T'+i)>=2)up('chest',3);
  if(c.gasDose>1)up('chest',c.gasDose>6?5:c.gasDose>3?4:3);
  for(const [k,b] of [['liver',3],['spleen',3],['kidneyR',2],['kidneyL',2],['pancreas',3],['stomach',3],['smallInt',3],['colon',3],['bladder',2]]){const v=o(k);if(v<95)up('abdo',v<10?5:v<40?b+1:b);}
  if(c.cut[ORG.venaCava])up('abdo',5);for(const s of SIDES)if(c.cut[ORG['iliac'+s]])up('abdo',4);
  if(1-o('cordL')/100>0.6)up('abdo',4);for(let i=1;i<=5;i++)if(bs('L'+i)>=2)up('abdo',3);
  for(const s of SIDES){if(bs('femur'+s)>=2)up('extr',3);if(bs('hip'+s)>=2)up('extr',c.lossF>0.3?5:4);
    for(const k of ['tibia','humerus'])if(bs(k+s)>=2)up('extr',bs(k+s)>=3?3:2);
    for(const k of ['radius','ulna','fibula','patella','clavicle','scapula','calcaneus','talus'])if(bs(k+s)>=2)up('extr',2);
    if(c.cut[ORG['femoral'+s]])up('extr',c.lossF>0.2?4:3);for(const k of ['brachial','popliteal','radialA'])if(c.cut[ORG[k+s]])up('extr',3);
    for(const k of ['sciatic','femoralN','peronealN','radialN','medianN','ulnarN'])if(o(k+s)<40)up('extr',2);
    for(const k of ['acl','pcl','mcl','lcl','meniscus','ankleLig','rotCuff','wristLig','achilles'])if(c.mus[MUS_IDX[k+s]]<45)up('extr',2);}
  if(bs('sacrum')>=2)up('extr',3);
  for(const b of BONES)if(b.sub&&b.sub!=='carpal_'&&c.boneSt[b.id]>=2)up('extr',b.sub==='phalanx'?1:2);
  const tb=c.tbsa||burnTBSA(c);if(tb>0)up('ext',tb>=90?6:tb>=30?5:tb>=20?4:tb>=10?3:2);else if(REG_KEYS.some(r=>c.burn[r].deg>0))up('ext',1);
  if(c.wounds.length)up('ext',1);for(const w of c.wounds)if(w.cur>6){const r=w.reg;up(r==='head'||r==='neck'?'head':r==='thorax'?'chest':r==='abdomen'||r==='pelvis'?'abdo':'extr',w.cur>20?4:3);}
  if(c.lossF>0.15){const k=Object.keys(R).reduce((a,b)=>R[a]>=R[b]?a:b);up(k,c.lossF>0.3?4:3);}if(c.temp<35)up('ext',c.temp<28?4:c.temp<32?3:2);if(c.elec)up('ext',3);
  const vals=Object.values(R);let iss;if(vals.includes(6))iss=75;else iss=vals.slice().sort((a,b)=>b-a).slice(0,3).reduce((t,v)=>t+v*v,0);
  const pen=c.wounds.some(w=>/balle|arme blanche|Lacération profonde|sortie/.test(w.type));
  return{R,iss,pen};
}
function rtsScore(g,sbp,rr){const G=g>=13?4:g>=9?3:g>=6?2:g>=4?1:0,S=sbp>89?4:sbp>=76?3:sbp>=50?2:sbp>=1?1:0,Rr=(rr>=10&&rr<=29)?4:rr>29?3:rr>=6?2:rr>=1?1:0;return 0.9368*G+0.7326*S+0.2908*Rr;}
function survival(c){
  if(!c.alive)return{ps:0,iss:75,rts:0,R:null,pen:false,baux:0};
  const A=aisReport(c);const rts=rtsScore(c.gcs,c.sbp,c.rr);const ai=c.age>=55?1:0;
  const b=A.pen?(-2.5355+0.9934*rts-0.0651*A.iss-1.1360*ai):(-0.4499+0.8085*rts-0.0835*A.iss-1.7430*ai);
  let ps=1/(1+Math.exp(-b));
  const tb=c.tbsa||0;const baux=tb>0?Math.round(c.age+tb+(c.inhal>0.2?17:0)):0;if(tb>0)ps*=1-1/(1+Math.exp(-(-7.6+0.062*baux)));
  if(c.arrest)ps=Math.min(ps,c.cprN?0.08:0.03);
  return{ps,iss:A.iss,rts,R:A.R,pen:A.pen,baux};
}
function prognosis(c){
  if(!c.alive)return{lvl:5,txt:'Décédé – '+c.cause,t:0};
  if(c.arrest)return{lvl:4,txt:'Arrêt cardiaque : mort dans ~'+fmtT(10-c.arrestT)+' sans massage cardiaque / DAE',t:10-c.arrestT};
  const R=bloodReport(c);let best=null;
  const cand=(t,txt)=>{if(t!==null&&isFinite(t)&&(!best||t<best.t))best={t,txt};};
  if(R.toDeath!==null&&R.toDeath<1800)cand(R.toDeath,'Mort par hémorragie dans ~'+fmtT(R.toDeath)+' sans soins');
  if(c.spo2<75||c.oxy<0.35)cand(Math.max(5,(c.spo2-45)/1.2+6-c.hypoxT),"Manque d'oxygène : mort dans ~"+fmtT(Math.max(5,(c.spo2-45)/1.2+6-c.hypoxT)));
  if(c.headUnder)cand(Math.max(5,45-c.breathHold),'Se noie : sortez-lui la tête de l\'eau !');
  if(c.ich>10)cand(Math.max(20,(c.org[ORG.brain]-10)/Math.max(0.05,(c.ich-35)*0.015)),'Hématome cérébral : coma puis mort sans chirurgie');
  if(c.temp<30)cand(Math.max(20,(c.temp-24)/0.004),'Hypothermie sévère : arrêt cardiaque possible');
  if(c.burning>0)cand(30,'Brûle vif !');
  const S=survival(c);
  if(best&&best.t<300)return{lvl:4,txt:best.txt,t:best.t};
  if(best)return{lvl:3,txt:best.txt,t:best.t};
  if(c.temp<32)return{lvl:3,txt:'Hypothermie '+(c.temp<28?'sévère':'modérée')+' ('+c.temp.toFixed(1)+' °C) : réchauffer vite',t:null};
  if(c.temp>40.5)return{lvl:3,txt:'Coup de chaleur ('+c.temp.toFixed(1)+' °C) : refroidir vite',t:null};
  if(S.ps<0.5)return{lvl:3,txt:'Blessures graves (ISS '+S.iss+')',t:null};
  if(c.temp<35)return{lvl:2,txt:'Hypothermie légère ('+c.temp.toFixed(1)+' °C) : le mettre au sec et au chaud',t:null};
  if(S.iss>=9||c.painEff>60)return{lvl:2,txt:'Blessé, a besoin de soins',t:null};
  if(S.iss>0||c.wounds.length)return{lvl:1,txt:'Blessures légères',t:null};
  return{lvl:0,txt:'En bonne santé',t:null};
}
function noCare(c,pr,ps){if(!c.alive)return 0;if(pr.t===null||pr.t===undefined)return ps;const t=pr.t;return Math.min(ps,t<60?0.01:t<180?0.04:t<400?0.12:t<900?0.3:0.6);}
const LVL_TXT=['🟢 BONNE SANTÉ','🟡 BLESSÉ LÉGER','🟠 BLESSÉ','🔴 GRAVE','🚨 CRITIQUE – VA MOURIR','⚫ DÉCÉDÉ'];
const LVL_COL=['#7fd87f','#f5d742','#ffa53a','#ff5a3a','#ff2050','#999'];
function firstAid(c){const A=[];if(!c.alive)return A;
  if(c.arrest)A.push('🫀 Massage cardiaque (RCP) tout de suite + défibrillateur ⚡');
  if(c.burning>0)A.push('💧 Éteindre le feu (eau) ou le faire rouler au sol');
  if(c.headUnder)A.push("🌊 Lui sortir la tête de l'eau !");
  const limbs={};for(const w of c.wounds)if(w.art>0.3&&w.cur>0.03&&w.limb&&!c.tq[w.limb])limbs[w.limb]=1;for(const l in limbs)A.push('🎗️ Garrot sur le '+LIMB_NAMES[l]+' (artère coupée)');
  if(c.wounds.some(w=>w.art>0.3&&w.cur>0.03&&!w.limb))A.push('🩹 Comprimer fort la plaie qui saigne en jets (cou / épaule / tronc)');
  if(c.wounds.some(w=>!w.bandaged&&w.ven>0.4))A.push('🩹 Pansement compressif sur les plaies');
  for(let s=0;s<2;s++)if(c.pneumo[s]&&!c.seal[s]){A.push('🫁 Pansement thoracique (plaie qui souffle)');break;}
  if(c.spo2<92||c.lungWater>50||c.gasDose>0.5)A.push('🫧 Oxygène');
  if(!c.conscious&&!c.arrest&&!c.pls)A.push('🛌 Position latérale de sécurité');
  const fr=['femur','tibia','humerus','radius','ulna'].some(b=>SIDES.some(s=>c.boneSt[BONE_IDX[b+s]]>=2&&!c.splint[BONE_IDX[b+s]]));if(fr)A.push('🦴 Attelle sur la fracture');
  if(c.temp<35.5||(c.wet>0.5&&SET.temp<12))A.push('🟨 Couverture de survie, le mettre au sec');
  if(c.temp>39.5)A.push("💧 Le refroidir avec de l'eau, à l'ombre");
  if(c.tbsa>0&&c.burning<=0)A.push("💧 Refroidir les brûlures à l'eau tiède (pas de glace)");
  if(c.painEff>60&&c.morph<2)A.push('💉 Antidouleur (morphine)');
  if(c.intBleed>2||survival(c).iss>15||c.ich>3)A.push("🚑 Hôpital et chirurgie en urgence");
  return A;}
function plainProblems(c){const L=[];
  for(const w of c.wounds)if(w.art>0.3&&w.cur>0.03)L.push('🩸 Saigne en jets : '+ORGANS[ORG[w.artKey]].name.toLowerCase()+' coupée ('+w.cur.toFixed(0)+' ml/s)');
  if(c.intBleed>1)L.push('🩸 Saigne à l\'intérieur ('+c.intBleed.toFixed(0)+' ml/s) : '+Object.keys(c.intB).filter(k=>{const b=c.intB[k];return!(b.cap&&b.lost>=b.cap);}).map(k=>c.intB[k].name).join(', '));
  if(c.extBleed>0.5&&!c.wounds.some(w=>w.art>0.3&&w.cur>0.03))L.push('🩸 Saigne ('+c.extBleed.toFixed(1)+' ml/s)');
  if(c.lossF>0.1)L.push('💧 A perdu '+(Math.round(c.bloodMax-c.blood)/1000).toFixed(2)+' L de sang sur '+(c.bloodMax/1000).toFixed(1)+' L ('+Math.round(c.lossF*100)+' %)');
  if(c.amp)for(const r in c.amp){const a=ampSeg(r);if(a&&!c.amp[(a.seg==='larm'?'uarm':a.seg==='shin'?'thigh':a.seg==='hand'?'larm':a.seg==='foot'?'shin':'_')+a.S])L.unshift('✂️ Amputé : '+AMP[a.seg].n+' '+(a.S==='R'?'droit':'gauche'));}
  if(c.lungWater>30)L.push('🌊 Eau dans les poumons : ~'+Math.round(c.lungWater/2)+' ml (noyade)');
  if(c.gasDose>0.5)L.push('☠️ A respiré un gaz toxique : poumons brûlés');
  if(c.inhal>0.2)L.push('🔥 Voies respiratoires brûlées (fumée, flammes)');
  for(let s=0;s<2;s++)if(c.collapse[s]>0.05)L.push('🫁 Poumon '+SFR[SIDES[s]]+' affaissé à '+Math.round(c.collapse[s]*100)+' %');
  if(c.tamp)L.push('❤️ Sang autour du cœur (tamponnade)');
  const brn=REG_KEYS.filter(r=>c.burn[r].deg>0);if(brn.length)L.push('🔥 Brûlé à '+Math.round(c.tbsa)+' % : '+brn.map(r=>REGIONS[r].n+' ('+c.burn[r].deg+'e°)').join(', '));
  if(c.elec)L.push('⚡ Foudroyé / électrocuté');
  if(c.tetra)L.push('♿ Ne peut plus bouger bras et jambes (moelle du cou)');else if(c.para)L.push('♿ Ne peut plus bouger les jambes (moelle épinière)');
  const fr=[];for(let i=0;i<BONES.length;i++)if(c.boneSt[i]>=2&&!(c.amp&&c.amp[BONES[i].region]))fr.push(BONES[i].name);if(fr.length)L.push('🦴 '+fr.length+' os cassé(s) : '+fr.slice(0,5).join(', ')+(fr.length>5?'…':''));
  const lig=MUSCLES.filter(m=>isLig(m.key)&&c.mus[m.id]<75);if(lig.length)L.push('🦵 Ligaments : '+lig.map(m=>m.name+' ('+muscleStatus(c.mus[m.id],m.key)[0].toLowerCase()+')').join(', '));
  const nv=ORGANS.filter(o=>o.nerve&&c.org[o.id]<70);if(nv.length)L.push('⚡ Nerfs touchés : '+nv.map(o=>o.name+' → '+o.role).join(' ; '));
  const ms=MUSCLES.filter(m=>!isLig(m.key)&&c.mus[m.id]<60);if(ms.length)L.push('💪 Muscles déchirés : '+ms.slice(0,4).map(m=>m.name).join(', ')+(ms.length>4?'…':''));
  if(c.concussion>=15)L.push('🧠 Commotion cérébrale ('+(c.concussion>45?'sévère':'modérée')+')');if(c.ich>5)L.push('🧠 Hématome dans le crâne');if(c.org[ORG.brain]<85)L.push('🧠 Cerveau blessé ('+Math.round(c.org[ORG.brain])+' %)');
  const tc=c.temp;if(tc<35)L.push('❄️ Hypothermie '+(tc<28?'sévère (inconscient, cœur fragile)':tc<32?'modérée (confus, ne frissonne plus)':'légère (frissons, maladroit)')+' : '+tc.toFixed(1)+' °C');else if(tc>39)L.push('🥵 '+(tc>40.5?'Coup de chaleur':'Hyperthermie')+' : '+tc.toFixed(1)+' °C');
  if(c.painEff>40)L.push('😣 Douleur '+Math.round(c.painEff)+' %');
  return L;}
/* ---------------- speech ---------------- */
const SAY={
  burn:['AU SECOURS ! JE BRÛLE !','Aaaah ! Le feu ! Éteignez-moi !'],drown:['Au secours ! Je me noie !','À l\'aide… *glou*'],
  gas:['*tousse* Ça brûle ! Mes yeux !','Je… n\'arrive plus… à respirer…'],noAir:['Je… n\'arrive… plus… à respirer…','*suffoque*'],
  artery:['Je saigne énormément ! Aidez-moi !','Il y a du sang partout… appelez une ambulance !'],bleed:['Je saigne…','Aïe… ça saigne…'],
  shock:["J'ai froid… tout tourne…","Je… vais m'évanouir…"],dying:['Je… vais… mourir…','Je ne vois… plus rien…'],
  leg:['Ma jambe ! Je ne peux plus marcher !','Je ne sens plus ma jambe…'],arm:['Mon bras ! Je ne peux plus le bouger !'],
  para:['Je ne sens plus mes jambes !'],tetra:['Je ne peux plus bouger… rien…'],head:['Où… où suis-je ?','Ma tête… tout tourne…'],
  cold:["J'ai… tellement froid…",'*claque des dents*'],hot:["Il fait trop chaud… j'ai la tête qui tourne…"],
  fear:['Au secours !','Fuyez ! Vite !','Appelez les secours !','Aidez-moi !'],armed:['Il a une arme ! Fuyez !','Ne tirez pas !','Appelez la police !'],hurt:['Aïe !','Ça fait mal !','Ahh !'],
  thanks:['Merci… merci…','Merci, vous m\'avez sauvé…'],angry:['Tu vas me le payer !','Tu me cherches ?!','Je vais me défendre !','Tu veux te battre ? Viens !'],hostile:['Tu vas le regretter !','Il est là !','Encerclez-le !'],
};
function say(c,key,force){if(!c.alive||!c.conscious||(c.sayT>0&&!force))return;const L=SAY[key];if(!L)return;const t=pick(L);c.sayT=rnd(4,8);c.lastSay=t;
  if(c.isPlayer){addFeed('Vous : « '+t+' »',1);return;}if(hdist(c.P[c.head],camera.position)<40)speechAt(c,t);}
function speakTick(c){
  if(!c.alive||!c.conscious||c.sayT>0)return;
  let k=null;
  if(c.burning>0)k='burn';else if(c.headUnder||(c.inWater&&c.lungWater>20))k='drown';else if(c.gasExp>0||(c.gasDose>0.5&&c.spo2<92))k='gas';
  else if(c.lossF>0.32)k='dying';else if(c.spo2<85)k='noAir';else if(c.wounds.some(w=>w.art>0.3&&w.cur>0.03))k='artery';
  else if(c.lossF>0.2)k='shock';else if(c.tetra)k='tetra';else if(c.para)k='para';else if(c.legFn[0]<0.3||c.legFn[1]<0.3)k='leg';
  else if(c.armFn[0]<0.3||c.armFn[1]<0.3)k='arm';else if(c.dizzy>30)k='head';else if(c.temp<35)k='cold';else if(c.temp>39.5)k='hot';
  else if(c.extBleed>1)k='bleed';else if(c.team===2&&c.ai&&c.ai.state==='flee')k='fear';
  if(k&&Math.random()<0.5)say(c,k);else c.sayT=rnd(2,5);
}

/* ---------------- hit zones : the exact anatomical spot that was struck ----------------
   Same blow, different place, different injury : liver shot, solar plexus, jaw, temple, throat, knee… */
function hitZone(c,reg,point){
  const SD=s=>s>0?'D':'G',SK=s=>s>0?'R':'L',DG=S=>S==='R'?'D':'G';
  if(reg==='thorax'||reg==='abdomen'||reg==='pelvis'){const l=locF(frameTorso(c),point);const front=l.z>-0.02,ax=Math.abs(l.x),sd=SD(l.x),sk=SK(l.x);
    if(l.y>0.33){if(!front)return{k:'back',n:'Haut du dos'};if(ax<0.05)return{k:'sternum',n:'Sternum (devant le cœur)'};return{k:'ribs',n:'Côtes '+sd,s:sk};}
    if(l.y>0.17){if(!front)return ax>0.03?{k:'kidney',n:'Rein '+sd+' (bas du dos)',s:sk}:{k:'spine',n:'Colonne (dos)'};
      if(ax<0.035)return{k:'plexus',n:'Plexus solaire'};return l.x>0?{k:'liver',n:'Foie (côté droit)'}:{k:'spleen',n:'Rate / estomac (côté gauche)'};}
    if(l.y>0.02)return front?{k:'belly',n:'Ventre (intestins)'}:{k:'lowback',n:'Bas du dos (lombaires)'};
    if(front&&l.y<-0.06&&ax<0.07)return{k:'groin',n:'Entrejambe'};
    return front?{k:'lowbelly',n:'Bas-ventre (vessie)'}:{k:'glute',n:'Bassin / fessier'};}
  if(reg==='head'){const F=frameNeck(c);F.o=c.P[c.head];const l=locF(F,point),ax=Math.abs(l.x),sd=SD(l.x),sk=SK(l.x);
    if(l.z<-0.04&&l.y<0.03)return{k:'nape',n:'Base du crâne (nuque)'};if(l.y>0.07)return{k:'crown',n:'Sommet du crâne'};
    if(l.z>0.02){if(l.y<-0.035)return{k:'jaw',n:'Mâchoire / menton'};if(ax<0.025&&l.y<0.03)return{k:'nose',n:'Nez'};if(ax<0.065&&l.y<0.055)return{k:'eye',n:'Œil '+sd,s:sk};return{k:'forehead',n:'Front'};}
    if(ax>0.06)return{k:'temple',n:'Tempe '+sd,s:sk};return{k:'skull',n:'Crâne'};}
  if(reg==='neck'){const F=frameNeck(c);const l=locF(F,point),sd=SD(l.x),sk=SK(l.x);if(l.z>0.02&&Math.abs(l.x)<0.03)return{k:'throat',n:'Gorge (trachée)'};if(l.z<-0.02)return{k:'nape',n:'Nuque (vertèbres)'};return{k:'carotid',n:'Cou côté '+sd+' (carotide)',s:sk};}
  const S=reg.slice(-1);const R=REGIONS[reg];const vol=volumeFor(c,reg),l=vol.local(point);
  if(reg.startsWith('thigh')&&l.tr>0.85||reg.startsWith('shin')&&l.tr<0.12)return{k:'knee',n:'Genou '+DG(S),s:S,side:Math.abs(l.lat)>Math.abs(l.fr)};
  if(reg.startsWith('uarm')&&l.tr>0.85||reg.startsWith('larm')&&l.tr<0.12)return{k:'elbow',n:'Coude '+DG(S),s:S};
  if(reg.startsWith('shin')&&l.tr>0.85)return{k:'ankle',n:'Cheville '+DG(S),s:S};
  return{k:'limb',n:R?R.n:reg,s:S};
}
function hitVerb(w){return w.id==='knuckles'?'🥊 Poing américain':w.id==='chainsaw'?'🪚 Tronçonneuse':w.id==='crossbow'?'🏹 Carreau d\'arbalète':w.id==='revolver'?'🔫 Balle de .357':w.id==='uzi'?'🔫 Rafale d\'Uzi':w.id==='machete'?'🔪 Coup de machette':w.id==='axe'?'🪓 Coup de hache':w.id==='hammer'?'🔨 Coup de marteau':w.id==='crowbar'?'🔧 Coup de pied-de-biche':w.id==='fists'?'👊 Coup de poing':w.id==='bat'?'🏏 Coup de batte':w.id==='knife'?'🔪 Coup de couteau':w.id==='katana'?'🗡️ Coup de sabre':w.id==='brick'?'🧱 Brique':w.id==='frag'?'💥 Éclat':w.kind==='taser'?'⚡ Taser':w.kind==='bullet'?(w.pellets>1?'💥 Plombs':'🔫 Balle'):'💢 Choc';}
function bluntZone(c,z,d,inj,point){
  const B=(k,m)=>{if(BONE_IDX[k]!==undefined)boneDamage(c,BONE_IDX[k],d*m,false,inj);},O=(k,m,kind)=>organDamage(c,ORG[k],d*m,kind||'blunt',inj),Mu=(k,m)=>muscleDamage(c,MUS_IDX[k],d*m,inj);
  const st=t=>{c.stun=Math.max(c.stun,t);};
  switch(z.k){
    case'plexus':c.windT=Math.max(c.windT||0,2+d/8);st(1+d/25);c.painInj+=d*0.6;inj.push({t:'Souffle coupé (plexus solaire) – plié en deux',sev:2});O('stomach',0.25);break;
    case'liver':O('liver',0.9);c.painInj+=d*1.1;if(d>14){st(2+d/18);inj.push({t:'Coup au foie : s\'effondre de douleur',sev:3});}break;
    case'spleen':O('spleen',0.85);O('stomach',0.4);if(d>14)inj.push({t:'Nausées, envie de vomir',sev:1});break;
    case'kidney':O('kidney'+z.s,0.9);c.painInj+=d*0.9;if(d>12)inj.push({t:'Rein '+SFR[z.s]+' contus : sang dans les urines',sev:2});break;
    case'sternum':B('sternum',0.8);if(d>22&&Math.random()<0.04&&c.alive){c.arrest=true;c.arrestT=0;c.cause='Commotio cordis (coup sur le cœur)';c.conscious=false;inj.push({t:'Commotio cordis : le cœur s\'arrête ! (RCP + DAE)',sev:4});}else st(0.6);break;
    case'ribs':for(let i=0;i<(d>25?2:1);i++)B('rib'+z.s+rndi(5,10),0.9);c.painInj+=d*0.5;break;
    case'groin':c.painInj+=d*2.2;st(2.5+d/15);inj.push({t:'Coup à l\'entrejambe : douleur insupportable',sev:2});break;
    case'lowbelly':O('bladder',0.7);break;
    case'belly':O('smallInt',0.5);O('colon',0.35);c.windT=Math.max(c.windT||0,d/12);break;
    case'lowback':case'spine':B('L'+rndi(1,5),0.5);c.painInj+=d*0.5;break;
    case'jaw':B('mandible',0.9);c.concussion+=d*0.9;if(d>10&&Math.random()<0.3)inj.push({t:'Dent cassée',sev:1});break;
    case'nose':B('nasal'+pick(SIDES),1.2);c.wounds.push(mkWound(c,'head',point,'Saignement de nez',rnd(0.3,0.7)));inj.push({t:'Nez qui saigne – les yeux pleurent',sev:1});st(0.5);break;
    case'eye':O('eye'+z.s,0.8);B('zygomatic'+z.s,0.7);inj.push({t:'Œil '+SFR[z.s]+' touché : vision trouble, œil au beurre noir',sev:2});break;
    case'temple':B('temporal'+z.s,1.4);B('sphenoid',0.5);c.concussion+=d*0.6;if(d>24){c.ichRate=(c.ichRate||0)+0.35;inj.push({t:'Tempe : risque d\'hématome extradural (artère méningée)',sev:3});}break;
    case'nape':B('C1',0.6);B('C2',0.6);B('occipital',0.8);O('brainstem',0.15);c.concussion+=d*0.5;break;
    case'throat':O('trachea',0.9);c.windT=Math.max(c.windT||0,3+d/6);inj.push({t:'Coup à la gorge : trachée écrasée, respire mal',sev:3});break;
    case'carotid':c.concussion+=d*0.3;if(d>18&&Math.random()<0.3){c.koT=Math.max(c.koT,2+d/15);inj.push({t:'Choc sur la carotide : évanouissement',sev:2});}break;
    case'knee':if(z.side){Mu('mcl'+z.s,1.3);Mu('acl'+z.s,0.6);}else{B('patella'+z.s,1.1);Mu('meniscus'+z.s,0.7);}c.painInj+=d*0.8;break;
    case'elbow':O('ulnarN'+z.s,0.4);c.painInj+=d*0.6;inj.push({t:'Coup au coude : décharge électrique dans le bras (nerf ulnaire)',sev:1});break;
    case'ankle':Mu('ankleLig'+z.s,1.1);B('fibula'+z.s,0.6);break;
  }
}
