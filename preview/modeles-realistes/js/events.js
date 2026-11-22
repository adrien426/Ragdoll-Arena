"use strict";
/* =====================================================================
   EVENTS : disasters, vehicles, explosions, sandbox tools
   ===================================================================== */
let TIME_SCALE=1,SHAKE=0,QUAKE=0,FLASH=0;
const FLOOD={level:-1e9,target:-1e9,t:0,mesh:null,flow:{x:1,z:0}};
const TORNADOS=[],GASES=[],VEHICLES=[],METEORS=[],DEBRIS=[],SCORCH=[];
const WAVE={kind:null,t:0,prevTemp:null,prevRain:null};

// flood raises the water level everywhere it is higher than the map's own water
const _baseWater=waterLevel;
waterLevel=function(x,z){const b=_baseWater(x,z);return FLOOD.level>b?FLOOD.level:b;};

function evNear(p,r){const out=[];for(const c of chars){const q=c.P[c.chest];if(vlen(sub(q,p))<r)out.push(c);}return out;}
function losClear(a,b){const d=sub(b,a),L=vlen(d);if(L<0.2)return true;const n=mul(d,1/L);const m=lerp3(a,b,0.5);
  for(const bx of boxesNear(m.x,m.z,L/2+1.5)){const t=rayBox(a,n,bx);if(t!==null&&t>0.05&&t<L-0.25)return false;}return true;}
function pushChar(c,v,spread){for(const p of c.P){const s=spread?rnd(1-spread,1+spread):1;p.ox-=v.x*s;p.oy-=v.y*s;p.oz-=v.z*s;}wake(c);}
function gridInsertLast(){const b=boxes[boxes.length-1];const ix0=Math.floor(b.min.x/GC),ix1=Math.floor(b.max.x/GC),iz0=Math.floor(b.min.z/GC),iz1=Math.floor(b.max.z/GC);
  for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){const k=gkey(ix,iz);let a=GRID.get(k);if(!a){a=[];GRID.set(k,a);}a.push(b);}}
function addScorch(x,y,z,r){const m=new THREE.Mesh(stainGeo,M.scorch);m.rotation.x=-Math.PI/2;m.position.set(x,y+0.03,z);m.scale.set(r,r,1);scene.add(m);SCORCH.push(m);if(SCORCH.length>24)scene.remove(SCORCH.shift());}
M.scorch=std({color:0x0c0a08,roughness:1,transparent:true,opacity:0.85,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,depthWrite:false});
M.meteor=std({color:0x2a1a10,emissive:0xff5a10,emissiveIntensity:1.6,roughness:0.9});
M.funnel=new THREE.MeshBasicMaterial({color:0x4a4640,transparent:true,opacity:0.62,side:THREE.DoubleSide,depthWrite:false,fog:true});M.funnel2=new THREE.MeshBasicMaterial({color:0x35312c,transparent:true,opacity:0.55,side:THREE.DoubleSide,depthWrite:false,fog:true});
M.boltCore=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,fog:false});M.boltGlow=new THREE.MeshBasicMaterial({color:0x9fb8ff,transparent:true,opacity:0.35,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
M.brickP=std({color:0x8e3f2a,roughness:0.95});M.grenade=std({color:0x3a4a2c,roughness:0.6,metalness:0.3});
M.chlorine=null;
const FRAG={kind:'bullet',dmg:16,energy:0.6,imp:0.02,cavity:0.004,id:'frag'};
const CHLORINE=[0.95,1,0.25];

function shakeAt(p,s){const d=vlen(sub(p,camera.position));SHAKE=Math.max(SHAKE,s*clamp(1.2-d/70,0,1));}
function flashAt(p,s){flashLight.position.set(p.x,p.y+1.5,p.z);flashLight.intensity=Math.max(flashLight.intensity,30*s);const d=vlen(sub(p,camera.position));if(losClear(p,camera.position))FLASH=Math.max(FLASH,clamp(s*1.2-d/60,0,1));}

/* ---------------- explosions (primary/secondary/tertiary/quaternary blast injury) ---------------- */
function explode(p,power,src,opts){
  opts=opts||{};const R=7*power;
  sfxAt(p);SFX.big();SFX.big();if(power>1.5)SFX.thud();
  flashAt(p,power);shakeAt(p,power*1.4);addAlarm(p,60);
  for(let i=0;i<40*Math.min(power,2.5);i++){const a=Math.random()*Math.PI*2,r=Math.random()*power*1.4;emitFlame(p.x+Math.cos(a)*r,p.y+rnd(0,power),p.z+Math.sin(a)*r,1.6+power*0.4);}
  for(let i=0;i<28*Math.min(power,3);i++)emitSmoke(p.x+rnd(-1,1)*power,p.y+rnd(0.3,2)*power,p.z+rnd(-1,1)*power,0.1,rnd(4,8),rnd(0.01,0.035),null,0.015);
  for(let i=0;i<30;i++)spawnP(p,{x:rnd(-0.12,0.12)*power,y:rnd(0.05,0.2)*power,z:rnd(-0.12,0.12)*power},Math.random()<0.5?'dust':'spark',rnd(0.02,0.06));
  const gy=groundAt(p.x,p.z,p.y+1);if(p.y-gy<2.5)addScorch(p.x,gy,p.z,clamp(power*1.6,1.2,7));
  if(opts.fire&&waterLevel(p.x,p.z)<gy+0.1)FIRES.push({x:p.x,y:gy+0.05,z:p.z,r:power*1.4,life:25,max:25});
  if(opts.fire&&power>2)for(let i=0;i<4;i++){const a=rnd(0,6.3),r=rnd(power*1.5,power*3);const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,y=groundAt(x,z,p.y+3);if(waterLevel(x,z)<y)FIRES.push({x,y:y+0.05,z,r:rnd(1.2,2.2),life:rnd(15,30),max:30});}
  for(const c of chars.slice()){
    const q=c.P[c.chest];const d=Math.max(0.3,vlen(sub(q,p)));if(d>R*1.7)continue;
    const shield=losClear(add(p,{x:0,y:0.4,z:0}),q)?1:0.22;
    const I=shield*power*4/(1+d*d*0.35);if(I<0.08)continue;
    const inj=[];c.lastHit=src||c.lastHit;wake(c);
    if(c.alive){
      // primary: overpressure
      if(I>0.3)for(const s of SIDES)if(Math.random()<clamp(I*0.6,0,0.95))organDamage(c,ORG['innerEar'+s],I*45,'blunt',inj);
      if(I>0.9){for(const s of SIDES){organDamage(c,ORG['lung'+s],(I-0.7)*38,'blunt',inj);if(I>1.6)addInt(c,'blastLung'+s,(I-1.4)*3,900,'Poumon de souffle '+SFR[s]);}
        if(inj.length)inj.push({t:'Blast pulmonaire (souffle)',sev:3});}
      if(I>1.4){organDamage(c,ORG.smallInt,(I-1.2)*30,'blunt',inj);organDamage(c,ORG.colon,(I-1.2)*25,'blunt',inj);}
      if(I>0.5){c.concussion+=I*22;if(c.concussion>=45&&c.koT<=0){c.koT=3+c.concussion/12;inj.push({t:'K.O. par le souffle',sev:3});}}
      if(I>2.2){c.ichRate+=0.4;organDamage(c,ORG.brain,(I-2)*20,'blunt',inj);}
      if(I>4.2&&!c.isPlayer&&Math.random()<0.7){reportInjuries(c,inj,q);kill(c,"Souffle de l'explosion (corps détruit)");}
      c.painInj+=I*15;c.stun=Math.max(c.stun,1+I*1.5);
    }
    // secondary: fragments
    const nf=Math.min(10,Math.round(power*(opts.frag===false?1:9)*shield/(1+d*d*0.12)));
    for(let k=0;k<nf&&c.alive!==undefined;k++){const hi=rndi(0,c.H.length-1),t=Math.random();const h=c.H[hi];const pt=lerp3(capA(c,h),capB(c,h),t);const dir=norm(sub(pt,p));
      applyHit(c,hi,t,pt,dir,FRAG,src,clamp(1.3/(1+d*0.25),0.2,1.3));}
    // quaternary: thermal
    if(d<R*0.45&&shield>0.5){const th=power*3/(1+d*d*0.4);for(const r of REG_KEYS)if(Math.random()<0.7)burnDose(c,r,th*rnd(0.5,1.2));if(opts.fire||d<R*0.2)ignite(c,'thorax',8);}
    // tertiary: thrown
    const away=norm(add(sub(q,p),{x:0,y:0.8+0.4*Math.random(),z:0}));pushChar(c,mul(away,clamp(I*0.07,0,0.42)),0.25);
    if(inj.length)reportInjuries(c,inj,q);c.dirty=true;computeFunctions(c);
  }
  // nearby projectiles / grenades jump
  for(const g of PROJ){const d=vlen(sub(g.p,p));if(d<R)g.v=add(g.v,mul(norm(sub(g.p,p)),0.2/(1+d)));}
}

/* ---------------- meteorite ---------------- */
function meteorite(t){const a=rnd(0,6.28);const st={x:t.x+Math.cos(a)*70,y:t.y+160,z:t.z+Math.sin(a)*70};
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1.3,1),M.meteor);m.position.set(st.x,st.y,st.z);scene.add(m);
  METEORS.push({p:st,t:{x:t.x,y:t.y,z:t.z},T:2.4,age:0,mesh:m,from:st});showMsg('☄️ Météorite en approche !',2);sfxAt(t);SFX.whoosh();}
