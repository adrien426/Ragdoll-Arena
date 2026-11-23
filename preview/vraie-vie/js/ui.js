"use strict";
/* =====================================================================
   UI : input, camera, HUD, medical menu, inspection (skeleton / organs /
        muscles / skin), settings, game flow, main loop
   ===================================================================== */
const $=id=>document.getElementById(id);
const hud=$('hud'),hx=hud.getContext('2d');let HW=0,HH=0,HD=1;
function resize(){HD=Math.min(2,window.devicePixelRatio||1);HW=innerWidth;HH=innerHeight;hud.width=HW*HD;hud.height=HH*HD;renderer.setSize(HW,HH,false);camera.aspect=HW/HH;camera.updateProjectionMatrix();if(inspTarget)drawInspect();}
addEventListener('resize',resize);
let camAim=0;let paused=false,camYaw=0,camPitch=-0.12,camDir={x:0,y:0,z:1},aimTarget=null,msgT=0,physAcc=0,hbT=0,fxT=0,lampT=0;
const popups=[],FEED=[],SPEECH=[];
function speechAt(c,text){for(let i=SPEECH.length-1;i>=0;i--)if(SPEECH[i].c===c)SPEECH.splice(i,1);SPEECH.push({c,text,t:3.2});if(SPEECH.length>8)SPEECH.shift();}

/* ---------------- messages / popups / feed ---------------- */
const msgEl=$('msg');
function showMsg(t,d){msgEl.innerHTML=t;msgEl.style.opacity=1;msgT=d||2;}
function popupAt(p,text,col,t,line,owner){popups.push({p:{x:p.x,y:p.y+0.3,z:p.z},text,col:col||'#fff',t:t||1.8,max:t||1.8,line:line||0,owner:owner||null});if(popups.length>40)popups.shift();}
const SEV_TXT=['#cfe8cf','#ffe27a','#ffb04a','#ff5a5a','#ff3ca0'];
function tipFor(t){if(/Artère|artère/.test(t))return' → garrot (🎒) !';if(/Poumon|pneumothorax/.test(t))return' → pansement thoracique';if(/Prend feu|EN FEU/.test(t))return' → eau ou roule au sol';if(/Fracture/.test(t)&&/Fémur|Tibia|Humérus|Radius|Ulna/.test(t))return' → attelle';return'';}
function addFeed(t,sev){FEED.push({t:t+(t.startsWith('💀')?'':tipFor(t)),sev,time:GT});if(FEED.length>6)FEED.shift();}
function reportInjuries(c,inj,point){
  if(!inj||!inj.length)return;
  if(!c.isPlayer&&c.alive&&c.conscious&&inj.some(x=>x.sev>=2)&&Math.random()<0.6)say(c,'hurt');
  {const seen=new Set();inj=inj.filter(x=>{if(seen.has(x.t))return false;seen.add(x.t);return true;});}
  const hdr=inj.filter(x=>x.hdr),rest=inj.filter(x=>!x.hdr).sort((a,b)=>b.sev-a.sev);const sorted=hdr.concat(rest);
  if(SET.injuryText&&(c.isPlayer||hdist(c.P[c.pelvis],camera.position)<45)){for(let i=popups.length-1;i>=0;i--)if(popups[i].owner===c&&popups[i].max-popups[i].t<1.2)popups.splice(i,1);const anchor=c.P[c.head];sorted.slice(0,hdr.length?4:3).forEach((it,i)=>popupAt(add(anchor,{x:0,y:0.15,z:0}),it.t,SEV_TXT[clamp(it.sev,0,4)],2.4,2-i,c));}
  if(c.isPlayer)for(const it of sorted.slice(0,4))addFeed(it.t,it.sev);
  else if(c.lastHit===player&&hdr.length&&rest.length)addFeed(hdr[0].t+' : '+rest.slice(0,2).map(x=>x.t).join(' · '),Math.max(...rest.map(x=>x.sev)));
}

/* ---------------- input ---------------- */
const keys={};const joy={id:null,ox:0,oy:0,x:0,y:0},look={id:null,lx:0,ly:0,t0:0,moved:0};
const joyBase=$('joyBase'),joyKnob=$('joyKnob');let locked=false,fireId=null;const fireL={lx:0,ly:0};let jumpBtn=false;
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if(paused)return;const n=parseInt(e.key);if(n>=0&&n<=9){selectWeapon(n===0?9:n-1);}if(k==='r'&&player)player.input.reload=true;if(k==='e')openMed(player);if(k==='i')inspectAim();if(k===' ')e.preventDefault();});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===glc;});
glc.addEventListener('contextmenu',e=>{e.preventDefault();if(!locked)tapInspect(e.clientX,e.clientY);else inspectAim();});
glc.addEventListener('pointerdown',e=>{
  initAudio();if(!running||paused)return;
  if(e.pointerType==='mouse'){if(e.button===2)return;if(!locked){try{const r=glc.requestPointerLock&&glc.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}}
    if(e.button===0&&player)player.input.attack=true;look.id=e.pointerId;look.lx=e.clientX;look.ly=e.clientY;return;}
  if(e.clientX<innerWidth*0.42&&joy.id===null){joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;joy.x=joy.y=0;joyBase.style.display='block';joyBase.style.left=(e.clientX-55)+'px';joyBase.style.top=(e.clientY-55)+'px';joyKnob.style.transform='translate(0,0)';}
  else if(look.id===null){look.id=e.pointerId;look.lx=e.clientX;look.ly=e.clientY;look.t0=performance.now();look.moved=0;}
});
addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'&&locked){if(!paused)rotateCam(e.movementX,e.movementY,1);return;}
  if(e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const l=Math.hypot(dx,dy),m=45;if(l>m){dx*=m/l;dy*=m/l;}joy.x=dx/m;joy.y=-dy/m;joyKnob.style.transform='translate('+dx+'px,'+dy+'px)';}
  else if(e.pointerId===look.id||e.pointerId===fireId){const L=e.pointerId===fireId?fireL:look;const dx=e.clientX-L.lx,dy=e.clientY-L.ly;rotateCam(dx,dy,e.pointerType==='mouse'?1:1.6);L.lx=e.clientX;L.ly=e.clientY;if(L===look)look.moved+=Math.abs(dx)+Math.abs(dy);}
});
const endP=e=>{if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;joyBase.style.display='none';}
  if(e.pointerId===look.id){if(e.pointerType==='mouse'){if(player)player.input.attack=false;}else if(SET.tapInspect&&look.moved<10&&performance.now()-look.t0<300)tapInspect(e.clientX,e.clientY);look.id=null;}};
addEventListener('pointerup',endP);addEventListener('pointercancel',endP);
addEventListener('mouseup',()=>{if(locked&&player)player.input.attack=false;});
function rotateCam(dx,dy,s){camYaw-=dx*0.0045*s*SET.sens;camPitch=clamp(camPitch-dy*0.0035*s*SET.sens,-1.1,0.8);}
const fireBtn=$('fire');
fireBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();initAudio();fireId=e.pointerId;fireL.lx=e.clientX;fireL.ly=e.clientY;fireBtn.classList.add('on');if(player)player.input.attack=true;try{fireBtn.setPointerCapture(e.pointerId);}catch(_){}});
const fireUp=e=>{if(e.pointerId===fireId){fireId=null;fireBtn.classList.remove('on');if(player)player.input.attack=false;}};
fireBtn.addEventListener('pointerup',fireUp);fireBtn.addEventListener('pointercancel',fireUp);
function bindBtn(id,fn){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();initAudio();el.classList.add('on');fn(true);});const up=()=>{el.classList.remove('on');fn(false);};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);}
bindBtn('jump',v=>jumpBtn=v);bindBtn('reload',v=>{if(v&&player)player.input.reload=true;});
bindBtn('medBtn',v=>{if(v)openMed(inspTarget&&inspTarget!==player&&reach(inspTarget)?inspTarget:player);});
bindBtn('inspBtn',v=>{if(v)inspectAim();});
let lastTarget=null,lastTargetT=-99;
bindBtn('tgtBtn',v=>{if(v&&lastTarget){openInspect(lastTarget);inspView='mus';document.querySelectorAll('#iViews button').forEach(x=>x.classList.toggle('on',x.dataset.v==='mus'));drawInspect();}});bindBtn('setBtn',v=>{if(v)openSettings();});
bindBtn('catBtn',v=>{if(v)openCat();});
function openCat(){if(!player||!running)return;paused=true;$('cat').classList.remove('hidden');const L=$('catList');L.innerHTML='';
  for(const e of CATAS){const d=document.createElement('div');d.className='mitem';d.innerHTML='<b>'+e.icon+' '+e.n+'</b><i>'+e.d+'</i>';
    d.onclick=()=>{$('cat').classList.add('hidden');paused=false;initAudio();try{e.f(catTarget());}catch(err){console.error('catastrophe failed',e.k,err);}};L.appendChild(d);}}
function playerInput(){
  const p=player;if(!p)return;
  let fw=joy.y,st=joy.x;
  if(keys['w']||keys['z']||keys['arrowup'])fw+=1;if(keys['s']||keys['arrowdown'])fw-=1;if(keys['a']||keys['q']||keys['arrowleft'])st-=1;if(keys['d']||keys['arrowright'])st+=1;
  const l=Math.hypot(fw,st);if(l>1){fw/=l;st/=l;}
  const f={x:Math.sin(camYaw),z:Math.cos(camYaw)},R={x:-Math.cos(camYaw),z:Math.sin(camYaw)};
  p.input.mx=f.x*fw+R.x*st;p.input.mz=f.z*fw+R.z*st;p.input.jump=!!(keys[' ']||jumpBtn);p.yaw=camYaw;
}
function reach(c){return c===player||(c&&player&&vlen(sub(c.P[c.pelvis],player.P[player.pelvis]))<3.2);}
function tapInspect(sx,sy){
  if(!player)return;const v=new THREE.Vector3((sx/HW)*2-1,-(sy/HH)*2+1,0.5).unproject(camera);
  const o={x:camera.position.x,y:camera.position.y,z:camera.position.z};const d=norm({x:v.x-o.x,y:v.y-o.y,z:v.z-o.z});
  const h=rayCast(o,d,90,null,null);if(h.c)openInspect(h.c);
}
function inspectAim(){if(!player)return;if(aimTarget&&aimTarget.c){openInspect(aimTarget.c);return;}let best=null,bd=6;for(const c of chars){if(c===player)continue;const d=vlen(sub(c.P[c.pelvis],player.P[player.pelvis]));if(d<bd){bd=d;best=c;}}openInspect(best||player);}

/* ---------------- weapons bar ---------------- */
const wbar=$('weapons');const WSHORT=['Poings','Couteau','Batte','Taser','Pistolet','Katana','Pompe','Molotov','Fusil AR','Sniper','Brique','Grenade','Machette','Hache','Marteau','Pied-biche'];
function buildWeaponBar(){wbar.innerHTML='';WEAPONS.forEach((w,i)=>{const d=document.createElement('div');const lk=!weaponUnlocked(i);d.className='w'+(player&&player.weapon===i?' sel':'')+(lk?' lock':'');d.innerHTML='<b>'+(lk?'🔒':w.icon)+'</b>'+(lk?w.unlock+' kills':WSHORT[i]);d.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();initAudio();selectWeapon(i);});wbar.appendChild(d);});}
function selectWeapon(i){if(!player||i<0||i>=WEAPONS.length||!weaponUnlocked(i))return;player.weapon=i;player.swing=-1;player.cd=0.25;player.reloadT=0;buildWeaponBar();}

