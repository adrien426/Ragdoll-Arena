"use strict";
/* =====================================================================
   COMBAT : raycasts, weapons, projectiles, fire, AI (hostile / civil),
            spawning, waves (PvP) and sandbox population
   ===================================================================== */
let wave=0,waveActive=false,toSpawn=0,spawnT=0,betweenT=0,gameOverT=-1,kills=0,totalKills=0,running=false,hitMarker=0,hurtFlash=0;
try{totalKills=+localStorage.getItem('ra3dKills')||0;}catch(e){}
function saveKills(){try{localStorage.setItem('ra3dKills',totalKills);}catch(e){}}
const unlockedCount=()=>WEAPONS.filter(w=>totalKills>=w.unlock).length;
function weaponUnlocked(i){return!SET.pvp||totalKills>=WEAPONS[i].unlock;}

function kill(c,cause){
  if(!c.alive)return;
  c.alive=false;c.cause=cause||c.cause||'Décès';c.deadT=0;c.arrest=false;c.hr=0;c.sbp=0;c.dbp=0;c.rr=0;c.conscious=false;c.gcs=3;wake(c);
  sfxAt(c.P[c.head]);SFX.groan(0.7);popupAt(c.P[c.head],'💀 '+c.cause,'#ff6060',3);
  if(!c.isPlayer&&typeof addFeed==='function'&&hdist(c.P[c.pelvis],camera.position)<60)addFeed('💀 '+c.name+' ('+c.age+' ans) est mort'+(c.sex==='F'?'e':'')+' : '+c.cause,4);
  if(c.isPlayer){gameOverT=3.5;}
  else if(c.lastHit&&c.lastHit.isPlayer){kills++;if(SET.pvp&&c.team===1){const b=unlockedCount();totalKills++;saveKills();const a=unlockedCount();if(a>b)showMsg('🔓 Débloqué : '+WEAPONS[a-1].icon+' '+WEAPONS[a-1].name,2.5);buildWeaponBar();}}
  if(c.team===2)addAlarm(c.P[c.pelvis],25);
}

/* ---------------- raycasts ---------------- */
function rayTerrain(o,dir,maxD){
  if(!MAP||MAP.flat){if(dir.y>=-1e-6)return null;const d=-o.y/dir.y;return d>0&&d<maxD?d:null;}
  if(dir.y>=0&&o.y>0.05)return null;
  let prev=0;const step=0.4;
  for(let d=step;d<maxD;d+=step){const x=o.x+dir.x*d,y=o.y+dir.y*d,z=o.z+dir.z*d;
    if(y<terrainH(x,z)){let a=prev,b=d;for(let i=0;i<6;i++){const m=(a+b)/2;if(o.y+dir.y*m<terrainH(o.x+dir.x*m,o.z+dir.z*m))b=m;else a=m;}return b;}
    prev=d;if(y<-30||(dir.y>=0&&y>0.05))break;}
  return null;
}
function rayCast(o,dir,maxD,shooter,excl){
  let best={d:maxD,c:null,surf:null};
  const td=rayTerrain(o,dir,maxD);if(td!==null&&td<best.d)best={d:td,c:null,surf:'ground'};
  for(const b of boxes){const d=rayBox(o,dir,b);if(d!==null&&d>0.0005&&d<best.d)best={d,c:null,surf:'box'};}
  const end=add(o,mul(dir,maxD));
  for(const c of chars){
    if(c===shooter||c===excl)continue;
    const cp=c.P[c.pelvis];const wv=sub(cp,o);const pr=dot(wv,dir);if(pr<-1.8||pr>best.d+1.8)continue;if(vlen(sub(wv,mul(dir,pr)))>1.9)continue;
    for(let i=0;i<c.H.length;i++){const h=c.H[i];const r=segSeg(o,end,capA(c,h),capB(c,h));if(r.d<h.r){const d=r.s*maxD-Math.sqrt(Math.max(0,h.r*h.r-r.d*r.d));if(d<best.d&&d>-0.05)best={d:Math.max(0,d),c,hi:i,t:r.t};}}
  }
  best.point=add(o,mul(dir,best.d));return best;
}
function nearestHitCap(o,p){let best=null;for(let i=0;i<o.H.length;i++){const h=o.H[i];const r=pointSeg(p,capA(o,h),capB(o,h));const d=r.d-h.r;if(!best||d<best.d)best={hi:i,t:r.t,d};}return best;}