function updMeteors(dt){for(let i=METEORS.length-1;i>=0;i--){const m=METEORS[i];m.age+=dt;const k=Math.min(1,m.age/m.T);
  const p=lerp3(m.from,m.t,k*k);m.p=p;m.mesh.position.set(p.x,p.y,p.z);m.mesh.rotation.x+=0.2;m.mesh.rotation.y+=0.13;
  for(let j=0;j<6;j++)emitFlame(p.x+rnd(-1,1),p.y+rnd(-1,1),p.z+rnd(-1,1),2.2);emitSmoke(p.x,p.y,p.z,0.18,rnd(3,5),0.002,null,0.01);
  if(k>=1){scene.remove(m.mesh);METEORS.splice(i,1);explode(m.t,5,null,{fire:true});
    for(let j=0;j<14;j++)throwDebris(add(m.t,{x:0,y:1,z:0}),{x:rnd(-0.25,0.25),y:rnd(0.15,0.4),z:rnd(-0.25,0.25)},'rock');}}}

/* ---------------- thrown / falling objects (bricks, debris, grenades) ---------------- */
const BRICK_GEO=new THREE.BoxGeometry(0.22,0.07,0.105),ROCK_GEO=new THREE.DodecahedronGeometry(0.16,0),GREN_GEO=new THREE.SphereGeometry(0.045,10,8);
function throwDebris(p,v,kind,owner){const mesh=new THREE.Mesh(kind==='rock'?ROCK_GEO:BRICK_GEO,kind==='rock'?M.burnt:M.brickP);mesh.castShadow=true;mesh.position.set(p.x,p.y,p.z);scene.add(mesh);
  PROJ.push({p:{x:p.x,y:p.y,z:p.z},v,owner:owner||null,mesh,life:12,kind:'brick',spin:{x:rnd(-0.3,0.3),z:rnd(-0.3,0.3)}});if(PROJ.length>140){const q=PROJ.shift();scene.remove(q.mesh);}}
function restDebris(q){DEBRIS.push(q.mesh);if(DEBRIS.length>90)scene.remove(DEBRIS.shift());}
// velocity (m/frame) to land on target with a given max throw speed (m/s)
function ballistic(a,b,vmax){let d=sub(b,a);let D=Math.hypot(d.x,d.z);const maxD=vmax*vmax/9.8*0.95;if(D>maxD){const k=maxD/D;d={x:d.x*k,y:d.y,z:d.z*k};D=maxD;}
  const tf=clamp(D/(vmax*0.75),0.25,2.2);const vy=(d.y+0.5*9.8*tf*tf)/tf;return{x:d.x/tf/60,y:vy/60,z:d.z/tf/60};}