/* ---------------- camera & aim ---------------- */
function updateCamera(){
  const p=player;camDir={x:Math.sin(camYaw)*Math.cos(camPitch),y:Math.sin(camPitch),z:Math.cos(camYaw)*Math.cos(camPitch)};
  const R={x:-Math.cos(camYaw),y:0,z:Math.sin(camYaw)};
  const ch=p.P[p.chest],nk=p.P[p.neck];const awake=p.alive&&p.conscious;
  const aimC=awake&&p._aimT>GT;camAim+=((aimC?1:0)-camAim)*0.12;   // over-the-shoulder zoom while firing
  let tgt=awake?add(add(lerp3(ch,nk,0.6),mul(R,0.52+camAim*0.2)),{x:0,y:0.22,z:0}):add(ch,{x:0,y:0.7,z:0});
  const back=mul(camDir,-1);let dist=awake?2.4-camAim*0.6:3.8;
  for(const b of boxesNear(tgt.x,tgt.z,5)){const d=rayBox(tgt,back,b);if(d!==null&&d<dist)dist=Math.max(0.3,d-0.15);}
  const td=rayTerrain(tgt,back,dist);if(td!==null)dist=Math.max(0.3,td-0.2);
  const pos=add(tgt,mul(back,dist));const th=terrainH(pos.x,pos.z);if(pos.y<th+0.2)pos.y=th+0.2;
  camera.position.lerp(new THREE.Vector3(pos.x,pos.y,pos.z),0.5);
  camera.lookAt(camera.position.x+camDir.x,camera.position.y+camDir.y,camera.position.z+camDir.z);
  const dz=p.alive?p.dizzy:0;if(dz>10)camera.rotateZ(Math.sin(GT*1.3)*dz*0.0018);
  if(SHAKE>0.01){camera.rotateX(rnd(-1,1)*SHAKE*0.018);camera.rotateY(rnd(-1,1)*SHAKE*0.018);camera.rotateZ(rnd(-1,1)*SHAKE*0.01);}
  if(p.shiver>0&&p.alive){camera.rotateX(rnd(-1,1)*p.shiver*0.003);camera.rotateY(rnd(-1,1)*p.shiver*0.003);}
  if(awake){const o=add({x:camera.position.x,y:camera.position.y,z:camera.position.z},mul(camDir,1.5));const h=rayCast(o,camDir,160,p,null);p.aimP=h.point;aimTarget=h.c?h:null;}else aimTarget=null;
  sun.position.set(ch.x+16,ch.y+32,ch.z+10);sun.target.position.set(ch.x,ch.y,ch.z);sun.target.updateMatrixWorld();
  sky.position.copy(camera.position);stars.position.copy(camera.position);
  if(SET.night){
    torch.intensity=1.7;torch.position.set(camera.position.x+R.x*0.3,camera.position.y-0.15,camera.position.z+R.z*0.3);torch.target.position.set(camera.position.x+camDir.x*10,camera.position.y+camDir.y*10,camera.position.z+camDir.z*10);torch.target.updateMatrixWorld();
    lampT-=1/60;if(lampT<=0){lampT=0.5;const s=LAMPS.slice().sort((a,b)=>hdist(a,camera.position)-hdist(b,camera.position));for(let i=0;i<lampLights.length;i++){const L=s[i];if(L){lampLights[i].position.set(L.x,L.y-0.3,L.z);lampLights[i].intensity=1.5;}else lampLights[i].intensity=0;}}
  }
}

/* ---------------- HUD ---------------- */
const pv=new THREE.Vector3();let lastFilter='';
function regionWorst(c,r){let s=0;for(const b of BONES)if(b.region===r&&c.boneSt[b.id]>=2)s=Math.max(s,3);for(const w of c.wounds)if(w.reg===r&&w.cur>0.3)s=Math.max(s,w.art>0?4:2);if(c.burn[r].deg>=2)s=Math.max(s,3);if(c.bruise[r]>0.3)s=Math.max(s,1);for(const m of MUSCLES)if(m.region===r&&c.mus[m.id]<75)s=Math.max(s,c.mus[m.id]<15?3:2);return s;}
const MINI={head:['c',0,-62,7],neck:['l',0,-55,0,-50,4],thorax:['l',0,-50,0,-36,11],abdomen:['l',0,-36,0,-24,10],pelvis:['l',0,-24,0,-18,11],
  uarmR:['l',-6,-49,-11,-36,4],larmR:['l',-11,-36,-14,-23,3.5],handR:['c',-14.5,-20,2.5],uarmL:['l',6,-49,11,-36,4],larmL:['l',11,-36,14,-23,3.5],handL:['c',14.5,-20,2.5],
  thighR:['l',-4,-18,-5,-2,5],shinR:['l',-5,-2,-5,14,4],footR:['l',-5,15,-8,17,3],thighL:['l',4,-18,5,-2,5],shinL:['l',5,-2,5,14,4],footL:['l',5,15,8,17,3]};
function drawMini(c,ox,oy){hx.lineCap='round';for(const r in MINI){const m=MINI[r];const col=SEV_COL[regionWorst(c,r)];hx.strokeStyle=col;hx.fillStyle=col;if(m[0]==='c'){hx.beginPath();hx.arc(ox+m[1],oy+m[2],m[3],0,7);hx.fill();}else{hx.lineWidth=m[5];hx.beginPath();hx.moveTo(ox+m[1],oy+m[2]);hx.lineTo(ox+m[3],oy+m[4]);hx.stroke();}}
  if(c.burning>0){hx.font='12px sans-serif';hx.fillText('🔥',ox-6,oy-40);}}
function vitCol(v,lo,hi){return v<lo||v>hi?'#ff6a6a':'#e8e8e8';}
function overheadIcons(c){const a=[];if(!c.alive)return'💀';if(c.arrest)a.push('💔');else if(!c.conscious)a.push('😵');if(c.burning>0)a.push('🔥');const b=c.extBleed+c.intBleed;if(b>8)a.push('🩸🩸');else if(b>1.5)a.push('🩸');
  let fr=false;for(let i=0;i<BONES.length;i++)if(c.boneSt[i]>=2){fr=true;break;}if(fr)a.push('🦴');if(c.tasedT>0)a.push('⚡');else if(c.dizzy>20&&c.conscious)a.push('💫');if(c.temp<35)a.push('❄️');if(c.temp>39.5)a.push('🥵');if(c.headUnder||c.lungWater>60)a.push('🌊');if(c.gasDose>0.5)a.push('☠️');if(c.spo2<88&&c.alive)a.push('🫁');if(c.tbsa>=1&&c.burning<=0)a.push('♨️'+Math.round(c.tbsa)+'%');return a.join('');}
