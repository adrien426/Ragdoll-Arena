"use strict";
/* =====================================================================
   ARSENAL : detailed melee weapons, traumatic amputations, pulsing
   arterial blood and pooling.
   ===================================================================== */
M.blade=std({color:0xcfd5dc,metalness:0.95,roughness:0.18});M.bladeDark=std({color:0x5d6166,metalness:0.8,roughness:0.35});
M.grip=std({color:0x161514,roughness:0.85});M.gripWrap=std({color:0x2b1d14,roughness:0.95});M.wood2=std({color:0x8a5a32,roughness:0.65});
M.redPaint=std({color:0x9b1a14,metalness:0.4,roughness:0.45});M.brass=std({color:0xb08a3e,metalness:0.85,roughness:0.3});M.stump=std({color:0x6e0f0f,roughness:0.6});
// flat blade from a 2D outline (x = width, y = length) extruded thin, then laid along +Z
function bladeGeo(pts,th){const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:th,bevelEnabled:true,bevelThickness:th*0.4,bevelSize:th*0.5,bevelSegments:1,steps:1});g.translate(0,0,-th/2);g.rotateX(Math.PI/2);g.rotateY(Math.PI/2);return g;}
function lathe(profile,seg){return new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(p[0],p[1])),seg||14).rotateX(Math.PI/2);}
const _buildWeaponBase=buildWeapon;
buildWeapon=function(wg,w){
  const ad=(geo,m,x,y,z,rx,ry,rz)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.rotation.set(rx||0,ry||0,rz||0);me.castShadow=true;wg.add(me);return me;};
  switch(w.id){
    case'knife':ad(lathe([[0,-0.06],[0.013,-0.058],[0.015,-0.02],[0.014,0.03],[0.012,0.05],[0,0.05]]).scale(0.8,1.25,1),M.grip,0,0,0);
      ad(new THREE.BoxGeometry(0.05,0.012,0.008),M.bladeDark,0,0,0.055);
      ad(bladeGeo([[0,0],[0.014,0],[0.016,0.08],[0.012,0.13],[0,0.165],[-0.004,0.12],[-0.004,0]],0.0025),M.blade,0,-0.006,0.06);break;
    case'machete':ad(lathe([[0,-0.07],[0.015,-0.065],[0.016,0.04],[0,0.045]]).scale(0.75,1.3,1),M.grip,0,0,0);
      ad(bladeGeo([[0,0],[0.03,0],[0.04,0.3],[0.045,0.43],[0.02,0.48],[-0.005,0.45],[-0.006,0]],0.003),M.blade,0,-0.018,0.04);break;
    case'katana':ad(new THREE.CylinderGeometry(0.016,0.017,0.27,10).rotateX(Math.PI/2),M.gripWrap,0,0,0.03);
      ad(new THREE.CylinderGeometry(0.045,0.045,0.008,16).rotateX(Math.PI/2),M.brass,0,0,0.17);
      {const g=bladeGeo([[0,0],[0.016,0],[0.016,0.62],[0.012,0.7],[0,0.73],[-0.003,0.7],[-0.003,0]],0.0035);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){const z=pa.getZ(i);pa.setY(i,pa.getY(i)+0.06*(z/0.73)*(z/0.73));}g.computeVertexNormals();ad(g,M.blade,0,-0.008,0.175);}break;
    case'bat':ad(lathe([[0,-0.08],[0.024,-0.078],[0.026,-0.068],[0.014,-0.06],[0.013,0.12],[0.02,0.3],[0.031,0.48],[0.033,0.62],[0.03,0.66],[0,0.665]],16),M.wood2,0,0,0.06);break;
    case'axe':ad(lathe([[0,-0.1],[0.016,-0.1],[0.015,0.4],[0.018,0.56],[0,0.57]],10),M.wood2,0,0,0.05);
      ad(bladeGeo([[-0.03,0],[0.03,0],[0.11,-0.04],[0.12,0.02],[0.11,0.09],[0.03,0.06],[-0.04,0.06],[-0.05,0.03]],0.012).rotateZ(Math.PI/2),M.bladeDark,0,0.02,0.55);break;
    case'hammer':ad(lathe([[0,-0.06],[0.016,-0.06],[0.014,0.2],[0,0.21]],10),M.grip,0,0,0.04);
      ad(new THREE.CylinderGeometry(0.018,0.018,0.11,12),M.bladeDark,0,0.02,0.24);ad(new THREE.BoxGeometry(0.02,0.06,0.03),M.bladeDark,0,-0.05,0.24,0.5);break;
    case'crowbar':{const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,-0.08),new THREE.Vector3(0,0,0.45),new THREE.Vector3(0,0.03,0.52),new THREE.Vector3(0,0.08,0.54),new THREE.Vector3(0,0.1,0.5)]);
      ad(new THREE.TubeGeometry(curve,24,0.011,8,false),M.redPaint,0,0,0);ad(new THREE.BoxGeometry(0.03,0.006,0.04),M.bladeDark,0,0,-0.1);break;}
    case'taser':ad(new THREE.BoxGeometry(0.034,0.05,0.15),M.yellow,0,0.03,0.06);ad(new THREE.BoxGeometry(0.03,0.09,0.035),M.grip,0,-0.02,0);ad(new THREE.BoxGeometry(0.026,0.026,0.02),M.grip,0,0.035,0.14);break;
    case'molotov':ad(lathe([[0,-0.08],[0.035,-0.078],[0.038,0.04],[0.014,0.08],[0.012,0.12],[0,0.12]],14),M.glassGreen,0,0,0.04);ad(new THREE.CylinderGeometry(0.01,0.016,0.08,6).rotateX(Math.PI/2),M.white,0,0,0.19);break;
    default:_buildWeaponBase(wg,w);
  }
};
// ---------------- traumatic amputation ----------------
const AMP={larm:{bones:['radius','ulna','scaphoid','lunate','triquetrum','pisiform','trapezium','trapezoid','capitate','hamate'],dist:['hand'],art:'radialA',vis:['ForeArm',0.45,'Hand'],n:'avant-bras',pts:['fm','ha']},
  uarm:{bones:['humerus','radius','ulna'],dist:['larm','hand'],art:'brachial',vis:['Arm',0.5,'ForeArm'],n:'bras',pts:['el','fm','ha']},
  hand:{bones:[],dist:[],art:'radialA',vis:['Hand',0.001,null],n:'main',pts:['ha']},
  shin:{bones:['tibia','fibula','talus','calcaneus'],dist:['foot'],art:'popliteal',vis:['Leg',0.5,'Foot'],n:'jambe',pts:['ft','toe']},
  thigh:{bones:['femur','patella','tibia','fibula'],dist:['shin','foot'],art:'femoral',vis:['UpLeg',0.55,'Leg'],n:'cuisse',pts:['kn','sm','ft','toe']},
  foot:{bones:['talus','calcaneus'],dist:[],art:'popliteal',vis:['Foot',0.001,null],n:'pied',pts:['toe']}};