// called from combat.js when a throw weapon is released
function releaseThrow(c){const w=WEAPONS[c.weapon];if(w.kind==='fire'){releaseMolotov(c);return;}
  const h=c.P[c.arms[c.useArm].ha];const v=ballistic(h,c.aimP,w.kind==='brick'?16:12);
  if(w.kind==='brick'){throwDebris(h,v,'brick',c);PROJ[PROJ.length-1].dmgK=1;}
  else{const mesh=new THREE.Mesh(GREN_GEO,M.grenade);mesh.castShadow=true;scene.add(mesh);PROJ.push({p:{x:h.x,y:h.y,z:h.z},v,owner:c,mesh,life:3.2,kind:'explosive'});SFX.click();}
  sfxAt(h);SFX.swing();}
function projHitChar(q,a,b){for(const c of chars){if(c===q.owner&&q.age<0.4)continue;const cp=c.P[c.pelvis];if(Math.abs(cp.x-b.x)>1.6||Math.abs(cp.z-b.z)>1.6)continue;
  for(let s=0;s<=2;s++){const pt=lerp3(a,b,s/2);const h=nearestHitCap(c,pt);if(h&&h.d<0.06)return{c,h,pt};}}return null;}
function updThrown(q,dt,i){
  q.age=(q.age||0)+dt;q.v.y-=G;const np=add(q.p,q.v);const spd=vlen(q.v)*60;
  if(q.kind==='brick'){
    if(spd>3){const hit=projHitChar(q,q.p,np);if(hit){const dir=norm(q.v);applyHit(hit.c,hit.h.hi,hit.h.t,hit.pt,dir,{kind:'blunt',dmg:(4+spd*1.7)*(q.dmgK||1),imp:clamp(spd*0.0025,0.005,0.06),id:'brick'},q.owner);
      q.v=mul(q.v,-0.15);sfxAt(np);SFX.blunt();}}
    const gy=groundAt(np.x,np.z,np.y+0.3);
    if(np.y<=gy+0.04||insideBox(np.x,np.y,np.z,0)){if(insideBox(np.x,np.y,np.z,0)){q.v.x*=-0.3;q.v.z*=-0.3;}
      if(spd>2.5){q.v.y=Math.abs(q.v.y)*0.28;q.v.x*=0.5;q.v.z*=0.5;np.y=Math.max(np.y,gy+0.04);if(spd>6){sfxAt(np);SFX.thud();for(let k=0;k<3;k++)spawnP(np,{x:rnd(-0.01,0.01),y:rnd(0.01,0.03),z:rnd(-0.01,0.01)},'dust');}}
      else{np.y=gy+0.035;q.p=np;q.mesh.position.set(np.x,np.y,np.z);q.mesh.rotation.x=0;q.mesh.rotation.z=0;restDebris(q);PROJ.splice(i,1);return;}}
    if(waterLevel(np.x,np.z)>np.y){q.v=mul(q.v,0.85);}
    q.p=np;q.mesh.position.set(np.x,np.y,np.z);q.mesh.rotation.x+=q.spin.x;q.mesh.rotation.z+=q.spin.z;
    q.life-=dt;if(q.life<=0){scene.remove(q.mesh);PROJ.splice(i,1);}return;}
  // grenade: bounce then explode on fuse
  const gy=groundAt(np.x,np.z,np.y+0.3);
  if(np.y<=gy+0.045){np.y=gy+0.045;q.v.y=Math.abs(q.v.y)*0.3;q.v.x*=0.6;q.v.z*=0.6;if(spd>2){sfxAt(np);SFX.click();}}
  if(insideBox(np.x,np.y,np.z,0)){q.v.x*=-0.4;q.v.z*=-0.4;np.x=q.p.x;np.z=q.p.z;}
  q.p=np;q.mesh.position.set(np.x,np.y,np.z);q.life-=dt;
  if(q.life<=0){scene.remove(q.mesh);PROJ.splice(i,1);explode(np,1.0,q.owner,{});}
}

/* ---------------- vehicles ---------------- */
function buildCarMesh(paint){const g=new THREE.Group();const m=CAR_PAINT[paint%CAR_PAINT.length];
  const ad=(geo,mat,x,y,z)=>{const me=new THREE.Mesh(geo,mat);me.position.set(x,y,z);me.castShadow=true;g.add(me);return me;};
  ad(new THREE.BoxGeometry(4.3,0.72,1.8),m,0,0.62,0);ad(new THREE.BoxGeometry(2.2,0.6,1.62),m,-0.25,1.27,0);
  ad(new THREE.BoxGeometry(2.05,0.5,1.66),M.glass,-0.25,1.25,0);ad(new THREE.BoxGeometry(0.06,0.16,1.4),M.lampHead,2.16,0.72,0);
  for(const [x,z] of [[1.35,0.86],[1.35,-0.86],[-1.35,0.86],[-1.35,-0.86]]){const w=ad(new THREE.CylinderGeometry(0.34,0.34,0.24,14),M.tire,x,0.34,z);w.rotation.x=Math.PI/2;}
  return g;}
function spawnVehicle(t,speedKmh){
  // drive a car straight through the target from 45 m away (along the clearest direction)
  let best=null;for(let k=0;k<10;k++){const a=k/10*Math.PI*2+rnd(0,0.3);const dir={x:Math.cos(a),y:0,z:Math.sin(a)};const st=sub(t,mul(dir,40));
    {const pp=player.P[player.pelvis];const rel=sub(pp,st);const along=rel.x*dir.x+rel.z*dir.z;const lat=Math.abs(rel.x*dir.z-rel.z*dir.x);if(along>-3&&along<46&&lat<3.2&&hdist(pp,t)>2)continue;}
    let clear=0;for(let s=0;s<40;s+=2){const p=add(st,mul(dir,s));const gy=groundAt(p.x,p.z,t.y+3);if(Math.abs(gy-t.y)<1.6&&!insideBox(p.x,gy+0.8,p.z,0.9))clear++;else clear=0;}
    if(!best||clear>best.clear)best={clear,dir,st};}
  if(!best){showMsg('Pas de route libre ici',1.5);return;}
  const d=best.dir;const st=add(t,mul(d,-Math.min(40,best.clear*2)));const mesh=buildCarMesh(rndi(0,7));scene.add(mesh);
  const v={p:{x:st.x,y:groundAt(st.x,st.z,t.y+3),z:st.z},dir:d,spd:(speedKmh||rnd(60,90))/3.6,mesh,hit:new Set(),crashed:false,t:0,smokeT:0};
  mesh.rotation.y=Math.atan2(-d.z,d.x);VEHICLES.push(v);if(VEHICLES.length>6){const o=VEHICLES.shift();if(!o.crashed)scene.remove(o.mesh);}
  showMsg('🚗 Voiture à '+Math.round(v.spd*3.6)+' km/h !',2);}