/* ---------------- weapons ---------------- */
function canAct(c){return c.alive&&c.conscious&&!c.arrest&&c.stun<=0&&c.tasedT<=0&&c.useArm>=0&&!c.crawling&&c.armFn[c.useArm]>0.18;}
function startReload(c){const w=WEAPONS[c.weapon];if(!w.mag||c.reloadT>0)return;c.reloadT=w.reload*(1+(1-Math.min(c.armFn[0],c.armFn[1]))*1.5)*(c.shiver>0?1.3:1);if(c.isPlayer){SV=1;SFX.click();}}
function muzzleOf(c,w){const h=c.P[c.arms[Math.max(0,c.useArm)].ha];return add(h,mul(c.wDir,w.len*0.95));}
function attackLogic(c,dt){
  c.cd-=dt;c.recoil=Math.max(0,c.recoil-dt*8);
  const w=WEAPONS[c.weapon];
  if(c.reloadT>0){c.reloadT-=dt;if(c.reloadT<=0){c.reloadT=0;c.ammo[c.weapon]=w.mag;if(c.isPlayer){SV=1;SFX.reload();}}return;}
  if(c.swing>=0){const prev=c.swing;c.swing+=dt/(w.cd*0.8);if(prev<0.5&&c.swing>=0.5&&canAct(c)){if(w.type==='melee')meleeHit(c,w);else if(w.type==='throw')releaseThrow(c);}if(c.swing>=1)c.swing=-1;}
  if(!c.hasWeapon||!canAct(c))return;
  if(c.input.reload){c.input.reload=false;if(w.mag&&c.ammo[c.weapon]<w.mag)startReload(c);return;}
  if(c.input.attack&&c.cd<=0&&c.swing<0){
    if(w.mag&&c.ammo[c.weapon]<=0){startReload(c);return;}
    c.cd=w.cd*c.cdMul*(1+(1-c.armFn[c.useArm])*0.8);
    if(w.type==='melee'){c.swing=0;sfxAt(c.P[c.chest]);SFX.swing();}
    else if(w.type==='gun'){c.ammo[c.weapon]--;fire(c,w);if(!w.auto&&c.isPlayer)c.input.attack=false;}
    else if(w.type==='taser'){c.ammo[c.weapon]--;fireTaser(c,w);if(c.isPlayer)c.input.attack=false;}
    else if(w.type==='throw'){c.ammo[c.weapon]--;c.swing=0;if(c.isPlayer)c.input.attack=false;}
  }
}
function meleeHit(c,w){
  const sh=c.P[c.arms[c.useArm].sh];const d=norm(sub(c.aimP,sh));const r1=0.62+w.reach;let best=null;
  for(const o of chars){
    if(o===c||(o.team===c.team&&o.team!==2))continue;if(vlen(sub(o.P[o.pelvis],sh))>3)continue;
    for(let i=0;i<=10;i++){const dist=0.15+(r1-0.15)*i/10;const p=add(sh,mul(d,dist));const h=nearestHitCap(o,p);if(h&&h.d<0.08){if(!best||dist<best.dist)best={o,h,dist,p};break;}}
  }
  if(best){applyHit(best.o,best.h.hi,best.h.t,add(best.p,mul(d,-0.02)),d,w,c);addAlarm(best.p,12);}
}
function impactFX(p,dir,surf){
  for(let i=0;i<6;i++)spawnP(p,{x:-dir.x*0.01+rnd(-0.015,0.015),y:rnd(0.005,0.03),z:-dir.z*0.01+rnd(-0.015,0.015)},surf==='box'&&Math.random()<0.35?'spark':'dust');
  if(Math.random()<0.35){sfxAt(p);SFX.ric();}
  if(waterLevel(p.x,p.z)>p.y-0.25)for(let i=0;i<6;i++)spawnP(p,{x:rnd(-0.01,0.01),y:rnd(0.02,0.05),z:rnd(-0.01,0.01)},'water');
}
function fire(c,w){
  c.recoil=1;const mz=muzzleOf(c,w);
  sfxAt(mz);if(w.id==='sniper')SFX.big();else SFX.shot(w.pellets>1?1.4:1);
  flashLight.position.set(mz.x,mz.y,mz.z);flashLight.intensity=4;
  for(let i=0;i<3;i++)emitSmoke(mz.x,mz.y,mz.z,0.5,0.6,0.004);
  addAlarm(mz,45);
  let origin,base;
  if(c.isPlayer){origin=add({x:camera.position.x,y:camera.position.y,z:camera.position.z},mul(camDir,2.0));base=norm(sub(c.aimP,origin));}
  else{origin=mz;base=norm(sub(c.aimP,mz));}
  let sp=w.spread*(c.isPlayer?1:DIFF[SET.difficulty].spread)+c.aimWob*0.4;
  if(w.two&&c.useArm>=0&&(c.armFn[1-c.useArm]<0.3||(c.holdW&&c.holdArm!==c.useArm)))sp*=3;
  if(c.isPlayer&&!c.input.mx&&!c.input.mz)sp*=0.75;
  for(let k=0;k<(w.pellets||1);k++){
    const dir=norm(add(base,{x:(Math.random()+Math.random()-1)*sp,y:(Math.random()+Math.random()-1)*sp,z:(Math.random()+Math.random()-1)*sp}));
    let o=origin,E=w.energy,excl=null,last=mz;
    for(let hop=0;hop<3;hop++){
      const hit=rayCast(o,dir,220,c,excl);
      addLine(last,hit.point);
      if(!hit.c){if(hit.surf)impactFX(hit.point,dir,hit.surf);break;}
      const res=applyHit(hit.c,hit.hi,hit.t,hit.point,dir,w,c,E);addAlarm(hit.point,20);
      if(res&&res.exit&&res.exitE>0.1){E=res.exitE;o=add(res.exit,mul(dir,0.03));last=res.exit;excl=hit.c;continue;}
      break;
    }
  }
}
function fireTaser(c,w){
  const mz=muzzleOf(c,w);sfxAt(mz);SFX.taser();
  const origin=c.isPlayer?add({x:camera.position.x,y:camera.position.y,z:camera.position.z},mul(camDir,2.0)):mz;
  const dir=norm(sub(c.aimP,origin));const hit=rayCast(origin,dir,c.isPlayer?w.range+2.4:w.range,c,null);
  addLine(mz,hit.point,0xcfd4ff,4);addLine(add(mz,{x:0,y:-0.02,z:0}),add(hit.point,{x:0,y:-0.16,z:0}),0xcfd4ff,4);
  if(hit.c&&vlen(sub(hit.point,mz))<=w.range+0.4)applyHit(hit.c,hit.hi,hit.t,hit.point,dir,w,c);
}
const PROJ=[];const BOTTLE_GEO=new THREE.CylinderGeometry(0.035,0.04,0.2,8);
function releaseMolotov(c){const h=c.P[c.arms[c.useArm].ha];const d=norm(sub(c.aimP,h));const dist=Math.min(25,vlen(sub(c.aimP,h)));const v=mul(d,(7+dist*0.38)/60);v.y+=0.05;
  const mesh=new THREE.Mesh(BOTTLE_GEO,M.glassGreen);mesh.castShadow=true;scene.add(mesh);PROJ.push({p:{x:h.x,y:h.y,z:h.z},v,owner:c,mesh,life:6});sfxAt(h);SFX.swing();}