function drawHUD(dt){
  hx.setTransform(HD,0,0,HD,0,0);hx.clearRect(0,0,HW,HH);
  const p=player;if(!p)return;
  // screen filter (blood loss, concussion, hypoxia, cold)
  let blur=0,sat=1,bri=1;
  if(p.alive){blur=clamp(p.dizzy/30,0,2.2)+(p.spo2<85?(85-p.spo2)/12:0);sat=clamp(1-p.lossF*1.6,0.25,1);if(p.spo2<85)bri=clamp(1-(85-p.spo2)/60,0.5,1);if(p.temp<33)blur+=0.8;}
  const fs=(blur>0.15?'blur('+blur.toFixed(1)+'px) ':'')+(sat<0.97?'saturate('+sat.toFixed(2)+') ':'')+(bri<0.97?'brightness('+bri.toFixed(2)+')':'');
  if(fs!==lastFilter){glc.style.filter=fs||'none';lastFilter=fs;}
  // overlays
  if(camera.position.y<waterLevel(camera.position.x,camera.position.z)){hx.fillStyle='rgba(20,70,90,.55)';hx.fillRect(0,0,HW,HH);}
  if(FLASH>0.02){hx.fillStyle='rgba(255,255,250,'+clamp(FLASH,0,1)+')';hx.fillRect(0,0,HW,HH);}
  if(hurtFlash>0){hx.fillStyle='rgba(160,0,0,'+hurtFlash*0.45+')';hx.fillRect(0,0,HW,HH);}
  if(p.alive&&(p.lossF>0.15||p.spo2<90)){const a=clamp(Math.max((p.lossF-0.15)*2.2,(90-p.spo2)/30),0,0.75);const rg=hx.createRadialGradient(HW/2,HH/2,HH*0.25,HW/2,HH/2,HH*0.85);rg.addColorStop(0,'rgba(40,0,0,0)');rg.addColorStop(1,'rgba(40,0,0,'+a+')');hx.fillStyle=rg;hx.fillRect(0,0,HW,HH);}
  if(p.alive&&p.temp<35.6){const a=clamp((35.6-p.temp)/4,0,0.55);const rg=hx.createRadialGradient(HW/2,HH/2,HH*0.35,HW/2,HH/2,HH*0.95);rg.addColorStop(0,'rgba(150,200,255,0)');rg.addColorStop(1,'rgba(170,215,255,'+a+')');hx.fillStyle=rg;hx.fillRect(0,0,HW,HH);}
  if(p.burning>0){hx.fillStyle='rgba(255,110,20,'+(0.12+Math.random()*0.1)+')';hx.fillRect(0,0,HW,HH);}
  if(p.alive&&p.org[ORG.eyeR]<40){const g=hx.createLinearGradient(0,0,HW*0.45,0);g.addColorStop(0,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');hx.fillStyle=g;hx.fillRect(0,0,HW*0.45,HH);}
  if(p.alive&&p.org[ORG.eyeL]<40){const g=hx.createLinearGradient(HW,0,HW*0.55,0);g.addColorStop(0,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');hx.fillStyle=g;hx.fillRect(HW*0.55,0,HW*0.45,HH);}
  if(p.alive&&p.painEff>60){hx.strokeStyle='rgba(255,0,0,'+((p.painEff-60)/100*(0.6+0.4*Math.sin(GT*6)))+')';hx.lineWidth=18;hx.strokeRect(0,0,HW,HH);}
  // overhead labels & popups
  hx.textAlign='center';
  if(SET.labels){hx.font='13px sans-serif';for(const c of chars){if(c===p)continue;const hp=c.P[c.head];if(hdist(hp,camera.position)>32)continue;pv.set(hp.x,hp.y+0.32,hp.z).project(camera);if(pv.z>1||Math.abs(pv.x)>1.1||Math.abs(pv.y)>1.1)continue;
    const ic=overheadIcons(c);const sx=(pv.x*0.5+0.5)*HW,sy=(-pv.y*0.5+0.5)*HH;if(ic){hx.fillText(ic,sx,sy);}
    if(c.alive&&c._prog&&c._prog.lvl>=3&&hdist(hp,camera.position)<22){hx.font='bold 10px sans-serif';hx.fillStyle=LVL_COL[c._prog.lvl];hx.fillText((c._prog.lvl>=4?'CRITIQUE':'GRAVE')+' · survie sans soins '+Math.round(c._ps0*100)+'%',sx,sy-15);hx.font='13px sans-serif';}
    if(c.team===1&&c.alive){hx.fillStyle='rgba(255,80,80,.85)';hx.fillRect(sx-3,sy+3,6,3);}hx.fillStyle='#fff';}}
  hx.font='bold 11px sans-serif';
  for(const q of popups){pv.set(q.p.x,q.p.y,q.p.z).project(camera);if(pv.z>1)continue;const sx=(pv.x*0.5+0.5)*HW,sy=(-pv.y*0.5+0.5)*HH-q.line*15;hx.globalAlpha=clamp(q.t/q.max*1.6,0,1);hx.fillStyle='#000';hx.fillText(q.text,sx+1,sy+1);hx.fillStyle=q.col;hx.fillText(q.text,sx,sy);}
  hx.globalAlpha=1;
  hx.font='bold 12px sans-serif';
  for(const q of SPEECH){const c=q.c;if(!c.alive||c===p)continue;const hp=c.P[c.head];pv.set(hp.x,hp.y+0.55,hp.z).project(camera);if(pv.z>1||Math.abs(pv.x)>1.05||Math.abs(pv.y)>1.05)continue;
    const sx=(pv.x*0.5+0.5)*HW,sy=(-pv.y*0.5+0.5)*HH-18;const w=Math.min(240,hx.measureText(q.text).width+14);hx.globalAlpha=clamp(q.t*1.5,0,0.95);
    hx.fillStyle=c.team===1?'#ffe1dc':'#fff';hx.beginPath();if(hx.roundRect)hx.roundRect(sx-w/2,sy-15,w,21,8);else hx.rect(sx-w/2,sy-15,w,21);hx.moveTo(sx-5,sy+6);hx.lineTo(sx,sy+12);hx.lineTo(sx+5,sy+6);hx.fill();
    hx.fillStyle='#111';hx.fillText(q.text,sx,sy,w-8);}
  hx.globalAlpha=1;
  // crosshair
  const cx=HW/2,cy=HH/2,w=WEAPONS[p.weapon];
  if(p.alive&&p.conscious){const gap=(w.type==='gun'?6+w.spread*120:5)+p.aimWob*160;hx.strokeStyle=aimTarget?'#ff4040':'rgba(255,255,255,.85)';hx.lineWidth=2;hx.beginPath();hx.moveTo(cx-gap-7,cy);hx.lineTo(cx-gap,cy);hx.moveTo(cx+gap,cy);hx.lineTo(cx+gap+7,cy);hx.moveTo(cx,cy-gap-7);hx.lineTo(cx,cy-gap);hx.moveTo(cx,cy+gap);hx.lineTo(cx,cy+gap+7);hx.stroke();
    if(aimTarget){const t=aimTarget.c,h=t.H[aimTarget.hi];const reg=(h.split!==undefined&&aimTarget.t>h.split)?h.reg2:h.reg;hx.fillStyle='#fff';hx.font='bold 11px sans-serif';let zn=REGIONS[reg].n;try{zn=hitZone(t,reg,aimTarget.point).n;}catch(e){}hx.fillText((t===p?'':t.name+' — ')+zn+' · '+vlen(sub(t.P[t.pelvis],p.P[p.pelvis])).toFixed(0)+' m',cx,cy+30);}
    if(hitMarker>0){hx.strokeStyle='#fff';hx.lineWidth=2;hx.beginPath();for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]]){hx.moveTo(cx+a*6,cy+b*6);hx.lineTo(cx+a*12,cy+b*12);}hx.stroke();}}
  hx.textAlign='left';
  // vitals panel
  hx.fillStyle='rgba(0,0,0,.55)';hx.fillRect(6,6,160,184);
  const st=stateLabel(p);hx.font='bold 12px sans-serif';hx.fillStyle=st==='Conscient'?'#8f8':'#ff6a6a';hx.fillText(st,12,21);
  hx.font='11px sans-serif';const L=[
    ['❤️ '+(p.alive?Math.round(p.hr):0)+' bpm',vitCol(p.hr,50,120)],['🩸 TA '+Math.round(p.sbp)+'/'+Math.round(p.dbp),vitCol(p.sbp,90,160)],['🫁 SpO₂ '+Math.round(p.spo2)+' %  FR '+Math.round(p.rr),vitCol(p.spo2,94,101)],
    ['🌡️ '+p.temp.toFixed(1)+' °C',vitCol(p.temp,35.9,38.2)],['💧 '+(p.blood/1000).toFixed(2)+' L'+((p.extBleed+p.intBleed)>0.4?'  −'+(p.extBleed+p.intBleed).toFixed(0)+' ml/s':''),(p.extBleed+p.intBleed)>0.4?'#ff6a6a':'#e8e8e8'],
    ['⚡ Douleur '+Math.round(p.painEff)+' %',p.painEff>50?'#ffb04a':'#e8e8e8'],['🧠 Glasgow '+p.gcs,p.gcs<14?'#ff6a6a':'#e8e8e8']];
  L.forEach((l,i)=>{hx.fillStyle=l[1];hx.fillText(l[0],12,38+i*15);});
  hx.fillStyle='#300';hx.fillRect(12,146,96,6);hx.fillStyle=p.lossF>0.15?'#f44':'#c11';hx.fillRect(12,146,96*clamp(1-p.lossF/0.5,0,1),6);
  const flags=[];if(p.burning>0)flags.push('🔥');if(p.collapse[0]>0.05||p.collapse[1]>0.05)flags.push('Pneumothorax');if(p.concussion>15)flags.push('Commotion');if(p.temp<35)flags.push('Hypothermie');if(!p.canStand&&p.alive)flags.push('Au sol');else if(p.support<0.8)flags.push('Boite');
  let fr=0;for(let i=0;i<BONES.length;i++)if(p.boneSt[i]>=2)fr++;if(fr)flags.push(fr+' fracture'+(fr>1?'s':''));
  hx.fillStyle='#ffb04a';hx.font='10px sans-serif';hx.fillText(flags.join(' · ').slice(0,34),12,166);hx.fillText(flags.join(' · ').slice(34,68),12,179);
  drawMini(p,140,90);
  // feed
  let fy=206;hx.font='11px sans-serif';for(const f of FEED){const age=GT-f.time;if(age>8)continue;hx.globalAlpha=clamp((8-age)/2,0,1);hx.fillStyle='rgba(0,0,0,.5)';const tw=hx.measureText(f.t).width;hx.fillRect(6,fy-11,Math.min(tw+10,HW*0.45),15);hx.fillStyle=SEV_TXT[clamp(f.sev,0,4)];hx.fillText(f.t,11,fy);fy+=17;}hx.globalAlpha=1;
  // top right
  hx.fillStyle='rgba(0,0,0,.55)';hx.fillRect(HW-122,6,116,62);hx.fillStyle='#fff';hx.font='bold 12px sans-serif';
  hx.fillText(SET.pvp?'PvP · Vague '+wave:'Bac à sable',HW-116,22);hx.font='11px sans-serif';hx.fillText((MAP?MAP.label:'')+' · '+SET.temp+' °C'+(SET.rain?(SNOW?' ❄':' 🌧'):'')+(SET.night?' 🌙':''),HW-116,38);
  hx.fillText('💀 '+kills+(SET.pvp?'  · total '+totalKills:''),HW-116,54);
  // target panel (other person's damage)
  if(aimTarget&&aimTarget.c&&aimTarget.c!==p){lastTarget=aimTarget.c;lastTargetT=GT;}
  if(lastTarget&&(!chars.includes(lastTarget)||GT-lastTargetT>25))lastTarget=null;
  $('tgtBtn').classList.toggle('hidden',!lastTarget);
  if(lastTarget){const t=lastTarget,x0=HW-122,y0=72;hx.fillStyle='rgba(0,0,0,.6)';hx.fillRect(x0,y0,116,132);
    hx.font='bold 11px sans-serif';hx.fillStyle='#fc3';hx.fillText('🎯 '+t.name+', '+t.age+' ans'+(t.team===1?' ⚔':''),x0+5,y0+13,108);
    const pr=t._prog||prognosis(t);hx.font='bold 9px sans-serif';hx.fillStyle=LVL_COL[pr.lvl];hx.fillText(LVL_TXT[pr.lvl].replace(' – VA MOURIR',''),x0+5,y0+26,108);
    const tb=t.extBleed+t.intBleed;hx.fillStyle=tb>0.4?'#ff7070':'#ddd';hx.fillText('🩸 '+(t.blood/1000).toFixed(2)+' L'+(tb>0.4?' −'+tb.toFixed(0)+' ml/s':''),x0+5,y0+39,80);
    let fr=0;for(let i=0;i<BONES.length;i++)if(t.boneSt[i]>=2)fr++;let mu=0;for(let i=0;i<MUSCLES.length;i++)if(t.mus[i]<75)mu++;
    hx.fillStyle='#ddd';hx.fillText('❤️'+Math.round(t.hr)+' 🦴'+fr+' 💪'+mu+' 🩹'+t.wounds.length,x0+5,y0+52,80);
    drawMini(t,x0+88,y0+86);
    hx.font='9px sans-serif';hx.fillStyle='#ddd';hx.fillText(stateLabel(t).slice(0,16),x0+5,y0+65,80);
    if(t.alive){const ps=t._ps!==undefined?t._ps:survival(t).ps,p0=t._ps0!==undefined?t._ps0:ps;hx.fillStyle=p0<0.3?'#ff6a6a':p0<0.7?'#ffb04a':'#8f8';hx.fillText('Survie : '+Math.round(p0*100)+' %',x0+5,y0+78,80);hx.fillStyle='#aaa';hx.fillText('si soigné : '+Math.round(ps*100)+' %',x0+5,y0+90,80);}
    const pl=plainProblems(t)[0];if(pl){hx.fillStyle='#ffb04a';hx.fillText(pl.split(':')[0].slice(0,22),x0+5,y0+103,108);}}
  // ammo
  if(w.mag){hx.font='bold 14px sans-serif';hx.fillStyle=p.reloadT>0?'#fc3':'#fff';hx.textAlign='right';hx.fillText(p.reloadT>0?'Recharge…':p.ammo[p.weapon]+' / '+w.mag,HW-18,HH-122);hx.textAlign='left';}
  // unconscious / arrest overlay
  if(p.alive&&(!p.conscious||p.arrest)){hx.fillStyle='rgba(0,0,0,'+(p.arrest?0.94:0.88)+')';hx.fillRect(0,0,HW,HH);hx.textAlign='center';hx.fillStyle=p.arrest?'#ff4040':'#ddd';hx.font='bold 20px sans-serif';
    hx.fillText(p.arrest?'ARRÊT CARDIAQUE':'Vous êtes inconscient…',HW/2,HH/2-20);hx.font='13px sans-serif';hx.fillStyle='#aaa';
    hx.fillText('Glasgow '+p.gcs+' · SpO₂ '+Math.round(p.spo2)+' % · TA '+Math.round(p.sbp)+'/'+Math.round(p.dbp)+' · '+p.temp.toFixed(1)+' °C',HW/2,HH/2+6);
    hx.fillText(medSummary(p).slice(0,2).map(x=>x.t).join(' · '),HW/2,HH/2+26);hx.textAlign='left';}
}

/* ---------------- medical menu ---------------- */
let medTarget=null;
function updMedCount(){$('medBtn').innerHTML='🎒';}
function openMed(t){if(!player||!running)return;medTarget=t||player;paused=true;$('med').classList.remove('hidden');renderMed('');}
function renderMed(msg){
  const t=medTarget;$('medTarget').textContent='→ '+(t===player?'vous-même':t.name+' ('+stateLabel(t)+')');
  const list=$('medList');list.innerHTML='';const fa=firstAid(t);if(fa.length){const d=document.createElement('div');d.style.cssText='color:#bfe9ff;font-size:12px;margin:2px 0 6px;line-height:1.35';d.innerHTML='<b>Que faire :</b><br>'+fa.slice(0,4).map((a,i)=>(i+1)+'. '+a).join('<br>');list.appendChild(d);}
  for(const it of MED_ITEMS){const d=document.createElement('div');d.className='mitem';const n=SET.infiniteMed||it.unlimited?'∞':INV[it.k];
    d.innerHTML='<b>'+it.icon+' '+it.n+' <span style="color:#fc3">×'+n+'</span></b><i>'+it.d+'</i>';const b=document.createElement('button');b.textContent='Utiliser';b.onclick=()=>{const m=applyItem(it.k,t);renderMed(m||'');if(inspTarget)renderInspect();};d.appendChild(b);list.appendChild(d);}
  const top=medSummary(t).slice(0,3).map(x=>x.t).join(' · ');$('medMsg').textContent=(msg?msg+' — ':'')+top;
}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{const id=b.getAttribute('data-close');$(id).classList.add('hidden');if(id==='insp')inspTarget=null;if(id==='settings'&&!running){$('overlay').style.display='flex';}paused=!$('med').classList.contains('hidden')||!$('insp').classList.contains('hidden')||!$('settings').classList.contains('hidden')||!$('cat').classList.contains('hidden');}));