function updVehicles(dt){
  for(const v of VEHICLES){
    if(v.crashed){v.smokeT-=dt;if(v.smokeT>0&&Math.random()<0.3)emitSmoke(v.p.x+v.dir.x*1.8,v.p.y+1,v.p.z+v.dir.z*1.8,0.25,3,0.012);continue;}
    v.t+=dt;const step=v.spd*dt;const np=add(v.p,mul(v.dir,step));const gy=groundAt(np.x,np.z,v.p.y+1.2);
    if(Math.random()<0.3)SFX.step();
    const front=add(np,mul(v.dir,2.2));
    if(insideBox(front.x,gy+0.7,front.z,0)||Math.abs(gy-v.p.y)>1.4||v.t>9||v.spd<0.5){
      v.crashed=true;v.smokeT=v.spd>8?40:8;sfxAt(np);SFX.big();SFX.glass();shakeAt(np,v.spd/25);
      for(let k=0;k<14;k++)spawnP(add(front,{x:0,y:0.8,z:0}),{x:rnd(-0.04,0.04),y:rnd(0.01,0.06),z:rnd(-0.04,0.04)},'glass');
      if(v.spd>17)FIRES.push({x:v.p.x+v.dir.x*1.5,y:v.p.y+0.05,z:v.p.z+v.dir.z*1.5,r:1.6,life:30,max:30});
      const h=Math.abs(v.dir.x)>0.7?{x:2.15,z:0.9}:Math.abs(v.dir.z)>0.7?{x:0.9,z:2.15}:{x:1.6,z:1.6};addCollider(v.p.x-h.x,v.p.y,v.p.z-h.z,v.p.x+h.x,v.p.y+1.45,v.p.z+h.z);gridInsertLast();
      for(const c of chars)if(c.alive&&vlen(sub(c.P[c.chest],v.p))<3.2&&!v.hit.has(c)){v.hit.add(c);vehicleImpact(c,v,v.spd*0.8);}
      continue;}
    v.p={x:np.x,y:gy,z:np.z};v.mesh.position.set(v.p.x,v.p.y,v.p.z);
    // pedestrians
    const R={x:-v.dir.z,z:v.dir.x};
    for(const c of chars){if(v.hit.has(c))continue;const cp=c.P[c.pelvis];if(Math.abs(cp.x-v.p.x)>4||Math.abs(cp.z-v.p.z)>4)continue;
      for(const pi of [c.pelvis,c.chest,c.legs[0].kn,c.legs[1].kn,c.legs[0].ft,c.legs[1].ft,c.head]){const q=c.P[pi];const lx=(q.x-v.p.x)*v.dir.x+(q.z-v.p.z)*v.dir.z,lz=(q.x-v.p.x)*R.x+(q.z-v.p.z)*R.z,ly=q.y-v.p.y;
        if(lx>-2.2&&lx<2.35&&Math.abs(lz)<1.0&&ly<1.6&&ly>-0.3){v.hit.add(c);vehicleImpact(c,v,v.spd);v.spd*=c.alive?0.82:0.9;break;}}}
    if(v.hit.size&&v.t>0.6)v.spd=Math.max(0,v.spd-dt*6);
  }
}
function vehicleImpact(c,v,spd){
  const e=spd/14,inj=[];c.lastHit=player;wake(c);c._lastAn=anchorAt(c,c.P[c.pelvis]);
  const B=(k,m)=>boneDamage(c,BONE_IDX[k],e*e*m*rnd(0.7,1.3),false,inj),Mu=(k,m)=>muscleDamage(c,MUS_IDX[k],e*e*m*rnd(0.6,1.4),inj);
  const s=Math.random()<0.5?'R':'L',o=s==='R'?'L':'R';
  sfxAt(c.P[c.pelvis]);SFX.blunt();SFX.crack();
  // bumper: tibia / fibula ("bumper fracture"), knee ligaments
  B('tibia'+s,55);B('fibula'+s,45);B('tibia'+o,30);B('fibula'+o,25);Mu('mcl'+s,60);Mu('acl'+s,45);Mu('meniscus'+s,35);Mu('lcl'+o,30);
  // bonnet: femur, pelvis
  if(e>0.6){B('femur'+s,30);B('hip'+s,35);B('sacrum',20);}
  // windscreen: head, neck, thorax
  if(e>0.75){c.concussion+=e*e*28;organDamage(c,ORG.brain,e*e*8,'blunt',inj);B(pick(['frontal','parietalR','parietalL','temporal'+s]),e*e*14);B('C'+rndi(2,7),e*e*10);
    for(let i=0;i<rndi(2,5);i++)B('rib'+s+rndi(2,11),e*e*16);c.wounds.push(mkWound(c,'head',c.P[c.head],'Plaie du cuir chevelu (pare-brise)',rnd(1.5,3)));}
  if(e>1.1){for(const k of ['spleen','liver','lungR','lungL','kidneyR','kidneyL'])if(Math.random()<clamp(e*0.35,0,0.85))organDamage(c,ORG[k],e*e*14,'blunt',inj);}
  if(e>1.6&&Math.random()<0.5)organDamage(c,ORG.aorta,45,'decel',inj);
  for(const r of ['thigh'+s,'shin'+s,'pelvis','thorax','head'])c.bruise[r]=Math.min(1,c.bruise[r]+e*0.4);
  c.painInj+=e*45;c.stun=Math.max(c.stun,2+e*2);c.adren=1;
  inj.unshift({t:'Renversé par une voiture à '+Math.round(spd*3.6)+' km/h',sev:e>1.2?4:3});
  // throw: forward + up, rotate over the bonnet
  const V=mul(v.dir,spd/60*1.1);V.y=spd/60*(0.35+Math.random()*0.2);
  for(const p of c.P){const lift=p.y-c.P[c.pelvis].y;p.ox=p.x-V.x*(1+lift*0.3);p.oz=p.z-V.z*(1+lift*0.3);p.oy=p.y-V.y*(1+lift*0.5);}
  reportInjuries(c,inj,c.P[c.pelvis]);c.dirty=true;computeFunctions(c);addAlarm(c.P[c.pelvis],30);
}