const FIRES=[];
function updProjectiles(dt){
  for(let i=PROJ.length-1;i>=0;i--){const q=PROJ[i];if(q.kind){updThrown(q,dt,i);continue;}q.v.y-=G;const np=add(q.p,q.v);q.life-=dt;
    if(Math.random()<0.7)emitFlame(q.p.x,q.p.y+0.1,q.p.z,0.4);
    let hit=false,hc=null;
    if(np.y<=groundAt(np.x,np.z,np.y+0.3)+0.02||insideBox(np.x,np.y,np.z,0))hit=true;
    if(!hit)for(const c of chars){if(c===q.owner)continue;const h=nearestHitCap(c,np);if(h&&h.d<0.05){hit=true;hc=c;break;}}
    q.p=np;q.mesh.position.set(np.x,np.y,np.z);q.mesh.rotation.x+=0.3;q.mesh.rotation.z+=0.2;
    if(hit||q.life<=0){scene.remove(q.mesh);PROJ.splice(i,1);
      const gy=groundAt(np.x,np.z,np.y+0.5);sfxAt(np);SFX.glass();SFX.whoosh();
      for(let k=0;k<10;k++)spawnP(np,{x:rnd(-0.02,0.02),y:rnd(0.01,0.04),z:rnd(-0.02,0.02)},'glass');
      if(waterLevel(np.x,np.z)<gy+0.1){FIRES.push({x:np.x,y:gy+0.05,z:np.z,r:2.3,life:13,max:13});addScorch(np.x,gy,np.z,1.6);}
      if(hc){hc.lastHit=q.owner;ignite(hc,regionAtPoint(hc,np),10);}
      addAlarm(np,30);}
  }
}
function updFires(dt){
  let nearest=null,nd=1e9;
  for(const c of chars)c.fireHeat=0;
  for(let i=FIRES.length-1;i>=0;i--){FIRES[i].life-=dt;if(FIRES[i].life<=0)FIRES.splice(i,1);}
  const all=FIRES.concat(PERM_FIRES);
  for(const f of all){
    const d=hdist(camera.position,f);if(d<nd){nd=d;nearest=f;}
    const k=f.perm?1:clamp(f.life/f.max*1.6,0,1);
    if(d<60){const n=f.perm?1:Math.ceil(3*k);for(let j=0;j<n;j++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*f.r*0.85;if(Math.random()<0.8)emitFlame(f.x+Math.cos(a)*r,f.y,f.z+Math.sin(a)*r,f.perm?0.8:1.2);}
      if(Math.random()<(f.perm?0.12:0.4))emitSmoke(f.x+rnd(-f.r/2,f.r/2),f.y+1.2,f.z+rnd(-f.r/2,f.r/2),0.12,rnd(2,4));}
    for(const c of chars){const pp=c.P[c.pelvis];const dh=Math.hypot(pp.x-f.x,pp.z-f.z);if(dh>f.r+4||Math.abs(pp.y-f.y)>2.5)continue;
      c.fireHeat=Math.max(c.fireHeat,clamp(1-(dh-f.r)/4,0,1)*k);
      if(!f.perm&&dh<f.r*k+0.3){for(let s=0;s<2;s++){const ft=c.P[c.legs[s].ft];if(Math.hypot(ft.x-f.x,ft.z-f.z)<f.r*k&&ft.y<f.y+0.8)burnDose(c,'foot'+SIDES[s],dt*0.8);}if(Math.random()<dt*0.9)ignite(c,pick(['footR','footL','shinR','shinL']),9);}
      if(f.perm&&dh<f.r+0.2&&Math.random()<dt*0.2)ignite(c,pick(['handR','handL','larmR','thorax']),4);}
  }
  if(nearest&&nd<45){fireLight.position.set(nearest.x,nearest.y+1,nearest.z);fireLight.intensity=(nearest.perm?1.5:2.8)*(0.8+Math.random()*0.4);}else fireLight.intensity=0;
  if(AC){loopSnd('fire','bandpass',600,0.6);loopVol('fire',nearest?clamp(1-nd/16,0,1)*0.3:0);}
}