/* ---------------- inspection ---------------- */
let inspTarget=null,inspView='skel',inspTab='sum',TAPS=[],IC=null;
const iCan=$('iCan'),ix=iCan.getContext('2d');
function openInspect(c){if(!c)return;inspTarget=c;paused=true;$('insp').classList.remove('hidden');renderInspect();}
$('iSelf').onclick=()=>{if(player)openInspect(player);};
$('iMed').onclick=()=>{if(!inspTarget)return;if(!reach(inspTarget)){$('iTip').textContent='Trop loin pour soigner (approche-toi à moins de 3 m).';return;}openMed(inspTarget);};
document.querySelectorAll('#iViews button').forEach(b=>b.onclick=()=>{inspView=b.dataset.v;document.querySelectorAll('#iViews button').forEach(x=>x.classList.toggle('on',x===b));drawInspect();});
document.querySelectorAll('#iTabs button').forEach(b=>b.onclick=()=>{inspTab=b.dataset.t;document.querySelectorAll('#iTabs button').forEach(x=>x.classList.toggle('on',x===b));renderList();});
const IZ={z:1,px:0,py:0};let iDrag=null;
iCan.addEventListener('pointerdown',e=>{iDrag={x:e.clientX,y:e.clientY,px:IZ.px,py:IZ.py,moved:0};try{iCan.setPointerCapture(e.pointerId);}catch(_){}});
iCan.addEventListener('pointermove',e=>{if(!iDrag)return;const dx=e.clientX-iDrag.x,dy=e.clientY-iDrag.y;iDrag.moved=Math.max(iDrag.moved,Math.abs(dx)+Math.abs(dy));if(IZ.z>1&&iDrag.moved>6){IZ.px=iDrag.px+dx;IZ.py=iDrag.py+dy;drawInspect();}});
iCan.addEventListener('pointerup',e=>{if(!iDrag)return;const moved=iDrag.moved;iDrag=null;if(moved>6)return;const r=iCan.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;let best=null,bd=16;for(const t of TAPS){const d=Math.hypot(t.x-x,t.y-y);if(d<bd){bd=d;best=t;}}if(best){$('iTip').innerHTML=best.html;drawInspect(best);}});
iCan.addEventListener('wheel',e=>{e.preventDefault();setZoom(IZ.z*(e.deltaY<0?1.25:0.8));},{passive:false});
function setZoom(z){IZ.z=clamp(z,1,6);if(IZ.z===1){IZ.px=0;IZ.py=0;}drawInspect();}
$('iZin').onclick=()=>setZoom(IZ.z*1.6);$('iZout').onclick=()=>setZoom(IZ.z/1.6);
function renderInspect(){const c=inspTarget;if(!c)return;$('iName').textContent=(c===player?'Vous':c.name)+(c===player?'':', '+c.age+' ans')+(c.team===1?' · hostile':c.team===2?' · civil':'');
  const st=stateLabel(c);$('iState').innerHTML='<span style="color:'+(st==='Conscient'?'#8f8':'#ff7070')+'">'+st+'</span>';
  $('iVitals').innerHTML=['❤️ <b>'+Math.round(c.hr)+'</b> bpm','🩸 TA <b>'+Math.round(c.sbp)+'/'+Math.round(c.dbp)+'</b>','🫁 SpO₂ <b>'+Math.round(c.spo2)+' %</b>','FR <b>'+Math.round(c.rr)+'</b>/min','🌡️ <b>'+c.temp.toFixed(1)+' °C</b>','💧 <b>'+Math.round(c.blood)+' ml</b> ('+Math.round(c.lossF*100)+' % perdu)','🧠 Glasgow <b>'+c.gcs+'</b>','⚡ Douleur <b>'+Math.round(c.painEff)+' %</b>','🦵 Jambes <b>'+Math.round(c.legFn[0]*100)+'/'+Math.round(c.legFn[1]*100)+' %</b>','💪 Bras <b>'+Math.round(c.armFn[0]*100)+'/'+Math.round(c.armFn[1]*100)+' %</b>'].map(s=>'<span>'+s+'</span>').join('');
  $('iMed').style.display=c.alive?'':'none';drawInspect();renderList();}
function stCol(sev){return SEV_COL[clamp(sev,0,4)];}
function rowHtml(name,txt,sev){return'<div class="row"><span><i class="dot" style="background:'+stCol(sev)+'"></i>'+name+'</span><span style="color:'+(sev?stCol(sev):'#9a9')+'">'+txt+'</span></div>';}
function boneSev(c,i){const s=c.boneSt[i];return s>=3?4:s===2?3:s===1?2:c.bone[i]<95?1:0;}
function boneTxt(c,i){const s=c.boneSt[i];return(s===0&&c.bone[i]<95?'Contusion osseuse':BONE_STATUS[s])+(c.splint[i]?' (attelle)':'');}
function diagCard(c){
  const pr=prognosis(c),S=survival(c),p0=noCare(c,pr,S.ps);const col=LVL_COL[pr.lvl];
  const hyp=c.temp<35?(c.temp<28?'sévère':c.temp<32?'modérée':'légère'):null;
  let h='<div style="border:2px solid '+col+';border-radius:8px;padding:6px 8px;margin-bottom:8px;background:rgba(0,0,0,.35)">';
  h+='<div style="font-weight:800;font-size:15px;color:'+col+'">'+LVL_TXT[pr.lvl]+'</div>';
  h+='<div style="color:#ddd;margin:2px 0">👤 '+c.name+' · '+(c.sex==='M'?'homme':'femme')+' · <b>'+c.age+' ans</b> · '+c.weight+' kg · '+c.height+' cm · groupe <b>'+c.bloodType+'</b></div>';
  if(c.alive){
    const bar=(v,l)=>'<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:118px">'+l+'</span><div style="flex:1;height:9px;background:#333;border-radius:4px;overflow:hidden"><div style="width:'+Math.round(v*100)+'%;height:100%;background:'+(v<0.3?'#ff4a4a':v<0.7?'#ffa53a':'#5fd35f')+'"></div></div><b style="width:40px;text-align:right">'+Math.round(v*100)+' %</b></div>';
    h+=bar(p0,'Survie sans soins')+bar(S.ps,'Survie si hôpital');
    h+='<div style="color:#999;font-size:10px">Calcul TRISS (ISS '+S.iss+', RTS '+S.rts.toFixed(2)+(c.age>=55?', âge ≥ 55':'')+(S.baux?', Baux brûlure '+S.baux:'')+')</div>';
    h+='<div style="margin-top:4px;color:'+col+'"><b>⏱ '+pr.txt+'</b></div>';
    h+='<div style="color:#ccc;margin-top:3px">❤️ '+Math.round(c.hr)+'/min · TA '+Math.round(c.sbp)+'/'+Math.round(c.dbp)+' · 🫁 '+Math.round(c.rr)+'/min · SpO₂ '+Math.round(c.spo2)+' % · 🌡 '+c.temp.toFixed(1)+' °C'+(hyp?' (<b style="color:#8cf">hypothermie '+hyp+'</b>)':'')+' · 🧠 Glasgow '+c.gcs+'/15 · 🩸 '+(c.blood/1000).toFixed(2)+' / '+(c.bloodMax/1000).toFixed(2)+' L</div>';}
  const P=plainProblems(c);if(P.length){h+='<div style="margin-top:6px;font-weight:700">Ce qu\'il a :</div>';for(const l of P)h+='<div style="margin:1px 0 1px 4px">'+l+'</div>';}
  const A=firstAid(c);if(A.length){h+='<div style="margin-top:6px;font-weight:700;color:#7fd8ff">Que faire :</div>';A.forEach((a,i)=>h+='<div style="margin:1px 0 1px 4px;color:#bfe9ff">'+(i+1)+'. '+a+'</div>');}
  return h+'</div>';}