/* ---------------- lightning / electrocution ---------------- */
function lightning(t){
  let tgt=null,bd=6;for(const c of chars){const d=hdist(c.P[c.head],t);if(d<bd){bd=d;tgt=c;}}
  const top={x:t.x+rnd(-8,8),y:t.y+90,z:t.z+rnd(-8,8)};const end=tgt?tgt.P[tgt.head]:t;
  const pts=[];const n=14;for(let i=0;i<=n;i++){const p=lerp3(top,end,i/n);if(i>0&&i<n){p.x+=rnd(-2.5,2.5)*(1-i/n);p.z+=rnd(-2.5,2.5)*(1-i/n);}pts.push(new THREE.Vector3(p.x,p.y,p.z));}
  const L=new THREE.Group();for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const len=a.distanceTo(b);for(const [r,mat] of [[0.07,M.boltCore],[0.28,M.boltGlow]]){const g=new THREE.CylinderGeometry(r,r,len,5,1,true);const me=new THREE.Mesh(g,mat);me.position.copy(a).add(b).multiplyScalar(0.5);me.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());L.add(me);}}
  scene.add(L);BOLTS.push({m:L,t:0.6});
  flashAt(end,2);FLASH=Math.max(FLASH,0.9);sfxAt(end);SFX.big();SFX.crack();setTimeout(()=>{SV=1;SFX.thud();SFX.big();},600);
  for(let i=0;i<14;i++)spawnP(end,{x:rnd(-0.05,0.05),y:rnd(0.02,0.08),z:rnd(-0.05,0.05)},'spark');
  if(tgt)electrocute(tgt,1);
  for(const c of chars)if(c!==tgt&&hdist(c.P[c.pelvis],end)<4)electrocute(c,0.35);   // ground current / side flash
  const gy=groundAt(end.x,end.z,end.y+1);addScorch(end.x,gy,end.z,0.9);
}
function electrocute(c,k){
  if(!c.alive)return;const inj=[];c.elec=true;wake(c);
  const ent=pick(['head','neck','uarmR','uarmL','handR','handL']),ex=pick(['footR','footL']);
  burnDose(c,ent,k*rnd(6,11));burnDose(c,ex,k*rnd(4,9));for(const r of ['thorax','thighR','thighL'])if(Math.random()<0.5)burnDose(c,r,k*rnd(0.5,2));
  c.wounds.push(mkWound(c,ent,c.P[c.head],'Brûlure électrique (entrée)',0.1,0.02));c.wounds.push(mkWound(c,ex,c.P[c.legs[0].ft],'Brûlure électrique (sortie)',0.1,0.02));
  for(const s of SIDES)if(Math.random()<0.55*k)organDamage(c,ORG['innerEar'+s],45,'blunt',inj);
  if(Math.random()<0.3*k)organDamage(c,ORG['eye'+pick(SIDES)],25,'blunt',inj);
  for(const m of MUSCLES)if(Math.random()<0.2*k&&!isLig(m.key))c.mus[m.id]=Math.max(0,c.mus[m.id]-rnd(5,25)*k);
  c.stun=Math.max(c.stun,8*k);spasm(c,0.03*k);c.painInj+=50*k;c.koT=Math.max(c.koT,20*k);
  if(Math.random()<0.3*k)ignite(c,'thorax',5);
  inj.unshift({t:k>0.6?'⚡ Foudroyé !':'⚡ Électrocuté (courant de sol)',sev:4});
  if(Math.random()<(k>0.6?0.72:0.2)){c.arrest=true;c.arrestT=0;c.cause='Arrêt cardiaque – foudroyé (fibrillation)';c.conscious=false;inj.push({t:'Arrêt cardiaque ! (RCP + DAE)',sev:4});if(c.isPlayer){SV=1;SFX.flat();}}
  reportInjuries(c,inj,c.P[c.chest]);c.dirty=true;computeFunctions(c);
  if(!c.isPlayer)say(c,'hurt',true);
}
const BOLTS=[];

/* ---------------- tornado ---------------- */
function tornado(t){const m=new THREE.Group();for(const [r0,r1,h,mat,sx] of [[12,1.1,48,M.funnel,1],[7.5,0.7,40,M.funnel2,1.15],[16,8,10,M.funnel,0.9]]){const geo=new THREE.CylinderGeometry(r0,r1,h,28,8,true);const pa=geo.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i);const w=1+Math.sin(y*0.35)*0.08;pa.setX(i,pa.getX(i)*w);pa.setZ(i,pa.getZ(i)*w);}geo.translate(0,h===10?44:h/2,0);const me=new THREE.Mesh(geo,mat);me.scale.x=sx;m.add(me);}m.position.set(t.x,t.y,t.z);scene.add(m);
  const a=rnd(0,6.28);TORNADOS.push({x:t.x,z:t.z,y:t.y,vx:Math.cos(a)*3.2,vz:Math.sin(a)*3.2,t:28,mesh:m});showMsg('🌪️ Tornade !',2);SFX.whoosh();if(TORNADOS.length>2){const o=TORNADOS.shift();scene.remove(o.mesh);}}