/* ---------------- AI ---------------- */
const ALARMS=[];function addAlarm(p,r){ALARMS.push({x:p.x,z:p.z,r,t:GT});if(ALARMS.length>30)ALARMS.shift();}
function steer(c,target,spd){
  const me=c.P[c.pelvis];let tgt=target;
  if(MAP.nav){const wp=MAP.nav({x:me.x,y:me.y,z:me.z},{x:target.x,y:target.y!==undefined?target.y:me.y,z:target.z});if(wp)tgt=wp;}
  let dx=tgt.x-me.x,dz=tgt.z-me.z;const dist=Math.hypot(dx,dz);if(dist<0.35)return{x:0,z:0,dist};dx/=dist;dz/=dist;
  if(c.ai.avoidT>0){c.ai.avoidT-=1/60;const s=c.ai.avoidDir;const nx=dx-dz*s*1.6,nz=dz+dx*s*1.6;const l=Math.hypot(nx,nz);dx=nx/l;dz=nz/l;}
  const gNow=groundAt(me.x,me.z,me.y-0.4),ax=me.x+dx*1.3,az=me.z+dz*1.3,gA=groundAt(ax,az,me.y-0.4);
  if(gA<gNow-1.2){c.ai.avoidT=1.2;c.ai.avoidDir=Math.random()<0.5?1:-1;return{x:0,z:0,dist};}
  const v=Math.hypot(me.x-me.ox,me.z-me.oz);
  if(v<0.006&&c.canStand){c.ai.stuck+=1/60;if(c.ai.stuck>0.9){c.ai.avoidT=1.5;c.ai.avoidDir=Math.random()<0.5?1:-1;c.ai.stuck=0;}}else c.ai.stuck=Math.max(0,c.ai.stuck-1/60);
  return{x:dx*spd,z:dz*spd,dist};
}
function hostileAI(e,dt){
  const p=player,me=e.P[e.pelvis],w=WEAPONS[e.weapon];
  if(!p||!p.alive){e.input.mx=e.input.mz=0;e.input.attack=false;return;}
  const D=DIFF[SET.difficulty];
  e.ai.t-=dt;if(e.ai.t<=0){e.ai.t=e.ai.react*D.react;e.ai.tgt=pick([p.head,p.chest,p.chest,p.pelvis,p.legs[0].kn,p.legs[1].tm,p.arms[0].el]);e.ai.jit=rnd(-0.08,0.08);if(Math.random()<0.1)e.ai.strafe*=-1;}
  const tg=p.P[e.ai.tgt==null?p.chest:e.ai.tgt];const pp=p.P[p.pelvis];
  const tx=pp.x-me.x,tz=pp.z-me.z,dist=Math.hypot(tx,tz),dn={x:tx/(dist||1),z:tz/(dist||1)};
  e.yaw=Math.atan2(tx,tz);e.aimP={x:tg.x,y:tg.y+e.ai.jit,z:tg.z};
  const ranged=w.type!=='melee';const range=w.type==='gun'?34:w.type==='taser'?6.5:w.type==='throw'?20:0.62+(w.reach||0)+0.05;
  const want=ranged?(w.type==='taser'?5:w.type==='throw'?12:11+e.ai.off):range-0.18;
  const hurt=e.lossF>0.22||e.painEff>65;
  e.ai.losT-=dt;if(e.ai.losT<=0){e.ai.losT=0.3;const o=e.P[e.neck];const h=rayCast(o,norm(sub(e.aimP,o)),dist+3,e,null);const was=e.ai.los;e.ai.los=h.c===p;if(e.ai.los&&!was&&Math.random()<0.5)say(e,'hostile');}
  let mv={x:0,z:0};
  if(hurt&&ranged&&dist<want+6){const s=steer(e,{x:me.x-dn.x*5,z:me.z-dn.z*5},0.7);mv={x:s.x,z:s.z};}
  else if(dist>want+0.15||(!e.ai.los&&ranged)){const s=steer(e,pp,0.85);mv={x:s.x,z:s.z};}
  else if(ranged&&dist<want-4)mv={x:-dn.x*0.6,z:-dn.z*0.6};
  if(ranged&&dist<want+4&&e.ai.los){mv.x+=-dn.z*0.35*e.ai.strafe;mv.z+=dn.x*0.35*e.ai.strafe;}
  e.input.mx=mv.x;e.input.mz=mv.z;
  e.input.attack=dist<range&&(e.ai.los||!ranged)&&Math.random()<0.12/D.react;
  if(w.mag&&e.ammo[e.weapon]<=0)e.input.reload=true;
}
function civilianAI(e,dt){
  const me=e.P[e.pelvis],A=e.ai;
  for(const a of ALARMS){if(a.t>A.alarmT&&Math.hypot(a.x-me.x,a.z-me.z)<a.r){A.alarmT=a.t;if(A.state!=='flee'&&Math.random()<0.6){sfxAt(e.P[e.head]);SFX.scream(1.1);}if(A.state!=='flee'&&Math.random()<0.5)say(e,player&&WEAPONS[player.weapon].type==='gun'&&hdist(player.P[player.pelvis],me)<30?'armed':'fear');A.state='flee';A.fleeT=rnd(12,20);A.threat={x:a.x,z:a.z};}}
  if(e.lastHit&&e.lastHit!==A.lastSeenHitter){A.lastSeenHitter=e.lastHit;A.state='flee';A.fleeT=20;const lp=e.lastHit.P[e.lastHit.pelvis];A.threat={x:lp.x,z:lp.z};}
  let mv={x:0,z:0};
  if(e.burning>0){if(A.panicDir===undefined||Math.random()<0.02)A.panicDir=Math.random()*6.28;mv={x:Math.sin(A.panicDir),z:Math.cos(A.panicDir)};}
  else if(A.state==='flee'){A.fleeT-=dt;if(A.fleeT<=0)A.state='wander';const th=A.threat||{x:me.x+1,z:me.z};let dx=me.x-th.x,dz=me.z-th.z;const l=Math.hypot(dx,dz)||1;const s=steer(e,{x:me.x+dx/l*8,z:me.z+dz/l*8},1);mv={x:s.x,z:s.z};}
  else{if(!A.wp||hdist(me,A.wp)<1.2){A.idle-=dt;if(A.idle<=0){A.wp=spawnPoint({x:me.x,z:me.z,y:me.y},4,22,true);A.idle=rnd(1,5);}}else{const s=steer(e,A.wp,0.42);mv={x:s.x,z:s.z};}}
  e.input.mx=mv.x;e.input.mz=mv.z;e.input.attack=false;
  if(Math.hypot(mv.x,mv.z)>0.05)e.yaw=Math.atan2(mv.x,mv.z);
  e.aimP=add(e.P[e.neck],{x:Math.sin(e.yaw)*5,y:0,z:Math.cos(e.yaw)*5});
}
function aiTick(e,dt){if(!e.alive)return;e.downT=(!e.conscious||e.tasedT>0)?(e.downT||0)+dt:0;if(e.team===1)hostileAI(e,dt);else civilianAI(e,dt);}
function separate(){
  for(let i=0;i<chars.length;i++)for(let j=i+1;j<chars.length;j++){const a=chars[i],b=chars[j];if(!a.alive&&!b.alive)continue;
    const hd=hdist(a.P[a.pelvis],b.P[b.pelvis]);if(hd>2.2)continue;
    // bodies on the ground (or thrown) collide point against point, so ragdolls pile up instead of merging
    const down=x=>!x.alive||!x.conscious||!x.canStand||x.stun>0.5;
    if(down(a)||down(b)){if(Math.abs(a.P[a.pelvis].y-b.P[b.pelvis].y)<2.2){wake(a);
      for(const pa of a.P)for(const pb of b.P){const dx=pb.x-pa.x,dy=pb.y-pa.y,dz=pb.z-pa.z,R=pa.r+pb.r;if(dx>R||dx<-R||dy>R||dy<-R||dz>R||dz<-R)continue;const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(d<R&&d>1e-5){const k=(R-d)/d*0.5;pa.x-=dx*k;pa.y-=dy*k;pa.z-=dz*k;pb.x+=dx*k;pb.y+=dy*k;pb.z+=dz*k;}}}
      continue;}
    if(hd>1.2)continue;
    for(const ia of [a.pelvis,a.chest])for(const ib of [b.pelvis,b.chest]){const pa=a.P[ia],pb=b.P[ib];const dx=pb.x-pa.x,dz=pb.z-pa.z,dy=pb.y-pa.y;const d=Math.hypot(dx,dz);if(d<0.42&&Math.abs(dy)<0.6&&d>1e-4){const k=(0.42-d)/d*0.25;pa.x-=dx*k;pa.z-=dz*k;pb.x+=dx*k;pb.z+=dz*k;}}}
}