function renderList(){
  const c=inspTarget;if(!c)return;const el=$('iList');let h='';
  if(inspTab==='sum'){h+=diagCard(c);for(const s of medSummary(c))h+=rowHtml(s.t,'',s.sev);
    let nb=0;for(let i=0;i<BONES.length;i++)if(c.boneSt[i]>0||c.bone[i]<95)nb++;let no=0;for(let i=0;i<ORGANS.length;i++)if(organStatus(c,i)[1]>0)no++;let nm=0;for(let i=0;i<MUSCLES.length;i++)if(c.mus[i]<95)nm++;
    h+='<div style="margin-top:6px;color:#aaa">Bilan : '+nb+' os / 206 atteints · '+no+' organes ou vaisseaux / '+ORGANS.length+' · '+nm+' muscles / '+MUSCLES.length+'</div>';}
  else if(inspTab==='bones'){const groups={};for(const b of BONES){(groups[b.group]=groups[b.group]||[]).push(b);}
    for(const g in groups){const L=groups[g];const hurt=L.filter(b=>boneSev(c,b.id)>0);h+='<details'+(hurt.length?' open':'')+'><summary>'+g+' ('+L.length+')'+(hurt.length?' – <span style="color:#ff8a1f">'+hurt.length+' atteint(s)</span>':' – intacts')+'</summary>';
      for(const b of L.slice().sort((a,b2)=>boneSev(c,b2.id)-boneSev(c,a.id)))h+=rowHtml(b.name,boneTxt(c,b.id),boneSev(c,b.id));h+='</details>';}}
  else if(inspTab==='orgs'){const groups={};for(const o of ORGANS)(groups[o.group]=groups[o.group]||[]).push(o);
    for(const g in groups){const L=groups[g];const hurt=L.filter(o=>organStatus(c,o.id)[1]>0);h+='<details'+(hurt.length?' open':'')+'><summary>'+g+' ('+L.length+')'+(hurt.length?' – <span style="color:#ff8a1f">'+hurt.length+' atteint(s)</span>':'')+'</summary>';
      for(const o of L){const s=organStatus(c,o.id);let extra='';if(c.intB[o.key])extra=' · '+c.intB[o.key].rate.toFixed(1)+' ml/s';h+=rowHtml(o.name,s[0]+(s[1]&&!o.vessel?' ('+Math.round(c.org[o.id])+' %)':'')+extra,s[1]);}h+='</details>';}}
  else if(inspTab==='mus'){const groups={};for(const m of MUSCLES)(groups[m.group]=groups[m.group]||[]).push(m);
    for(const g in groups){const L=groups[g];const hurt=L.filter(m=>c.mus[m.id]<95);h+='<details'+(hurt.length?' open':'')+'><summary>'+g+' ('+L.length+')'+(hurt.length?' – <span style="color:#ff8a1f">'+hurt.length+' atteint(s)</span>':'')+'</summary>';
      for(const m of L){const s=muscleStatus(c.mus[m.id],m.key);h+=rowHtml(m.name,s[0]+(s[1]?' ('+Math.round(c.mus[m.id])+' %)':''),s[1]);}h+='</details>';}}
  else if(inspTab==='blood'){const R=bloodReport(c);const pct=c.blood/c.bloodMax*100;
    h+='<div class="big">🩸 '+(c.blood/1000).toFixed(2)+' L sur '+(c.bloodMax/1000).toFixed(2)+' L ('+Math.round(pct)+' %)</div>';
    h+='<div class="bbar"><i style="width:'+clamp(pct,0,100)+'%"></i><b style="left:85%"></b><b style="left:70%"></b><b style="left:60%"></b><b style="left:50%"></b></div><div class="bscale"><span style="left:50%">mort</span><span style="left:60%">critique</span><span style="left:70%">grave</span><span style="left:85%">modéré</span></div>';
    h+=rowHtml('Volume normal',(c.bloodMax/1000).toFixed(2)+' L (≈ 70 ml/kg, '+R.kg+' kg)',0);
    h+=rowHtml('Sang perdu',Math.round(R.lost)+' ml ('+Math.round(c.lossF*100)+' %) – choc '+shockClass(c.lossF),c.lossF>0.3?4:c.lossF>0.15?3:c.lossF>0.05?2:0);
    h+=rowHtml('Débit total',R.tot.toFixed(1)+' ml/s = '+(R.tot*60).toFixed(0)+' ml/min',R.tot>10?4:R.tot>2?3:R.tot>0.05?2:0);
    h+=rowHtml('Externe / interne',c.extBleed.toFixed(1)+' / '+c.intBleed.toFixed(1)+' ml/s'+(c.tbsa>0?' · plasma (brûlures) '+(c.tbsa*0.06).toFixed(1):''),c.intBleed>2?3:0);
    h+=rowHtml('Tendance',R.trend,R.trend.startsWith('Ne')?4:R.trend.startsWith('Ral')?2:0);
    if(R.toDeath!==null)h+=rowHtml('Sans soins','état critique dans ~'+fmtT(R.toCrit)+' · mort dans ~'+fmtT(R.toDeath),R.toDeath<120?4:3);
    h+=rowHtml('Pouls / tension',Math.round(c.hr)+' bpm · '+Math.round(c.sbp)+'/'+Math.round(c.dbp)+' mmHg',c.sbp<90?3:0);
    h+='<div style="margin:8px 0 2px;font-weight:600">Où il saigne</div>';let any=false;
    for(const w of c.wounds){if(w.lost<1&&w.cur<0.03)continue;any=true;const st=woundBleedStatus(c,w);h+=rowHtml(w.type+' – '+REGIONS[w.reg].n+(w.artKey?' ('+ORGANS[ORG[w.artKey]].name+')':''),w.cur.toFixed(1)+' ml/s · perdu '+Math.round(w.lost)+' ml<br><small>'+st[0]+'</small>',st[1]);}
    for(const k in c.intB){any=true;const b=c.intB[k];const st=intBleedStatus(k,b);h+=rowHtml('Interne – '+b.name,(b.cap&&b.lost>=b.cap?0:b.rate*clamp(c.sbp/115,0.1,1.15)).toFixed(1)+' ml/s · perdu '+Math.round(b.lost)+' ml<br><small>'+st[0]+'</small>',st[1]);}
    if(!any)h+='<div style="color:#9a9">Aucun saignement.</div>';
    let soak=0;for(const r of REG_KEYS)soak+=c.soak[r];h+='<div style="margin-top:6px;color:#aaa">Sang sur les vêtements et la peau : ~'+Math.round(soak)+' ml</div>';}
  else{if(!c.wounds.length)h+='<div style="color:#9a9">Aucune plaie.</div>';
    for(const w of c.wounds.slice().reverse()){const sev=w.art>0&&w.cur>0.3?4:w.cur>2?3:w.cur>0.3?2:1;h+=rowHtml(w.type+' – '+REGIONS[w.reg].n+(w.artKey?' ('+ORGANS[ORG[w.artKey]].name+')':''),(w.limb&&c.tq[w.limb]?'garrot':w.bandaged?'pansée':'')+' '+w.cur.toFixed(1)+' ml/s',sev);}
    for(const r of REG_KEYS){const b=c.burn[r];if(b.deg>0)h+=rowHtml('Brûlure '+b.deg+'e degré – '+REGIONS[r].n,Math.round(b.area*100)+' % de la zone',b.deg+1);if(c.bruise[r]>0.15)h+=rowHtml('Hématome / ecchymose – '+REGIONS[r].n,Math.round(c.bruise[r]*100)+' %',1);if(c.soak[r]>30&&KIND_BASE[r]!=='skin')h+=rowHtml('Vêtement imbibé de sang – '+REGIONS[r].n,Math.round(c.soak[r])+' ml',1);}
    for(const k in c.intB){const b=c.intB[k];h+=rowHtml('Saignement interne – '+b.name,b.rate.toFixed(1)+' ml/s · '+Math.round(b.lost)+' ml',3);}}
  el.innerHTML=h;
}
/* --- body drawings --- */
function fig(x,h){return[IC.cx-x*IC.s*IC.m,IC.top+(1.82-h)*IC.s];}
let SKEL=null;
function buildSkel(){
  const E=[];const A=(keys,type,d)=>E.push({ids:keys.map(k=>BONE_IDX[k]),type,d});
  A(['occipital','sphenoid','ethmoid'],'ell',{x:0,h:1.66,rx:0.028,ry:0.018,ghost:true});
  for(let i=1;i<=12;i++)A(['T'+i],'rect',{x:0,h:1.432-(i-1)*0.0187,w:0.03,hh:0.014,ghost:true});
  for(const [s,sg] of [['R',1],['L',-1]]){
    A(['scapula'+s],'poly',{pts:[[sg*0.07,1.445],[sg*0.165,1.445],[sg*0.1,1.3]],ghost:true});
    A(['parietal'+s],'ell',{x:sg*0.052,h:1.7,rx:0.032,ry:0.05});A(['temporal'+s],'ell',{x:sg*0.074,h:1.645,rx:0.016,ry:0.032});
    A(['zygomatic'+s],'ell',{x:sg*0.055,h:1.603,rx:0.02,ry:0.011});A(['maxilla'+s],'ell',{x:sg*0.02,h:1.577,rx:0.02,ry:0.015});
    A(['nasal'+s],'line',{x1:sg*0.003,h1:1.622,x2:sg*0.009,h2:1.598,w:2.2});A(['lacrimal'+s],'dot',{x:sg*0.017,h:1.627,r:0.0045});
    A(['palatine'+s],'dot',{x:sg*0.01,h:1.563,r:0.004});A(['concha'+s],'dot',{x:sg*0.008,h:1.59,r:0.004});A(['malleus'+s,'incus'+s,'stapes'+s],'dot',{x:sg*0.092,h:1.632,r:0.006});
    for(let i=1;i<=12;i++){const y0=1.425-(i-1)*0.0195;const wi=(0.07+0.085*Math.sin(Math.min(i,8)/8*Math.PI/2))*(i>10?0.75:1);A(['rib'+s+i],'rib',{sg,y0,wi});}
    A(['clavicle'+s],'line',{x1:sg*0.016,h1:1.45,x2:sg*0.17,h2:1.468,w:3});
    A(['humerus'+s],'line',{x1:sg*0.19,h1:1.435,x2:sg*0.235,h2:1.16,w:5});A(['radius'+s],'line',{x1:sg*0.248,h1:1.14,x2:sg*0.3,h2:0.905,w:3});A(['ulna'+s],'line',{x1:sg*0.229,h1:1.15,x2:sg*0.278,h2:0.9,w:3});
    for(const [k,x,h] of [['scaphoid',0.302,0.889],['lunate',0.293,0.892],['triquetrum',0.284,0.891],['pisiform',0.277,0.887],['trapezium',0.306,0.874],['trapezoid',0.298,0.873],['capitate',0.29,0.874],['hamate',0.281,0.873]])A([k+s],'dot',{x:sg*x,h,r:0.0042});
    for(let i=1;i<=5;i++){const x0=0.31-(i-1)*0.008,x1=i===1?0.334:0.316-(i-1)*0.011,h1=i===1?0.835:0.81;A(['mc'+i+s],'line',{x1:sg*x0,h1:0.864,x2:sg*x1,h2:h1,w:2});
      const segs=i===1?['php','phd']:['php','phm','phd'];let px=x1,ph=h1;const dx=i===1?0.012:(x1-x0)*0.5;const Ls=[0.026,0.018,0.014];
      segs.forEach((sp,j)=>{const nx=px+dx*0.6,nh=ph-Ls[j];A([sp+(i-1)+s],'line',{x1:sg*px,h1:ph-0.002,x2:sg*nx,h2:nh,w:1.6});px=nx;ph=nh-0.002;});}
    A(['hip'+s],'ell',{x:sg*0.095,h:0.995,rx:0.068,ry:0.052,rot:sg*0.35});
    A(['femur'+s],'line',{x1:sg*0.1,h1:0.93,x2:sg*0.09,h2:0.535,w:6});A(['patella'+s],'dot',{x:sg*0.09,h:0.52,r:0.014});
    A(['tibia'+s],'line',{x1:sg*0.085,h1:0.5,x2:sg*0.08,h2:0.085,w:5});A(['fibula'+s],'line',{x1:sg*0.116,h1:0.485,x2:sg*0.108,h2:0.09,w:2.5});
    for(const [k,x,h] of [['talus',0.088,0.074],['calcaneus',0.1,0.06],['navicular',0.079,0.062],['cuboid',0.108,0.052],['cuneiform1',0.072,0.05],['cuneiform2',0.082,0.048],['cuneiform3',0.093,0.046]])A([k+s],'dot',{x:sg*x,h,r:k==='calcaneus'?0.009:0.006});
    for(let i=1;i<=5;i++){const x0=0.07+(i-1)*0.009,x1=0.06+(i-1)*0.013;A(['mt'+i+s],'line',{x1:sg*x0,h1:0.042,x2:sg*x1,h2:0.018,w:2});
      const segs=i===1?['pfp','pfd']:['pfp','pfm','pfd'];segs.forEach((sp,j)=>A([sp+(i-1)+s],'dot',{x:sg*x1,h:0.012-j*0.007,r:0.0028}));}
  }
  A(['frontal'],'ell',{x:0,h:1.72,rx:0.07,ry:0.045});A(['vomer'],'line',{x1:0,h1:1.603,x2:0,h2:1.585,w:2});A(['mandible'],'arc',{x:0,h:1.57,rx:0.052,ry:0.046});A(['hyoid'],'arc',{x:0,h:1.516,rx:0.018,ry:0.008});
  for(let i=1;i<=7;i++)A(['C'+i],'rect',{x:0,h:1.508-(i-1)*0.0105,w:0.026,hh:0.008});
  A(['sternum'],'rect',{x:0,h:1.36,w:0.028,hh:0.15});
  for(let i=1;i<=5;i++)A(['L'+i],'rect',{x:0,h:1.205-(i-1)*0.032,w:0.042,hh:0.025});
  A(['sacrum'],'poly',{pts:[[-0.04,1.04],[0.04,1.04],[0,0.95]]});A(['coccyx'],'poly',{pts:[[-0.01,0.948],[0.01,0.948],[0,0.927]]});
  SKEL=E;
}
function shape(ctx,type,d,fill,stroke,lw){
  ctx.lineCap='round';ctx.lineJoin='round';let c=null;
  if(type==='ell'){const [x,y]=fig(d.x,d.h);ctx.beginPath();ctx.ellipse(x,y,d.rx*IC.s,d.ry*IC.s,(d.rot||0)*IC.m,0,7);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}c=[x,y];}
  else if(type==='line'){const a=fig(d.x1,d.h1),b=fig(d.x2,d.h2);ctx.strokeStyle=fill||stroke;ctx.lineWidth=(d.w||2)*IC.s/320;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();c=[(a[0]+b[0])/2,(a[1]+b[1])/2];}
  else if(type==='dot'){const [x,y]=fig(d.x,d.h);ctx.beginPath();ctx.arc(x,y,Math.max(1.5,d.r*IC.s),0,7);ctx.fillStyle=fill;ctx.fill();c=[x,y];}
  else if(type==='rect'){const [x,y]=fig(d.x,d.h);ctx.fillStyle=fill;ctx.fillRect(x-d.w*IC.s/2,y-d.hh*IC.s/2,d.w*IC.s,d.hh*IC.s);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.strokeRect(x-d.w*IC.s/2,y-d.hh*IC.s/2,d.w*IC.s,d.hh*IC.s);}c=[x,y];}
  else if(type==='poly'){ctx.beginPath();d.pts.forEach((p,i)=>{const q=fig(p[0],p[1]);if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();const q=fig(d.pts[0][0]*0.5+d.pts[2][0]*0.5,(d.pts[0][1]+d.pts[2][1])/2);c=q;}
  else if(type==='arc'){const [x,y]=fig(d.x,d.h);ctx.beginPath();ctx.ellipse(x,y,d.rx*IC.s,d.ry*IC.s,0,0.1,Math.PI-0.1);ctx.strokeStyle=fill;ctx.lineWidth=3*IC.s/320;ctx.stroke();c=[x,y+d.ry*IC.s];}
  else if(type==='rib'){const a=fig(d.sg*0.016,d.y0),b=fig(d.sg*(d.wi+0.012),d.y0+0.004),e=fig(d.sg*d.wi*0.97,d.y0-0.048);ctx.strokeStyle=fill;ctx.lineWidth=2*IC.s/320;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(b[0],b[1],e[0],e[1]);ctx.stroke();c=[(a[0]+e[0])/2+(b[0]-a[0])*0.3,(a[1]+e[1])/2];}
  else if(type==='circ'){const [x,y]=fig(d.x,d.h);ctx.beginPath();ctx.arc(x,y,d.r*IC.s,0,7);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}c=[x,y];}
  else if(type==='thick'){const a=fig(d.x1,d.h1),b=fig(d.x2,d.h2);ctx.strokeStyle=fill;ctx.lineWidth=d.w*IC.s;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();c=[(a[0]+b[0])/2,(a[1]+b[1])/2];}
  return c;
}
const SIL=[['circ',{x:0,h:1.66,r:0.1}],['thick',{x1:0,h1:1.56,x2:0,h2:1.46,w:0.08}],['thick',{x1:0,h1:1.42,x2:0,h2:0.98,w:0.3}],['thick',{x1:0,h1:0.98,x2:0,h2:0.9,w:0.32}]];
for(const sg of [1,-1])SIL.push(['thick',{x1:sg*0.19,h1:1.43,x2:sg*0.235,h2:1.16,w:0.085}],['thick',{x1:sg*0.24,h1:1.15,x2:sg*0.29,h2:0.9,w:0.065}],['circ',{x:sg*0.305,h:0.84,r:0.045}],['thick',{x1:sg*0.1,h1:0.93,x2:sg*0.09,h2:0.53,w:0.14}],['thick',{x1:sg*0.09,h1:0.52,x2:sg*0.085,h2:0.08,w:0.1}],['ell',{x:sg*0.095,h:0.04,rx:0.045,ry:0.035}]);
function drawSil(col){for(const s of SIL)shape(ix,s[0],s[1],col);}
const ORG_DRAW=[
  ['brain','ell',{x:0,h:1.69,rx:0.068,ry:0.055},'#e8a0a8'],['brainstem','rect',{x:0,h:1.6,w:0.016,hh:0.035},'#d08890'],
  ['eyeR','dot',{x:0.032,h:1.63,r:0.01},'#fafafa'],['eyeL','dot',{x:-0.032,h:1.63,r:0.01},'#fafafa'],['innerEarR','dot',{x:0.082,h:1.625,r:0.007},'#f0c0c0'],['innerEarL','dot',{x:-0.082,h:1.625,r:0.007},'#f0c0c0'],
  ['cordC','line',{x1:0,h1:1.6,x2:0,h2:1.44,w:2.5},'#f0d040'],['cordT','line',{x1:0,h1:1.44,x2:0,h2:1.2,w:2.5},'#f0d040'],['cordL','line',{x1:0,h1:1.2,x2:0,h2:1.0,w:2.5},'#f0d040'],
  ['trachea','rect',{x:0,h:1.47,w:0.018,hh:0.1},'#d8d0c8'],['esophagus','line',{x1:0.004,h1:1.52,x2:0.004,h2:1.25,w:1.5},'#c89080'],
  ['lungR','ell',{x:0.075,h:1.32,rx:0.06,ry:0.11},'#e89aa0'],['lungL','ell',{x:-0.078,h:1.32,rx:0.055,ry:0.105},'#e89aa0'],
  ['heart','ell',{x:-0.025,h:1.3,rx:0.045,ry:0.05},'#c03040'],
  ['liver','ell',{x:0.06,h:1.2,rx:0.085,ry:0.045},'#7a3020'],['stomach','ell',{x:-0.06,h:1.205,rx:0.05,ry:0.04},'#e0a080'],['spleen','ell',{x:-0.105,h:1.2,rx:0.025,ry:0.035},'#8a2f4a'],['pancreas','ell',{x:-0.01,h:1.165,rx:0.06,ry:0.012},'#e8c080'],
  ['kidneyR','ell',{x:0.065,h:1.13,rx:0.022,ry:0.04},'#9a3a3a'],['kidneyL','ell',{x:-0.065,h:1.13,rx:0.022,ry:0.04},'#9a3a3a'],
  ['colon','ell',{x:0,h:1.065,rx:0.12,ry:0.075},'#c89070'],['smallInt','ell',{x:0,h:1.06,rx:0.08,ry:0.05},'#e8b0a0'],['bladder','dot',{x:0,h:0.95,r:0.026},'#e8d080'],
  ['aorta','line',{x1:-0.012,h1:1.37,x2:-0.012,h2:1.0,w:3},'#e03030'],['venaCava','line',{x1:0.02,h1:1.4,x2:0.02,h2:1.0,w:3},'#4060d0'],
];
for(const [s,sg] of [['R',1],['L',-1]])ORG_DRAW.push(['carotid'+s,'line',{x1:sg*0.022,h1:1.57,x2:sg*0.03,h2:1.44,w:2},'#e03030'],['jugular'+s,'line',{x1:sg*0.036,h1:1.57,x2:sg*0.044,h2:1.44,w:2},'#4060d0'],
  ['subclavian'+s,'line',{x1:sg*0.01,h1:1.42,x2:sg*0.18,h2:1.43,w:2},'#e03030'],['brachial'+s,'line',{x1:sg*0.195,h1:1.41,x2:sg*0.238,h2:1.16,w:2},'#e03030'],['radialA'+s,'line',{x1:sg*0.252,h1:1.13,x2:sg*0.3,h2:0.9,w:1.6},'#e03030'],
  ['radialN'+s,'line',{x1:sg*0.2,h1:1.42,x2:sg*0.255,h2:1.0,w:1.4},'#f0d040'],['medianN'+s,'line',{x1:sg*0.185,h1:1.41,x2:sg*0.28,h2:0.9,w:1.4},'#f0d040'],['ulnarN'+s,'line',{x1:sg*0.178,h1:1.41,x2:sg*0.27,h2:0.9,w:1.4},'#f0d040'],
  ['femoralN'+s,'line',{x1:sg*0.07,h1:0.95,x2:sg*0.075,h2:0.72,w:1.6},'#f0d040'],['peronealN'+s,'line',{x1:sg*0.115,h1:0.53,x2:sg*0.11,h2:0.2,w:1.4},'#f0d040'],['iliac'+s,'line',{x1:sg*0.0,h1:1.0,x2:sg*0.075,h2:0.93,w:2.5},'#e03030'],
  ['femoral'+s,'line',{x1:sg*0.08,h1:0.92,x2:sg*0.082,h2:0.6,w:2.5},'#e03030'],['popliteal'+s,'line',{x1:sg*0.087,h1:0.59,x2:sg*0.085,h2:0.45,w:2},'#e03030'],['sciatic'+s,'line',{x1:sg*0.11,h1:0.95,x2:sg*0.1,h2:0.55,w:2},'#f0d040']);