function updTornados(dt){for(let i=TORNADOS.length-1;i>=0;i--){const T=TORNADOS[i];T.t-=dt;
  if(Math.random()<dt*0.5){const a=Math.atan2(T.vz,T.vx)+rnd(-1,1);T.vx=Math.cos(a)*3.2;T.vz=Math.sin(a)*3.2;}
  T.x+=T.vx*dt;T.z+=T.vz*dt;T.y+=(groundAt(T.x,T.z,T.y+5)-T.y)*0.05;T.mesh.position.set(T.x,T.y,T.z);T.mesh.rotation.y-=dt*6;T.mesh.rotation.z=Math.sin(GT*0.7)*0.06;T.mesh.children[1].rotation.y+=dt*4;
  const fade=clamp(T.t/3,0,1);T.mesh.scale.set(fade,1,fade);
  for(let k=0;k<6;k++){const a=rnd(0,6.28),r=rnd(0.5,6),h=rnd(0,25);emitSmoke(T.x+Math.cos(a)*r*(0.4+h/30),T.y+h,T.z+Math.sin(a)*r*(0.4+h/30),0.32,rnd(0.6,1.4),0.04,null,0.03);}
  for(let k=0;k<3;k++)spawnP({x:T.x+rnd(-3,3),y:T.y+0.3,z:T.z+rnd(-3,3)},{x:rnd(-0.1,0.1),y:rnd(0.05,0.15),z:rnd(-0.1,0.1)},'dust',rnd(0.03,0.08));
  if(hdist(T,camera.position)<40){SHAKE=Math.max(SHAKE,0.25);if(Math.random()<dt*2){sfxAt(T);SFX.whoosh();}}
  for(const c of chars){const pp=c.P[c.pelvis];const dx=pp.x-T.x,dz=pp.z-T.z,r=Math.hypot(dx,dz);if(r>15)continue;const rh=pp.y-T.y;
    const ux=dx/(r||1),uz=dz/(r||1);const k=fade*clamp(1-r/15,0,1);
    const tang=0.014*k,inw=0.006*k*(r>3?1:-0.5),lift=r<7?(rh<22?0.0105:0.003)*k:0;
    const dv={x:-uz*tang-ux*inw,y:lift,z:ux*tang-uz*inw};pushChar(c,dv,0.15);
    for(const p of c.P){const vx=p.x-p.ox,vz=p.z-p.oz,vy=p.y-p.oy;const sp=Math.hypot(vx,vy,vz);if(sp>0.55){p.ox=p.x-vx*0.55/sp;p.oy=p.y-vy*0.55/sp;p.oz=p.z-vz*0.55/sp;}}
    if(r<7){c.stun=Math.max(c.stun,1.5);if(Math.random()<dt*0.6&&c.alive){const inj=[];const hi=rndi(0,c.H.length-1);const h=c.H[hi];applyBlunt(c,h.reg,c.P[h.a],norm(dv),rnd(8,22),inj);if(Math.random()<0.4)c.wounds.push(mkWound(c,h.reg,c.P[h.a],'Lacération (débris projetés)',rnd(0.5,1.6)));reportInjuries(c,inj,c.P[h.a]);}}
    if(c.alive&&r<10&&c.conscious)say(c,'fear');}
  if(T.t<=0){scene.remove(T.mesh);TORNADOS.splice(i,1);}}}

/* ---------------- flood ---------------- */
function flood(t){const gy=groundAt(t.x,t.z,t.y+2);FLOOD.target=gy+2.4;if(FLOOD.level<gy-1)FLOOD.level=gy-1;FLOOD.t=70;const a=rnd(0,6.28);FLOOD.flow={x:Math.cos(a),z:Math.sin(a)};
  if(!FLOOD.mesh){const tx=T.water.clone();tx.needsUpdate=true;tx.repeat.set(70,70);FLOOD.mesh=new THREE.Mesh(new THREE.PlaneGeometry(900,900),std({map:tx,color:0x6f7d6a,metalness:0.2,roughness:0.15,transparent:true,opacity:0.88}));FLOOD.mesh.rotation.x=-Math.PI/2;scene.add(FLOOD.mesh);}
  FLOOD.mesh.visible=true;showMsg('🌊 Inondation ! Montez en hauteur !',2.5);SFX.splash();}
function updFlood(dt){if(FLOOD.t<=0&&FLOOD.level<-1e8)return;
  FLOOD.t-=dt;const goal=FLOOD.t>0?FLOOD.target:FLOOD.target-6;FLOOD.level+=clamp(goal-FLOOD.level,-0.12*dt,0.22*dt);
  if(FLOOD.t<=0&&FLOOD.level<=FLOOD.target-5.9){FLOOD.level=-1e9;if(FLOOD.mesh)FLOOD.mesh.visible=false;return;}
  if(FLOOD.mesh){FLOOD.mesh.position.set(camera.position.x,FLOOD.level,camera.position.z);if(FLOOD.mesh.material.map)FLOOD.mesh.material.map.offset.set(GT*0.02*FLOOD.flow.x,GT*0.02*FLOOD.flow.z);}
  for(const c of chars){const pp=c.P[c.pelvis];if(pp.y>FLOOD.level)continue;const depth=FLOOD.level-pp.y;const k=clamp(depth/1.2,0,1)*0.0011;
    for(const p of c.P){if(p.y<FLOOD.level){p.ox-=FLOOD.flow.x*k;p.oz-=FLOOD.flow.z*k;}}
    if(c.alive&&c.conscious&&depth>0.7)say(c,'drown');}}