function ampSeg(reg){const m=reg.match(/^(larm|uarm|hand|shin|thigh|foot)([RL])$/);return m?{seg:m[1],S:m[2]}:null;}
function amputate(c,reg,point,inj){
  const a=ampSeg(reg);if(!a)return false;c.amp=c.amp||{};if(c.amp[reg])return false;const D=AMP[a.seg],S=a.S;
  c.amp[reg]=true;for(const d of D.dist)c.amp[d+S]=true;
  for(const b of BONES)if(D.bones.some(k=>b.key===k+S)||D.dist.some(d=>b.region===d+S)||b.region===reg){c.bone[b.id]=0;c.boneSt[b.id]=Math.max(c.boneSt[b.id],3);}
  for(const m of MUSCLES)if(m.region===reg||D.dist.some(d=>m.region===d+S))c.mus[m.id]=0;
  for(const o of ORGANS)if(o.region===reg||D.dist.some(d=>o.region===d+S))c.org[o.id]=0;
  const wd=mkWound(c,reg,point,'Amputation traumatique ('+D.n+' '+(S==='R'?'droit':'gauche')+')',4,0.06);wd.art=ORGANS[ORG[D.art+S]]?ORGANS[ORG[D.art+S]].bleed*0.9:30;wd.artKey=D.art+S;c.wounds.push(wd);
  c.painInj+=90;c.stun=Math.max(c.stun,2.5);c.adren=1;
  inj.unshift({t:'✂️ AMPUTATION : '+D.n+' '+(S==='R'?'droit':'gauche')+' sectionné(e) !',sev:4});
  // severed part falls to the ground
  const L=/arm|hand/.test(D.n)||D.n==='main'?c.arms[S==='R'?0:1]:c.legs[S==='R'?0:1];const pt=c.P[L[D.pts[D.pts.length-1]]]||point;
  const len=a.seg==='thigh'?0.75:a.seg==='uarm'?0.5:a.seg==='shin'?0.45:a.seg==='larm'?0.3:0.16,rad=/thigh|shin/.test(a.seg)?0.055:0.04;
  const g=new THREE.Group();const limb=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad*0.85,len,10),new THREE.MeshStandardMaterial({color:c.col.skin.clone(),roughness:0.7}));limb.rotation.z=Math.PI/2;limb.castShadow=true;g.add(limb);
  const cap=new THREE.Mesh(new THREE.CircleGeometry(rad,12),M.stump);cap.position.x=-len/2-0.001;cap.rotation.y=-Math.PI/2;g.add(cap);
  g.position.set(pt.x,pt.y,pt.z);scene.add(g);
  PROJ.push({p:{x:pt.x,y:pt.y,z:pt.z},v:{x:rnd(-0.03,0.03),y:0.03,z:rnd(-0.03,0.03)},owner:null,mesh:g,life:60,kind:'brick',limb:true,spin:{x:rnd(-0.2,0.2),z:rnd(-0.2,0.2)}});
  for(let i=0;i<14;i++)spawnP(point,{x:rnd(-0.03,0.03),y:rnd(0,0.04),z:rnd(-0.03,0.03)},'blood');
  if(c.skin)applyAmpVisual(c);c.dirty=true;computeFunctions(c);return true;
}
function applyAmpVisual(c){if(!c.skin||!c.amp)return;const B=c.skin.bones;
  for(const r in c.amp){const a=ampSeg(r);if(!a)continue;const D=AMP[a.seg];const side=a.S==='R'?'Right':'Left';const [bn,k,child]=D.vis;
    if(c.amp[(a.seg==='larm'?'uarm':a.seg==='shin'?'thigh':a.seg==='hand'?'larm':a.seg==='foot'?'shin':'_')+a.S])continue;   // a more proximal cut wins
    const b=B[side+bn];if(b){if(child){b.scale.set(1,k,1);const ch=B[side+child];if(ch)ch.scale.setScalar(0.001);}else b.scale.setScalar(0.001);}}}