const MUS_FRONT=[['masseter',0.045,1.57,0.015,0.02],['temporalis',0.07,1.67,0.014,0.025],['scm',0.025,1.5,0.009,0.042],['pectoral',0.075,1.37,0.07,0.045],['deltoid',0.19,1.42,0.035,0.045],['biceps',0.215,1.29,0.025,0.065],['brachialis',0.23,1.19,0.016,0.024],['flexors',0.265,1.04,0.022,0.07],['handm',0.305,0.84,0.018,0.025],['intercostal',0.125,1.3,0.022,0.07],['oblique',0.105,1.12,0.03,0.07],['psoas',0.05,0.99,0.015,0.045],['adductors',0.06,0.8,0.025,0.08],['quad',0.105,0.75,0.04,0.15],['acl',0.09,0.505,0.012,0.012],['mcl',0.07,0.505,0.006,0.014],['lcl',0.11,0.505,0.006,0.014],['ankleLig',0.09,0.07,0.014,0.01],['wristLig',0.29,0.875,0.012,0.008],['rotCuff',0.17,1.44,0.02,0.015],['tibAnt',0.1,0.3,0.018,0.11],['footm',0.095,0.035,0.022,0.015]];
const MUS_BACK=[['trapezius',0.07,1.47,0.07,0.04],['lats',0.11,1.27,0.06,0.09],['triceps',0.215,1.29,0.025,0.07],['extensors',0.265,1.04,0.02,0.07],['gluteMed',0.125,0.99,0.035,0.03],['gluteMax',0.08,0.93,0.07,0.06],['hams',0.1,0.72,0.04,0.14],['gastroc',0.095,0.38,0.035,0.09],['soleus',0.09,0.24,0.025,0.06],['achilles',0.09,0.1,0.009,0.05],['pcl',0.09,0.505,0.012,0.012],['meniscus',0.09,0.49,0.016,0.006]];
const MUS_COL=['#b5473a','#8a4aa0','#ff9a3a','#ff3030','#200000'];
const REG_SHAPE={head:['circ',{x:0,h:1.66,r:0.1}],neck:['thick',{x1:0,h1:1.56,x2:0,h2:1.46,w:0.08}],thorax:['rect',{x:0,h:1.31,w:0.32,hh:0.24}],abdomen:['rect',{x:0,h:1.1,w:0.29,hh:0.18}],pelvis:['rect',{x:0,h:0.95,w:0.32,hh:0.11}]};
for(const [s,sg] of [['R',1],['L',-1]]){REG_SHAPE['uarm'+s]=['thick',{x1:sg*0.19,h1:1.43,x2:sg*0.235,h2:1.16,w:0.085}];REG_SHAPE['larm'+s]=['thick',{x1:sg*0.24,h1:1.15,x2:sg*0.29,h2:0.9,w:0.065}];REG_SHAPE['hand'+s]=['circ',{x:sg*0.305,h:0.84,r:0.045}];
  REG_SHAPE['thigh'+s]=['thick',{x1:sg*0.1,h1:0.93,x2:sg*0.09,h2:0.53,w:0.14}];REG_SHAPE['shin'+s]=['thick',{x1:sg*0.09,h1:0.52,x2:sg*0.085,h2:0.08,w:0.1}];REG_SHAPE['foot'+s]=['ell',{x:sg*0.095,h:0.04,rx:0.045,ry:0.035}];}