/* ---------------- spawning & modes ---------------- */
const SHIRTS=['#8e2b2b','#35693a','#5d5d5d','#7a5228','#5e3a75','#262626','#a06d1a','#2d5560','#c9c2b0','#3b4f7a','#b04a6a','#1f3d2b'];
const PANTS=['#2a3150','#3a3226','#1d1d1f','#4a4a4e','#2f3f5a','#5b4a3a'];
const SKINS=['#e8c0a0','#d9a47c','#c08055','#8a5638','#efc6a0','#a26845','#6b4128'];
const HAIRS=['#17120e','#4e3218','#2a1a10','#8a6a3a','#b8a070','#5a5a5a','#c4c4c4'];
function outfit(){return{skin:pick(SKINS),shirt:pick(SHIRTS),pants:pick(PANTS),hair:pick(HAIRS),shoe:pick(['#151515','#2a2016','#3a3a3a','#d8d8d8'])};}
function enemyWeapon(){const pool=[0];if(wave>=2)pool.push(1);if(wave>=3)pool.push(2);if(wave>=4)pool.push(4);if(wave>=5)pool.push(3);if(wave>=6)pool.push(5);if(wave>=7)pool.push(7);if(wave>=8)pool.push(6);if(wave>=10)pool.push(8);if(wave>=3&&Math.random()<0.15)return 10;return pick(pool);}
function spawnHostile(){
  const pp=player.P[player.pelvis];const s=spawnPoint({x:pp.x,z:pp.z,y:pp.y},16,26,true)||spawnPoint({x:pp.x,z:pp.z,y:pp.y},12,32,false);if(!s)return false;
  const o=outfit();o.weapon=enemyWeapon();o.y=s.y+1;
  const e=makeChar(s.x,s.z,Math.atan2(pp.x-s.x,pp.z-s.z),1,o);
  const D=DIFF[SET.difficulty];e.dmgMul=D.dmg*(0.85+Math.min(wave,12)*0.03);e.cdMul=1.6;e.speedMul=rnd(0.75,1.0);e.ai.react=rnd(0.3,0.65);
  chars.push(e);return true;
}
function spawnCivilian(far){
  const pp=player.P[player.pelvis];const s=spawnPoint({x:pp.x,z:pp.z,y:pp.y},far?22:6,far?42:32,false);if(!s)return false;
  const o=outfit();o.y=s.y+1;const e=makeChar(s.x,s.z,rnd(0,6.28),2,o);e.speedMul=rnd(0.8,1.05);chars.push(e);return true;
}
function startWave(){wave++;toSpawn=3+wave*2;spawnT=0.5;waveActive=true;showMsg('VAGUE '+wave,2);}
function gameTick(dt){
  if(!player)return;
  const dead=chars.filter(c=>c!==player&&!c.alive);if(dead.length>12)removeChar(dead.sort((a,b)=>b.deadT-a.deadT)[0]);
  for(const c of chars){if(c===player)continue;const d=hdist(c.P[c.pelvis],player.P[player.pelvis]);if(d>95&&!SET.pvp)removeChar(c);}
  if(player.alive){
    if(SET.pvp){
      const act=chars.filter(e=>e.team===1&&e.alive&&(e.downT||0)<6).length;
      if(waveActive){
        if(toSpawn>0){spawnT-=dt;if(spawnT<=0&&act<Math.min(3+wave,10)&&chars.length<38){if(spawnHostile())toSpawn--;spawnT=rnd(1.2,2.6);}}
        else if(act===0){waveActive=false;betweenT=5;for(const it of MED_ITEMS)INV[it.k]++;player.blood=Math.min(player.bloodMax,player.blood+500);updMedCount();showMsg('Vague '+wave+' terminée !<br><small>+1 de chaque soin · transfusion +500 ml</small>',3.5);}
      }else{betweenT-=dt;if(betweenT<=0)startWave();}
    }else{
      const civ=chars.filter(e=>e.team===2&&e.alive).length;spawnT-=dt;
      if(civ<SET.npcCount&&spawnT<=0&&chars.length<38){spawnCivilian(GT>4);spawnT=GT<4?0.02:rnd(2,5);}
    }
  }
  if(gameOverT>0){gameOverT-=dt;if(gameOverT<=0)gameOver();}
}