// capsules of missing parts cannot be hit any more
const _rayCastBase=rayCast;
rayCast=function(o,dir,maxD,shooter,excl){const r=_rayCastBase(o,dir,maxD,shooter,excl);
  if(r.c&&r.c.amp){const h=r.c.H[r.hi];const reg=(h.split!==undefined&&r.t>h.split)?h.reg2:h.reg;if(r.c.amp[reg]){const o2=add(r.point,mul(dir,0.12));const r2=rayCast(o2,dir,Math.max(0.01,maxD-r.d-0.12),shooter,r.c);r2.d+=r.d+0.12;return r2;}}return r;};
// hook : severing blows from slashing weapons on limbs
const _applyPenBase=applyPenetrating;
applyPenetrating=function(c,reg,res,w,dm,point,inj){_applyPenBase(c,reg,res,w,dm,point,inj);
  if(w.kind==='slash'&&w.sever&&ampSeg(reg)){const thick=/thigh/.test(reg)?0.45:/shin|uarm/.test(reg)?0.7:1;const p=w.sever*thick*(dm||1)*(c.boneK<1?1.3:1);if(Math.random()<p)amputate(c,reg,point,inj);}};
// ---------------- pulsing arterial jets & pools ----------------
function bloodTick(c,dt){
  if(!c.wounds.length)return;const beating=c.alive&&!c.arrest&&c.hr>0;
  for(const w of c.wounds){if(w.bandaged||(w.limb&&c.tq[w.limb]))continue;
    if(beating&&w.art>0.3&&w.cur>0.8){w.beatT=(w.beatT||0)-dt;if(w.beatT<=0){w.beatT=60/Math.max(30,c.hr);
      const p=anchorPos(c,w.an,0.006);const F=capFrame(c,w.an.hi);const q=lerp3(F.a,F.b,w.an.t);const n=norm(sub(p,q));const sp=clamp(c.sbp/120,0.2,1.3)*0.06;
      for(let i=0;i<Math.min(9,3+w.cur/5);i++)spawnP(p,{x:n.x*sp*rnd(0.7,1.2)+rnd(-0.006,0.006),y:n.y*sp+rnd(0.004,0.02),z:n.z*sp*rnd(0.7,1.2)+rnd(-0.006,0.006)},'blood',rnd(0.01,0.02));}}
    // lying in your blood : the pool spreads under the wound
    if(w.cur>0.6){w.poolT=(w.poolT||0)-dt;if(w.poolT<=0){w.poolT=0.6;const p=anchorPos(c,w.an,0);const g=groundAt(p.x,p.z,p.y+0.2);if(p.y-g<0.35&&waterLevel(p.x,p.z)<g){addStain(p.x,p.z,g,clamp(w.cur*0.012,0.02,0.09));}}}}
}