function drawInspect(sel){
  const c=inspTarget;if(!c)return;
  const r=iCan.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);iCan.width=Math.max(10,r.width*dpr);iCan.height=Math.max(10,r.height*dpr);
  ix.setTransform(dpr,0,0,dpr,0,0);ix.clearRect(0,0,r.width,r.height);ix.fillStyle='#0d1014';ix.fillRect(0,0,r.width,r.height);
  TAPS=[];const W=r.width,H=r.height;
  const two=inspView==='mus';const s=Math.min(H/1.92,(two?W/2:W)/0.82);
  const setIC=(cx,m)=>{IC={cx:W/2+(cx-W/2)*IZ.z+IZ.px,top:H/2+(H*0.02-H/2)*IZ.z+IZ.py,s:s*IZ.z,m};};
  setIC(two?W*0.27:W/2,1);
  ix.font='10px sans-serif';ix.fillStyle='#888';ix.textAlign='center';
  const lab=(x,txt)=>{ix.fillText(txt,x,H-4);};
  if(inspView==='skel'){
    if(!SKEL)buildSkel();drawSil('#1c232c');
    for(const e of SKEL){let st=0,bad=0,spl=false;for(const id of e.ids){st=Math.max(st,c.boneSt[id]);if(c.bone[id]<95)bad=1;if(c.splint[id])spl=true;}
      const col=st>0?BONE_COL[st]:bad?'#efe7b0':'#e8e0cc';const cc=shape(ix,e.type,e.d,e.d.ghost&&st===0?'rgba(232,224,204,.35)':col,st>=2?'#000':null,1);
      if(spl&&cc){ix.strokeStyle='#4aa3ff';ix.lineWidth=2;ix.beginPath();ix.arc(cc[0],cc[1],6,0,7);ix.stroke();}
      if(cc)TAPS.push({x:cc[0],y:cc[1],html:e.ids.map(id=>'<b>'+BONES[id].name+'</b> : <span style="color:'+stCol(boneSev(c,id))+'">'+boneTxt(c,id)+'</span> ('+Math.round(c.bone[id])+' %)').join('<br>')});}
    lab(W/2,'Vue de face · D = droite du personnage (à gauche)');
  }else if(inspView==='org'){
    drawSil('#1c232c');
    for(const o of ORG_DRAW){const id=ORG[o[0]];const st=organStatus(c,id);let col=o[3];if(st[1]>=4)col=(Math.floor(GT*4)%2)?'#ff0040':'#400010';else if(st[1]===3)col='#ff3030';else if(st[1]===2)col='#ff9a3a';else if(st[1]===1)col='#f5c542';
      const cc=shape(ix,o[1],o[2],col,null);if(cc)TAPS.push({x:cc[0],y:cc[1],html:'<b>'+ORGANS[id].name+'</b> : <span style="color:'+stCol(st[1])+'">'+st[0]+'</span>'+(ORGANS[id].vessel?'':' ('+Math.round(c.org[id])+' %)')+(c.intB[o[0]]?' · saigne '+c.intB[o[0]].rate.toFixed(1)+' ml/s':'')});}
    lab(W/2,'Organes, vaisseaux (rouge/bleu) et nerfs (jaune)');
  }else if(inspView==='mus'){
    for(const [view,list,cx] of [['front',MUS_FRONT,W*0.27],['back',MUS_BACK,W*0.73]]){
      setIC(cx,view==='front'?1:-1);drawSil('#1c232c');
      for(const [k,x,h,rx,ry] of list)for(const [S,sg] of [['R',1],['L',-1]]){const id=MUS_IDX[k+S];if(id===undefined)continue;const st=muscleStatus(c.mus[id],k+S);const cc=shape(ix,'ell',{x:sg*x,h,rx,ry},isLig(k+S)&&st[1]===0?'#d8d0b0':MUS_COL[st[1]],st[1]>=4?'#ff3030':'#000',1);TAPS.push({x:cc[0],y:cc[1],html:'<b>'+MUSCLES[id].name+'</b> : <span style="color:'+stCol(st[1])+'">'+st[0]+'</span> ('+Math.round(c.mus[id])+' %)'});}
      if(view==='front'){for(const k of ['rectus'])shape(ix,'ell',{x:0,h:1.12,rx:0.045,ry:0.1},MUS_COL[muscleStatus(c.mus[MUS_IDX[k]])[1]],'#000',1);const id=MUS_IDX.diaphragm;const st=muscleStatus(c.mus[id]);const a=fig(0.15,1.25),b=fig(-0.15,1.25);ix.strokeStyle=MUS_COL[st[1]];ix.setLineDash([4,3]);ix.lineWidth=2;ix.beginPath();ix.moveTo(a[0],a[1]);ix.quadraticCurveTo((a[0]+b[0])/2,a[1]-12,b[0],b[1]);ix.stroke();ix.setLineDash([]);
        const cr=fig(0,1.12);TAPS.push({x:cr[0],y:cr[1],html:'<b>'+MUSCLES[MUS_IDX.rectus].name+'</b> : '+muscleStatus(c.mus[MUS_IDX.rectus])[0]});TAPS.push({x:(a[0]+b[0])/2,y:a[1]-6,html:'<b>Diaphragme</b> : '+st[0]});}
      else{const id=MUS_IDX.erector;const st=muscleStatus(c.mus[id]);const cc=shape(ix,'ell',{x:0,h:1.15,rx:0.03,ry:0.15},MUS_COL[st[1]],'#000',1);TAPS.push({x:cc[0],y:cc[1],html:'<b>'+MUSCLES[id].name+'</b> : '+st[0]});}
      ix.fillStyle='#888';lab(IC.cx,view==='front'?'Face':'Dos');}
  }else{
    drawSil('#1c232c');
    for(const r of REG_KEYS){const sh=REG_SHAPE[r];const kind=c.kind[r];let col=kind==='skin'?'#'+c.col.skin.getHexString():'#'+c.col[kind].getHexString();
      const b=c.burn[r];if(b.deg)col=b.deg===1?'#e86a5a':b.deg===2?'#c8302a':'#2a1a14';
      const cc=shape(ix,sh[0],sh[1],col,null);
      if(c.bruise[r]>0.1){ix.globalAlpha=clamp(c.bruise[r],0,0.7);shape(ix,sh[0],sh[1],'#4a2060',null);ix.globalAlpha=1;}
      if(c.soak[r]>20){ix.globalAlpha=clamp(c.soak[r]/400,0,0.75);shape(ix,sh[0],sh[1],'#5a0000',null);ix.globalAlpha=1;}
      let html='<b>'+REGIONS[r].n+'</b>';if(b.deg)html+=' · brûlure '+b.deg+'e degré ('+Math.round(b.area*100)+' %)';if(c.bruise[r]>0.1)html+=' · ecchymose';const ws=c.wounds.filter(w=>w.reg===r);if(ws.length)html+=' · '+ws.length+' plaie(s) : '+ws.map(w=>w.type).join(', ');if(c.soak[r]>20)html+=' · '+Math.round(c.soak[r])+' ml de sang';
      if(cc)TAPS.push({x:cc[0],y:cc[1],html});}
    let k=0;for(const w of c.wounds){const sh=REG_SHAPE[w.reg];const base=sh[1];let x=base.x!==undefined?base.x:(base.x1+base.x2)/2,h=base.h!==undefined?base.h:(base.h1+base.h2)/2;const j=((k*37)%11-5)*0.008,jh=((k*53)%9-4)*0.012;k++;
      shape(ix,'dot',{x:x+j,h:h+jh,r:w.exit?0.012:0.009},w.bandaged?'#eee':w.art>0?'#ff2020':'#600',w.art>0?'#fff':null);}
    if(c.temp<35){ix.fillStyle='rgba(120,180,255,.25)';ix.fillRect(0,0,W,H);}
    if(c.burning>0){ix.font='22px sans-serif';ix.fillText('🔥',W/2,30);}
    ix.fillStyle='#888';ix.font='10px sans-serif';lab(W/2,'Peau : brûlures, ecchymoses, plaies, sang');
  }
  if(sel){ix.strokeStyle='#fff';ix.lineWidth=2;ix.beginPath();ix.arc(sel.x,sel.y,9,0,7);ix.stroke();}
  ix.textAlign='left';
}