/* ---------------- earthquake ---------------- */
function earthquake(){QUAKE=16;showMsg('🏚️ Séisme ! Magnitude '+rnd(6.4,7.8).toFixed(1),2.5);SFX.big();}
function updQuake(dt){if(QUAKE<=0)return;QUAKE-=dt;const k=clamp(Math.min(QUAKE,16-QUAKE)/3,0,1);SHAKE=Math.max(SHAKE,0.9*k);if(Math.random()<dt*3*k){SV=0.6;SFX.thud();}
  for(const c of chars){if(!c.alive)continue;if(Math.random()<dt*0.35*k&&c.canStand){c.stun=Math.max(c.stun,1.2);pushChar(c,{x:rnd(-0.02,0.02),y:0,z:rnd(-0.02,0.02)},0.4);if(c.conscious)say(c,'fear');}
    else{const j={x:rnd(-0.004,0.004)*k,y:0,z:rnd(-0.004,0.004)*k};for(const pi of [c.legs[0].ft,c.legs[1].ft,c.legs[0].toe,c.legs[1].toe]){const p=c.P[pi];p.ox-=j.x;p.oz-=j.z;}}}
  // bricks and glass falling from buildings around the camera
  if(Math.random()<dt*7*k){const near=boxesNear(camera.position.x,camera.position.z,28).filter(b=>b.max.y-b.min.y>4);if(near.length){const b=pick(near);
    const side=rndi(0,3);let x=rnd(b.min.x,b.max.x),z=rnd(b.min.z,b.max.z);if(side===0)x=b.min.x-0.25;else if(side===1)x=b.max.x+0.25;else if(side===2)z=b.min.z-0.25;else z=b.max.z+0.25;
    const y=rnd(b.min.y+3,b.max.y);const out={x:side===0?-1:side===1?1:0,z:side===2?-1:side===3?1:0};
    const n=Math.random()<0.25?rndi(3,6):1;for(let i=0;i<n;i++)throwDebris({x:x+rnd(-0.4,0.4),y:y+rnd(0,0.5),z:z+rnd(-0.4,0.4)},{x:out.x*rnd(0.005,0.03),y:0,z:out.z*rnd(0.005,0.03)},Math.random()<0.8?'brick':'rock');
    if(Math.random()<0.3)for(let i=0;i<8;i++)spawnP({x,y,z},{x:out.x*0.02+rnd(-0.01,0.01),y:0,z:out.z*0.02+rnd(-0.01,0.01)},'glass');}}}
function brickRain(t){for(let i=0;i<60;i++)setTimeout(()=>throwDebris({x:t.x+rnd(-3.5,3.5),y:t.y+rnd(14,26),z:t.z+rnd(-3.5,3.5)},{x:0,y:0,z:0},Math.random()<0.85?'brick':'rock'),i*60);showMsg('🧱 Pluie de briques !',2);}
function swimTick(c,dt){const pp=c.P[c.pelvis];if(!c.inWater){c.swimT=Math.max(0,(c.swimT||0)-dt*2);c.sink=0;return;}const deep=waterLevel(pp.x,pp.z)-groundAt(pp.x,pp.z,pp.y)>1.5;if(!deep){c.sink=0;return;}
  c.swimT=(c.swimT||0)+dt;const lim=35*(c.age>65?0.5:1)*clamp(Math.min(c.legFn[0]+c.legFn[1],c.armFn[0]+c.armFn[1])/2,0.15,1)*(c.temp<34?0.5:1)*(c.lossF>0.15?0.4:1)*(c.isPlayer?2:1);
  c.sink=!c.alive||!c.conscious?1:clamp((c.swimT-lim)/12,0,1);if(c.sink>0.3&&c.alive&&c.conscious)say(c,'drown');}

/* ---------------- toxic gas (chlorine) ---------------- */
function toxicGas(t){GASES.push({x:t.x,y:groundAt(t.x,t.z,t.y+2),z:t.z,r:2,t:40,max:40});showMsg('☠️ Nuage de gaz toxique (chlore) !',2.2);SFX.whoosh();}
function updGases(dt){for(let i=GASES.length-1;i>=0;i--){const g=GASES[i];g.t-=dt;g.r=Math.min(13,g.r+dt*1.5);const k=clamp(g.t/8,0,1);
  for(let j=0;j<Math.ceil(5*k);j++){const a=rnd(0,6.28),r=Math.sqrt(Math.random())*g.r;emitSmoke(g.x+Math.cos(a)*r,g.y+rnd(0.1,1.8),g.z+Math.sin(a)*r,0.78,rnd(2,4),rnd(0.0005,0.003),CHLORINE,0.006);}
  for(const c of chars){const hp=c.P[c.head];const d=hdist(hp,g);if(d>g.r||hp.y-g.y>2.6)continue;const conc=k*clamp(1.2-d/g.r,0,1)*(1.2-clamp((hp.y-g.y)/2.6,0,1));c.gasExp=Math.max(c.gasExp,conc*1.6);if(Math.random()<dt*0.5)addAlarm(g,g.r+6);
    if(c.conscious&&c.alive&&Math.random()<dt*0.8){sfxAt(hp);SFX.cough();}}
  if(g.t<=0)GASES.splice(i,1);}}

/* ---------------- big fire, cold & heat waves ---------------- */
function bigFire(t){for(let i=0;i<9;i++){const a=rnd(0,6.28),r=rnd(0,6);const x=t.x+Math.cos(a)*r,z=t.z+Math.sin(a)*r,y=groundAt(x,z,t.y+2);if(waterLevel(x,z)<y)FIRES.push({x,y:y+0.05,z,r:rnd(1.5,2.6),life:rnd(30,50),max:50});}
  showMsg('🔥 Incendie !',2);SFX.whoosh();}
function weatherWave(kind){if(!WAVE.kind){WAVE.prevTemp=SET.temp;WAVE.prevRain=SET.rain;}WAVE.kind=kind;WAVE.t=90;
  if(kind==='cold'){SET.temp=-25;SET.rain=true;showMsg('🥶 Vague de froid : −25 °C, neige',2.5);}else{SET.temp=46;SET.rain=false;showMsg('🥵 Canicule : 46 °C',2.5);}applyEnvironment();}
function updWave(dt){if(!WAVE.kind)return;WAVE.t-=dt;if(WAVE.t<=0){SET.temp=WAVE.prevTemp;SET.rain=WAVE.prevRain;WAVE.kind=null;applyEnvironment();showMsg('La météo redevient normale',1.8);}}

/* ---------------- sandbox tools ---------------- */
function teleportPlayer(t){const p=player;const gy=groundAt(t.x,t.z,t.y+3)+0.05;const d=sub({x:t.x,y:gy,z:t.z},{x:p.P[p.pelvis].x,y:Math.min(...p.P.map(q=>q.y)),z:p.P[p.pelvis].z});
  for(const q of p.P){q.x+=d.x;q.y+=d.y+0.02;q.z+=d.z;q.ox=q.x;q.oy=q.y;q.oz=q.z;}showMsg('🌀 Téléporté (hauteur '+Math.round(gy-terrainH(t.x,t.z))+' m)',1.6);}