// ---------------- new weapon meshes ----------------
const _buildWeapon2=buildWeapon;
buildWeapon=function(wg,w){
  const ad=(geo,m,x,y,z,rx,ry,rz)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.rotation.set(rx||0,ry||0,rz||0);me.castShadow=true;wg.add(me);return me;};
  const orange=M.orangeP||(M.orangeP=std({color:0xe2701a,roughness:0.5}));
  switch(w.id){
    case'knuckles':for(let i=0;i<4;i++)ad(new THREE.TorusGeometry(0.011,0.004,6,10),M.bladeDark,(i-1.5)*0.022,0,0.03,0,Math.PI/2);ad(new THREE.BoxGeometry(0.09,0.012,0.012),M.bladeDark,0,-0.016,0.03);break;
    case'chainsaw':ad(new THREE.BoxGeometry(0.11,0.14,0.26),orange,0,0.02,0.02);ad(new THREE.TorusGeometry(0.05,0.008,6,12,Math.PI),M.grip,0,0.1,0.02,0,Math.PI/2);
      ad(new THREE.BoxGeometry(0.012,0.06,0.5),M.blade,0,0,0.38);ad(new THREE.BoxGeometry(0.016,0.068,0.5),M.grip,0,0,0.38).scale.set(1,1,0.98);break;
    case'revolver':ad(new THREE.BoxGeometry(0.028,0.035,0.08),M.bladeDark,0,0.035,0.03);ad(new THREE.CylinderGeometry(0.019,0.019,0.04,8).rotateX(Math.PI/2),M.bladeDark,0,0.033,0.065);
      ad(new THREE.CylinderGeometry(0.008,0.008,0.15,10).rotateX(Math.PI/2),M.blade,0,0.042,0.15);ad(new THREE.BoxGeometry(0.025,0.08,0.035),M.wood2,0,-0.015,-0.005,-0.25);break;
    case'uzi':ad(new THREE.BoxGeometry(0.04,0.06,0.25),M.bladeDark,0,0.03,0.08);ad(new THREE.BoxGeometry(0.025,0.14,0.03),M.grip,0,-0.06,0.03);ad(new THREE.CylinderGeometry(0.008,0.008,0.06,8).rotateX(Math.PI/2),M.blade,0,0.035,0.23);break;
    case'crossbow':ad(new THREE.BoxGeometry(0.04,0.05,0.62),M.wood2,0,0,0.18);ad(new THREE.BoxGeometry(0.5,0.02,0.03),M.grip,0,0.02,0.45).rotation.z=0;
      {const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.25,0.02,0.44),new THREE.Vector3(0,0.03,0.25),new THREE.Vector3(0.25,0.02,0.44)]);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xdddddd}));wg.add(l);}
      ad(new THREE.CylinderGeometry(0.004,0.004,0.4,6).rotateX(Math.PI/2),M.blade,0,0.035,0.42);break;
    case'flamer':ad(new THREE.CylinderGeometry(0.05,0.05,0.3,12),M.redPaint,0,-0.06,0.05);ad(new THREE.BoxGeometry(0.04,0.05,0.5),M.bladeDark,0,0.03,0.3);ad(new THREE.CylinderGeometry(0.018,0.012,0.18,10).rotateX(Math.PI/2),M.blade,0,0.03,0.62);break;
    case'rpg':ad(new THREE.CylinderGeometry(0.045,0.045,1.0,14).rotateX(Math.PI/2),M.grenade||M.bladeDark,0,0.05,0.25);ad(new THREE.ConeGeometry(0.05,0.2,12).rotateX(Math.PI/2),M.grenade||M.bladeDark,0,0.05,0.85);
      ad(new THREE.BoxGeometry(0.03,0.09,0.04),M.grip,0,-0.03,0.02);ad(new THREE.BoxGeometry(0.03,0.09,0.04),M.grip,0,-0.03,0.25);break;
    default:_buildWeapon2(wg,w);
  }
};
// ---------------- crossbow bolts, rockets, flamethrower ----------------
const BOLT_GEO=new THREE.CylinderGeometry(0.004,0.004,0.4,6).rotateX(Math.PI/2),ROCKET_GEO=new THREE.CylinderGeometry(0.04,0.04,0.5,10).rotateX(Math.PI/2);
function fireSpecial(c,w){
  const mz=muzzleOf(c,w);let dir;
  if(c.isPlayer){const o=add({x:camera.position.x,y:camera.position.y,z:camera.position.z},mul(camDir,2));dir=norm(sub(c.aimP,mz));const d2=norm(sub(c.aimP,o));dir=norm(add(mul(dir,0.5),mul(d2,0.5)));}else dir=norm(sub(c.aimP,mz));
  if(w.type==='bow'){const m=new THREE.Mesh(BOLT_GEO,M.blade);m.position.set(mz.x,mz.y,mz.z);scene.add(m);PROJ.push({p:{...mz},v:mul(dir,75/60),owner:c,mesh:m,life:4,kind:'bolt',w,age:0});sfxAt(mz);SFX.swing();}
  else if(w.type==='rocket'){const m=new THREE.Mesh(ROCKET_GEO,M.grenade||M.bladeDark);m.position.set(mz.x,mz.y,mz.z);scene.add(m);PROJ.push({p:{...mz},v:mul(dir,42/60),owner:c,mesh:m,life:5,kind:'rocket',age:0});sfxAt(mz);SFX.whoosh();SFX.shot(1.6);addAlarm(mz,50);c.recoil=1;}
  else if(w.type==='flame'){
    for(let i=0;i<6;i++){const s=rnd(0.2,1);const q=add(mz,mul(dir,s*0.4));emitFlame(q.x+rnd(-0.05,0.05),q.y+rnd(-0.05,0.05),q.z+rnd(-0.05,0.05),1.2+s);}
    for(let k=1;k<=7;k++){const q=add(mz,add(mul(dir,k*0.95),{x:rnd(-0.12,0.12)*k*0.3,y:rnd(-0.05,0.12)*k*0.3,z:rnd(-0.12,0.12)*k*0.3}));if(Math.random()<0.7)emitFlame(q.x,q.y,q.z,1.4+k*0.25);if(k>4&&Math.random()<0.15)emitSmoke(q.x,q.y,q.z,0.2,1.5,0.015);}
    if(Math.random()<0.15){sfxAt(mz);SFX.whoosh();}addAlarm(mz,25);
    // everyone inside the 7 m cone of fire burns
    for(const o of chars){if(o===c)continue;for(const pi of [o.chest,o.head,o.pelvis,o.legs[0].kn,o.legs[1].kn]){const p=o.P[pi];const v=sub(p,mz),d=vlen(v);if(d>7.2||d<0.1)continue;if(dot(v,dir)/d<0.93)continue;if(!losClear(mz,p))continue;
      for(const r of REG_KEYS)if(Math.random()<0.25)burnDose(o,r,rnd(0.15,0.45));if(Math.random()<0.08)ignite(o,'thorax',6);o.lastHit=c;wake(o);break;}}
    const end=add(mz,mul(dir,7));const gy=groundAt(end.x,end.z,end.y+1);if(end.y-gy<1&&Math.random()<0.03&&waterLevel(end.x,end.z)<gy)FIRES.push({x:end.x,y:gy+0.05,z:end.z,r:1.2,life:10,max:10});
  }
  if(!c.isPlayer)return;
}
function updSpecial(q,dt,i){
  q.age+=dt;if(q.kind==='bolt')q.v.y-=G*0.25;const np=add(q.p,q.v);const dir=norm(q.v);
  q.mesh.position.set(np.x,np.y,np.z);q.mesh.lookAt(np.x+dir.x,np.y+dir.y,np.z+dir.z);
  if(q.kind==='rocket'){emitSmoke(q.p.x,q.p.y,q.p.z,0.55,1.6,0.004,null,0.004);emitFlame(q.p.x,q.p.y,q.p.z,0.9);}
  const hit=projHitChar(q,q.p,np);const gy=groundAt(np.x,np.z,np.y+0.5);const wall=insideBox(np.x,np.y,np.z,0);
  if(hit){if(q.kind==='bolt'){applyHit(hit.c,hit.h.hi,hit.h.t,hit.pt,dir,q.w,q.owner,1);scene.remove(q.mesh);PROJ.splice(i,1);}else{scene.remove(q.mesh);PROJ.splice(i,1);explode(hit.pt,1.6,q.owner,{fire:true});}return;}
  if(np.y<=gy+0.02||wall){if(q.kind==='rocket'){scene.remove(q.mesh);PROJ.splice(i,1);explode({x:np.x,y:Math.max(np.y,gy+0.2),z:np.z},1.6,q.owner,{fire:true});return;}
    sfxAt(np);SFX.ric();q.mesh.position.set(q.p.x,q.p.y,q.p.z);restDebris(q);PROJ.splice(i,1);return;}
  q.p=np;q.life-=dt;if(q.life<=0){scene.remove(q.mesh);PROJ.splice(i,1);}
}
// ---------------- people defend themselves ----------------
// A passer-by you attack may fight back (some carry a knife or a handgun), witnesses sometimes join in.
function provoke(c,by,witness){
  if(!c.alive||c.team!==2||!by||!by.isPlayer||c._provoked)return;
  if(witness){if(Math.random()>=0.15)return;}else{c._provoked=true;if(Math.random()>=0.5)return;}c._provoked=true;
  const W=id=>WEAPONS.findIndex(x=>x.id===id);const r=Math.random();
  const wi=r<0.12?W('pistol'):r<0.2?W('revolver'):r<0.42?W('knife'):r<0.5?W('bat'):r<0.56?W('crowbar'):r<0.6?W('hammer'):r<0.66?W('knuckles'):W('fists');
  c.team=1;c.hasWeapon=true;c.weapon=wi;c.ammo[wi]=WEAPONS[wi].mag||0;c.dmgMul=0.9;c.cdMul=1.5;c.speedMul=Math.max(c.speedMul||1,0.95);c.ai.react=rnd(0.3,0.6);c.ai.state='fight';
  if(!c.wm[wi]){const wg=new THREE.Group();wg.visible=false;c.wg.add(wg);if(!(PROPS.ready&&realWeapon(wg,WEAPONS[wi])))buildWeapon(wg,WEAPONS[wi]);c.wm[wi]=wg;}
  say(c,'angry',true);if(WEAPONS[wi].type==='gun'){sfxAt(c.P[c.chest]);SFX.reload();addFeed('⚠️ '+c.name+' sort une arme !',3);}else addFeed('⚠️ '+c.name+' se défend !',2);
}
const _applyHitDef=applyHit;
applyHit=function(c,hi,t,point,dir,w,src,E){const r=_applyHitDef(c,hi,t,point,dir,w,src,E);
  if(c&&src&&src.isPlayer&&c.team===2&&c.alive){provoke(c,src);for(const o of chars)if(o!==c&&o.team===2&&o.alive&&hdist(o.P[o.pelvis],c.P[c.pelvis])<10)provoke(o,src,true);}return r;};