/* ---------------- settings ---------------- */
const SET_UI=[
  ['pvp','check','Mode PvP','Activé : ennemis armés en vagues qui se battent. Désactivé : bac à sable, les PNJ se promènent et ne se défendent pas.'],
  ['map','select','Ville',[['lux','Luxembourg – Ville-Haute, Pont Adolphe, Pétrusse, Gare'],['dark','Quartier Noir – ville inventée dangereuse']]],
  ['temp','range','Température extérieure (°C)',[-25,45,1]],['rain','check','Pluie (neige si ≤ 0 °C)'],['night','check','Nuit (lampadaires, lampe torche)'],
  ['npcCount','range','Nombre de PNJ (bac à sable)',[2,30,1]],['difficulty','select','Difficulté PvP',[['facile','Facile'],['normal','Normal'],['reel','Réaliste (mêmes dégâts que toi)']]],
  ['infiniteMed','check','Soins illimités'],['labels','check',"Icônes d'état au-dessus des personnages"],['injuryText','check','Afficher les blessures à chaque impact'],['tapInspect','check','Toucher un personnage pour l\'examiner'],
  ['quality','select','Qualité graphique',[['high','Haute'],['medium','Moyenne'],['low','Basse (sans ombres)']]],['sens','range','Sensibilité caméra',[0.4,2.5,0.1]],['volume','range','Volume',[0,1,0.05]],
];
let SET_DRAFT=null;
function openSettings(){SET_DRAFT=Object.assign({},SET);paused=true;$('settings').classList.remove('hidden');$('overlay').style.display='none';const b=$('setBody');b.innerHTML='';
  for(const [k,type,label,extra] of SET_UI){const row=document.createElement('div');row.className='srow';const lab=document.createElement('label');lab.innerHTML=label+(type==='check'&&extra?'<small>'+extra+'</small>':'');row.appendChild(lab);let inp;
    if(type==='check'){inp=document.createElement('input');inp.type='checkbox';inp.checked=!!SET_DRAFT[k];inp.onchange=()=>SET_DRAFT[k]=inp.checked;}
    else if(type==='select'){inp=document.createElement('select');for(const [v,t] of extra){const o=document.createElement('option');o.value=v;o.textContent=t;if(SET_DRAFT[k]===v)o.selected=true;inp.appendChild(o);}inp.onchange=()=>SET_DRAFT[k]=inp.value;}
    else{inp=document.createElement('input');inp.type='range';inp.min=extra[0];inp.max=extra[1];inp.step=extra[2];inp.value=SET_DRAFT[k];const val=document.createElement('b');val.textContent=SET_DRAFT[k];val.style.minWidth='34px';val.style.textAlign='right';inp.oninput=()=>{SET_DRAFT[k]=parseFloat(inp.value);val.textContent=inp.value;};row.appendChild(inp);row.appendChild(val);b.appendChild(row);continue;}
    row.appendChild(inp);b.appendChild(row);}
  const note=document.createElement('p');note.style.color='#999';note.innerHTML='La ville de Luxembourg est inspirée de la vraie (Pont Adolphe, vallée de la Pétrusse, cathédrale, Gëlle Fra, place d\'Armes, gare) mais n\'est pas une copie exacte.';b.appendChild(note);}
function commitSettings(){Object.assign(SET,SET_DRAFT);saveSettings();applyEnvironment();applyQuality();setVolume(SET.volume);if(AC){loopVol('rain',SET.rain&&!SNOW?0.22:0);loopVol('wind',SET.temp<2||SET.rain?0.08:0.03);}}
$('setResume').onclick=()=>{const need=SET_DRAFT.map!==SET.map||SET_DRAFT.pvp!==SET.pvp;commitSettings();$('settings').classList.add('hidden');if(!running){$('overlay').style.display='flex';return;}if(need){startGame();return;}paused=false;buildWeaponBar();};
$('setApply').onclick=()=>{commitSettings();$('settings').classList.add('hidden');startGame();};
$('startSet').onclick=()=>openSettings();

/* ---------------- game flow ---------------- */
function newGame(){
  for(const c of chars.slice())removeChar(c);chars.length=0;
  FIRES.length=0;for(const q of PROJ)scene.remove(q.mesh);PROJ.length=0;clearStains();ALARMS.length=0;popups.length=0;SPEECH.length=0;FEED.length=0;FL.list.length=0;SM.list.length=0;
  resetEvents();buildMap();applyEnvironment();
  const sp=MAP.spawn;const wpn=SET.pvp?Math.min(unlockedCount()-1,4):4;
  player=makeChar(sp.x,sp.z,MAP.yaw,0,{skin:'#e3b48c',shirt:'#2f55a3',pants:'#23283a',hair:'#36230f',shoe:'#121212',name:'Vous',age:30,sex:'M',height:178,weight:76,weapon:wpn,allWeapons:true});
  chars.push(player);camYaw=MAP.yaw;camPitch=-0.12;
  kills=0;wave=0;waveActive=false;betweenT=3;gameOverT=-1;spawnT=0;GT=0;hurtFlash=0;
  resetInv();updMedCount();buildWeaponBar();
  if(SET.pvp)showMsg('Mode PvP – '+MAP.label+'<br><small>La première vague arrive…</small>',3);else showMsg('Bac à sable – '+MAP.label+'<br><small>Les PNJ ne se défendent pas</small>',3);
}
function startGame(){initAudio();if(AC){loopSnd('rain','lowpass',1400,0.3);loopVol('rain',SET.rain&&!SNOW?0.22:0);loopSnd('wind','lowpass',350,0.4);loopVol('wind',SET.temp<2||SET.rain?0.08:0.03);}
  $('overlay').style.display='none';newGame();running=true;paused=false;}
function gameOver(){
  running=false;if(document.exitPointerLock&&locked)document.exitPointerLock();
  const next=WEAPONS.find(w=>w.unlock>totalKills);const sum=medSummary(player).slice(0,8);
  let fr=0;for(let i=0;i<BONES.length;i++)if(player.boneSt[i]>=2)fr++;
  const ov=$('overlay');ov.innerHTML='<h1>MORT</h1><p style="font-size:17px;color:#f77">'+player.cause+'</p><p><b>Rapport médical</b></p><ul>'+sum.map(s=>'<li style="color:'+SEV_TXT[s.sev]+'">'+s.t+'</li>').join('')+'</ul>'+
    '<p>'+fr+' os fracturé(s) · sang perdu : '+Math.round(player.bloodMax-player.blood)+' ml · '+player.wounds.length+' plaie(s)</p>'+
    '<p>'+(SET.pvp?'Vague '+wave+' · ':'')+'Kills : <b>'+kills+'</b>'+(SET.pvp?' · Total : <b>'+totalKills+'</b>':'')+'</p>'+(SET.pvp&&next?'<p>Prochaine arme : '+next.icon+' '+next.name+' à '+next.unlock+' kills PvP</p>':'')+
    '<div><button class="bt" id="again">REJOUER</button><button class="bt alt" id="againSet">⚙️ Paramètres</button></div>';
  ov.style.display='flex';$('again').onclick=startGame;$('againSet').onclick=openSettings;
}
$('start').onclick=startGame;

function step(dt){
  GT+=dt;
  playerInput();
  for(const c of chars){c.stun-=dt;c.tasedT-=dt;c.groanT-=dt;c.sayT-=dt;}
  for(const e of chars)if(e!==player)aiTick(e,dt);
  for(const c of chars){physics(c);control(c,dt);attackLogic(c,dt);burnTick(c,dt);}
  separate();updProjectiles(dt);updFires(dt);updEvents(dt);
  for(const c of chars){if(c.skin)animStep(c,dt);bloodTick(c,dt);}
  physAcc+=dt;if(physAcc>=0.05){for(const c of chars){physiology(c,physAcc);speakTick(c);}physAcc=0;}
  progT-=dt;if(progT<=0){progT=0.5;for(const c of chars){c._prog=prognosis(c);c._ps=survival(c).ps;c._ps0=noCare(c,c._prog,c._ps);}}
  updParticles(dt);updSprites(dt);updLines(dt);
  for(let i=SPEECH.length-1;i>=0;i--){SPEECH[i].t-=dt;if(SPEECH[i].t<=0)SPEECH.splice(i,1);}
  for(let i=popups.length-1;i>=0;i--){popups[i].t-=dt;popups[i].p.y+=0.004;if(popups[i].t<=0)popups.splice(i,1);}
  flashLight.intensity*=0.6;hitMarker-=dt;hurtFlash=Math.max(0,hurtFlash-dt*0.8);
  gameTick(dt);
  // ambient body effects: heartbeat, coughing blood, breath vapour
  const p=player;
  if(p&&p.alive){hbT-=dt;if(hbT<=0){hbT=60/Math.max(30,p.hr||60);if(p.hr>115||p.lossF>0.2||!p.conscious||p.arrest){SV=p.arrest?0:0.8;if(!p.arrest)SFX.heart();}}}
  fxT-=dt;if(fxT<=0){fxT=0.5;for(const c of chars){if(!c.alive)continue;const hp=c.P[c.head];if(hdist(hp,camera.position)>28)continue;
    const F=frameNeck(c);const mouth=add(hp,add(mul(F.fwd,0.1),mul(F.up,-0.05)));
    if(c.burning<=0&&c.lastBurnT&&GT-c.lastBurnT<40&&c.tbsa>8){const cp=c.P[c.chest];emitSmoke(cp.x,cp.y,cp.z,0.7,1.4,0.004);}
    if(SET.temp<6&&c.rr>0&&Math.random()<0.45)emitSmoke(mouth.x,mouth.y,mouth.z,0.85,1.1,0.003);
    const lungHurt=c.org[ORG.lungR]<75||c.org[ORG.lungL]<75||c.collapse[0]>0.2||c.collapse[1]>0.2||c.org[ORG.trachea]<70;
    if(lungHurt&&c.conscious&&Math.random()<0.12){sfxAt(hp);SFX.cough();for(let i=0;i<6;i++)spawnP(mouth,{x:F.fwd.x*0.02+rnd(-0.006,0.006),y:rnd(-0.004,0.01),z:F.fwd.z*0.02+rnd(-0.006,0.006)},'blood');}}}
  if(msgT>0){msgT-=dt;if(msgT<=0)msgEl.style.opacity=0;}
}
let last=0,acc=0,progT=0;
function loop(t){
  requestAnimationFrame(loop);
  const now=t/1000;const dt=Math.min(0.05,now-last||0);last=now;
  if(running&&!paused&&player){acc+=dt*TIME_SCALE;let n=0;while(acc>=1/60&&n<4){step(1/60);acc-=1/60;n++;}if(n>=4)acc=Math.min(acc,1/60);}
  if(player){updateCamera();renderCharacters();}
  updRain(dt);
  renderer.render(scene,camera);drawHUD(dt);
  if(inspTarget&&!paused){renderInspect();}
}
/* boot */
resize();
buildMap();applyEnvironment();
player=makeChar(MAP.spawn.x,MAP.spawn.z,MAP.yaw,0,{name:'Vous',allWeapons:true,weapon:4,shirt:'#2f55a3',skin:'#e3b48c'});chars.push(player);camYaw=MAP.yaw;
// wait for the 3D library (characters, animations, cars, firearms) so the game never starts with placeholders
(function waitAssets(){const t0=performance.now();const tick=()=>{const done=MODELS.done+PROPS.done,tot=(MODELS.total||8)+(PROPS.total||7);
  const ok=MODELS.finished&&PROPS.finished,late=performance.now()-t0>30000;
  if(!ok&&!late){$('loadMsg').textContent='Chargement des personnages, voitures et armes 3D… '+Math.round(done/tot*100)+' %';setTimeout(tick,150);return;}
  $('loadMsg').style.display='none';$('start').classList.remove('hidden');$('startSet').classList.remove('hidden');};tick();})();
loadModels();loadProps();
requestAnimationFrame(loop);