function roofTeleport(){const B=boxesNear(player.P[player.pelvis].x,player.P[player.pelvis].z,60).filter(b=>b.max.y-terrainH(b.cx,b.cz)>8&&b.hx>1.5&&b.hz>1.5);if(!B.length){showMsg('Aucun toit proche',1.4);return;}
  const b=B.reduce((a,c)=>c.max.y>a.max.y?c:a);teleportPlayer({x:b.cx,y:b.max.y,z:b.cz});}
function throwTarget(c){if(!c){showMsg('Visez une personne',1.3);return;}const d=norm(add(sub(c.P[c.chest],camera.position),{x:0,y:0,z:0}));pushChar(c,{x:d.x*0.33,y:0.3,z:d.z*0.33},0.2);c.stun=Math.max(c.stun,2.5);c.lastHit=player;if(c.conscious)say(c,'fear',true);}
function addPeople(n){for(let i=0;i<n;i++)setTimeout(()=>{if(chars.length<40)spawnCivilian(false);},i*120);showMsg('👥 +'+n+' personnes',1.4);}
function toggleSlowmo(){TIME_SCALE=TIME_SCALE<1?1:0.3;showMsg(TIME_SCALE<1?'🐢 Ralenti ×0.3':'Vitesse normale',1.2);}

const CATAS=[
  {k:'meteor',icon:'☄️',n:'Météorite',d:'Impact + onde de choc, éclats, brûlures, cratère',f:t=>meteorite(t)},
  {k:'car',icon:'🚗',n:'Accident de voiture',d:'Une voiture fonce sur le point visé (60–90 km/h)',f:t=>spawnVehicle(t)},
  {k:'carfast',icon:'🏎️',n:'Voiture à 130 km/h',d:'Choc très violent',f:t=>spawnVehicle(t,130)},
  {k:'bolt',icon:'⚡',n:'Foudre',d:'Arrêt cardiaque, brûlures entrée/sortie, tympans',f:t=>lightning(t)},
  {k:'grenade',icon:'💥',n:'Explosion',d:'Souffle : tympans, poumons, éclats, projection',f:t=>explode(add(t,{x:0,y:0.3,z:0}),1.3,player,{})},
  {k:'tornado',icon:'🌪️',n:'Tornade',d:'Aspire et projette les gens, débris',f:t=>tornado(t)},
  {k:'flood',icon:'🌊',n:'Inondation',d:"L'eau monte de 2,4 m : noyade, hypothermie",f:t=>flood(t)},
  {k:'quake',icon:'🏚️',n:'Séisme',d:'Le sol tremble, chutes de briques et de verre',f:()=>earthquake()},
  {k:'bricks',icon:'🧱',n:'Pluie de briques',d:'40 briques tombent du ciel',f:t=>brickRain(t)},
  {k:'fire',icon:'🔥',n:'Incendie',d:'Grand feu au point visé',f:t=>bigFire(t)},
  {k:'gas',icon:'☠️',n:'Gaz toxique',d:'Chlore : brûle les poumons et les yeux',f:t=>toxicGas(t)},
  {k:'cold',icon:'🥶',n:'Vague de froid',d:'−25 °C + neige pendant 90 s',f:()=>weatherWave('cold')},
  {k:'heat',icon:'🥵',n:'Canicule',d:'46 °C pendant 90 s : coup de chaleur',f:()=>weatherWave('heat')},
  {k:'tp',icon:'🌀',n:'Me téléporter au point visé',d:'Sur un toit = vous pouvez sauter',f:t=>teleportPlayer(t)},
  {k:'roof',icon:'🏢',n:'Me mettre sur le plus haut toit',d:'Pour sauter dans le vide',f:()=>roofTeleport()},
  {k:'throw',icon:'🤾',n:'Projeter la personne visée',d:'La lance en l\'air',f:()=>throwTarget(aimTarget&&aimTarget.c&&aimTarget.c!==player?aimTarget.c:lastTarget)},
  {k:'people',icon:'👥',n:'+10 personnes',d:'Ajoute des passants',f:()=>addPeople(10)},
  {k:'slow',icon:'🐢',n:'Ralenti on/off',d:'Voir les chocs au ralenti',f:()=>toggleSlowmo()},
];
function catTarget(){const p=player.aimP||player.P[player.head];return{x:p.x,y:groundAt(p.x,p.z,p.y+1),z:p.z};}

function updEvents(dt){
  for(const c of chars)swimTick(c,dt);
  updMeteors(dt);updVehicles(dt);updTornados(dt);updFlood(dt);updQuake(dt);updGases(dt);updWave(dt);
  for(let i=BOLTS.length-1;i>=0;i--){const b=BOLTS[i];b.t-=dt;b.m.visible=b.t>0.45||Math.random()<0.6;if(b.t<=0){scene.remove(b.m);for(const ch of b.m.children)ch.geometry.dispose();BOLTS.splice(i,1);}}
  SHAKE=Math.max(0,SHAKE-dt*1.6);FLASH=Math.max(0,FLASH-dt*2.5);
}
function resetEvents(){
  for(const m of METEORS)scene.remove(m.mesh);METEORS.length=0;for(const v of VEHICLES)scene.remove(v.mesh);VEHICLES.length=0;for(const t of TORNADOS)scene.remove(t.mesh);TORNADOS.length=0;
  for(const m of DEBRIS)scene.remove(m);DEBRIS.length=0;for(const m of SCORCH)scene.remove(m);SCORCH.length=0;for(const b of BOLTS)scene.remove(b.m);BOLTS.length=0;GASES.length=0;
  FLOOD.level=-1e9;FLOOD.t=0;if(FLOOD.mesh)FLOOD.mesh.visible=false;QUAKE=0;SHAKE=0;FLASH=0;TIME_SCALE=1;
  if(WAVE.kind){SET.temp=WAVE.prevTemp;SET.rain=WAVE.prevRain;WAVE.kind=null;}
}
