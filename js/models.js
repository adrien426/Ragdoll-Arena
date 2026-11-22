"use strict";
/* =====================================================================
   MODELS : realistic skinned characters (Mixamo rigs from the 3D library)
   driven bone by bone by the physical ragdoll. Falls back to the
   procedural body when a model cannot be loaded.
   ===================================================================== */
const MODELS={ready:false,failed:false,kinds:{},list:[]};
const MODEL_FILES={james:'M',adam:'M',pnj_agent:'M',pnj_blond:'M',pnj_pilote:'M',pnj_pull:'M',pnj_soldat:'M',pnj_femme:'F'};
const HOSTILE_KINDS=['pnj_soldat','pnj_agent','pnj_pull','pnj_blond'],CIVIL_M=['adam','pnj_pilote','pnj_pull','pnj_blond','pnj_agent','james'];

// bone (short Mixamo name) -> body region used by the medical model
function boneRegion(n){
  const s=/^Left/.test(n)?'L':/^Right/.test(n)?'R':'';
  if(/UpLeg/.test(n))return'thigh'+s;if(/Leg$/.test(n))return'shin'+s;if(/Foot|Toe/.test(n))return'foot'+s;
  if(/ForeArm/.test(n))return'larm'+s;if(/Hand/.test(n))return'hand'+s;if(/Arm$/.test(n))return'uarm'+s;if(/Shoulder/.test(n))return'thorax';
  if(/Head|Eye/.test(n))return'head';if(/Neck/.test(n))return'neck';if(/Spine1|Spine2/.test(n))return'thorax';if(/Spine/.test(n))return'abdomen';return'pelvis';
}
const shortBone=n=>n.replace(/^mixamorig\d*:?/,'');

// mapping : bone -> [primary from, primary to, secondary kind]
//   'latP'/'latC' : body lateral axis (pelvis / shoulders), 'armN'/'legN' : elbow / knee hinge axis
function boneTargets(c,s){
  const A=c.arms,L=c.legs;
  return{
    Hips:[c.pelvis,c.chest,'latP'],Spine:[c.pelvis,c.chest,'latP'],Spine1:[c.pelvis,c.chest,'latC'],Spine2:[c.chest,c.neck,'latC'],
    Neck:[c.neck,c.head,'latC'],Head:[c.neck,c.head,'latC'],
    RightArm:[A[0].sh,A[0].el,'armN0'],RightForeArm:[A[0].el,A[0].ha,'armN0'],RightHand:[A[0].el,A[0].ha,'armN0'],
    LeftArm:[A[1].sh,A[1].el,'armN1'],LeftForeArm:[A[1].el,A[1].ha,'armN1'],LeftHand:[A[1].el,A[1].ha,'armN1'],
    RightUpLeg:[L[0].hip,L[0].kn,'legN0'],RightLeg:[L[0].kn,L[0].ft,'legN0'],RightFoot:[L[0].ft,L[0].toe,'legN0'],
    LeftUpLeg:[L[1].hip,L[1].kn,'legN1'],LeftLeg:[L[1].kn,L[1].ft,'legN1'],LeftFoot:[L[1].ft,L[1].toe,'legN1'],
  };
}
// child bone used to measure each mapped bone's direction in the bind pose
const BIND_CHILD={Hips:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',Head:'HeadTop_End',
  RightArm:'RightForeArm',RightForeArm:'RightHand',RightHand:'RightHandMiddle1',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',LeftHand:'LeftHandMiddle1',
  RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase',LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase'};

const _mq=new THREE.Quaternion(),_mq2=new THREE.Quaternion(),_mm=new THREE.Matrix4(),_mm2=new THREE.Matrix4(),_mv=new THREE.Vector3(),_mv2=new THREE.Vector3(),_mv3=new THREE.Vector3();
function v3(o){return new THREE.Vector3(o.x,o.y,o.z);}
function basisMat(m,p,f){const s=_mv3.crossVectors(p,f);m.makeBasis(p,f,s);return m;}

function prepModel(kind,gltf){
  const sc=gltf.scene;const bones={};let skinned=[];
  sc.traverse(o=>{if(o.isBone){const n=shortBone(o.name);o.name='mixamorig'+n;bones[n]=o;}if(o.isSkinnedMesh)skinned.push(o);});
  if(!bones.Hips||!skinned.length)return null;
  // materials : lambert (cheap on phones), skinning + per-vertex tint for burns / blood / pallor
  const mcache=new Map();
  const conv=m=>{if(mcache.has(m))return mcache.get(m);const hair=/hair|lash|brow/i.test(m.name);
    const l=new THREE.MeshLambertMaterial({map:m.map||null,color:m.color?m.color.clone():new THREE.Color(1,1,1),skinning:true,vertexColors:true,transparent:false,alphaTest:hair||m.transparent?0.45:0,side:hair?THREE.DoubleSide:THREE.FrontSide});
    l.name=m.name;mcache.set(m,l);return l;};
  for(const o of skinned){o.material=Array.isArray(o.material)?o.material.map(conv):conv(o.material);}
  sc.updateMatrixWorld(true);
  // bind data in world space (scene root is the identity)
  const bind={};
  for(const n in bones){const b=bones[n];const wq=new THREE.Quaternion();b.getWorldQuaternion(wq);const wp=new THREE.Vector3();b.getWorldPosition(wp);bind[n]={lq:b.quaternion.clone(),wq,wp};}
  const hipsY=bind.Hips.wp.y;const scale=0.97/hipsY;
  const FWD=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(-1,0,0);
  const map={};
  for(const n in BIND_CHILD){if(!bones[n])continue;const ch=bind[BIND_CHILD[n]];if(!ch)continue;
    const p=ch.wp.clone().sub(bind[n].wp).normalize();
    let sec;if(/Arm|Hand/.test(n))sec=new THREE.Vector3().crossVectors(p,FWD);else if(/Leg|Foot/.test(n))sec=new THREE.Vector3().crossVectors(/Foot/.test(n)?new THREE.Vector3(0,-1,0):p,FWD.clone().negate());else sec=RIGHT.clone();
    sec.sub(p.clone().multiplyScalar(sec.dot(p)));if(sec.lengthSq()<1e-6)continue;sec.normalize();
    // local axes : what the primary / secondary directions are in the bone's own frame
    const inv=bind[n].wq.clone().invert();map[n]={a:p.clone().applyQuaternion(inv),f:sec.clone().applyQuaternion(inv)};}
  // per-vertex region (dominant bone) for every skinned mesh
  const regs={};
  for(const o of skinned){const g=o.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;const n=si.count;const r=new Uint8Array(n);
    const bn=o.skeleton.bones.map(b=>REG_KEYS.indexOf(boneRegion(shortBone(b.name))));
    const gw=['getX','getY','getZ','getW'];
    for(let i=0;i<n;i++){let best=0,bw=-1;for(let k=0;k<4;k++){const w=sw[gw[k]](i);if(w>bw){bw=w;best=si[gw[k]](i);}}r[i]=Math.max(0,bn[best]|0);}
    regs[o.name]=r;}
  // hierarchy order from the hips
  const order=[];(function walk(b){order.push(shortBone(b.name));for(const ch of b.children)if(ch.isBone)walk(ch);})(bones.Hips);
  // locomotion clips, hips height adapted to this body (authored for a 0.93 m hips height, in place)
  const clips={};if(MODELS.anims)for(const k of ['idle','idleN','walk','run']){const raw=MODELS.anims[k];if(!raw)continue;const cl=THREE.AnimationClip.parse(raw);
    for(const tr of cl.tracks)if(/Hips\.position$/.test(tr.name)){const v=tr.values,kk=hipsY/0.93;for(let i=0;i<v.length;i+=3){v[i]=0;v[i+1]*=kk;v[i+2]=0;}}
    clips[k]=cl;}
  return{kind,scene:sc,bind,map,scale,regs,order,clips,sex:MODEL_FILES[kind]};
}

function loadModels(){
  if(MODELS.ready||MODELS.loading)return;
  if(!THREE.GLTFLoader||!THREE.SkeletonUtils||location.protocol==='file:'){MODELS.failed=true;return;}
  MODELS.loading=true;const ld=new THREE.GLTFLoader();if(window.MeshoptDecoder)ld.setMeshoptDecoder(MeshoptDecoder);
  const animP=fetch('assets/anims.json').then(r=>r.ok?r.json():null).then(j=>{MODELS.anims=j;}).catch(e=>console.warn('Animations unavailable',e));
  const jobs=Object.keys(MODEL_FILES).map(k=>animP.then(()=>new Promise(res=>ld.load('assets/models/'+k+'.glb',g=>{try{const m=prepModel(k,g);if(m)MODELS.kinds[k]=m;}catch(e){console.warn('Model prep failed',k,e);}res();},undefined,e=>{console.warn('Model unavailable',k,e);res();}))));
  Promise.all(jobs).then(()=>{MODELS.list=Object.keys(MODELS.kinds);MODELS.loading=false;
    if(!MODELS.list.length){MODELS.failed=true;return;}
    MODELS.ready=true;for(const c of chars)attachSkin(c);});
}
function pickKind(c){const K=MODELS.kinds;
  if(c.modelKind&&K[c.modelKind])return c.modelKind;
  if(c.isPlayer)return K.james?'james':MODELS.list[0];
  if(c.sex==='F')return K.pnj_femme?'pnj_femme':null;
  const pool=(c.team===1?HOSTILE_KINDS:CIVIL_M).filter(k=>K[k]);return pool.length?pick(pool):null;}
function attachSkin(c){
  if(!MODELS.ready||c.skin)return;const kind=pickKind(c);if(!kind){c.skin=null;return;}const M=MODELS.kinds[kind];
  const root=THREE.SkeletonUtils.clone(M.scene);root.scale.setScalar(M.scale);
  const bones={},meshes=[];
  root.traverse(o=>{if(o.isBone)bones[shortBone(o.name)]=o;if(o.isSkinnedMesh){o.geometry=o.geometry.clone();const n=o.geometry.attributes.position.count;const col=new Float32Array(n*3).fill(1);o.geometry.setAttribute('color',new THREE.BufferAttribute(col,3));
    o.frustumCulled=false;o.castShadow=true;o.receiveShadow=false;meshes.push({m:o,reg:M.regs[o.name]});}});
  scene.add(root);
  const tint=c.isPlayer?1:rnd(0.82,1.08);
  const S={root,bones,meshes,M,kind,wq:{},tintK:tint,hash:'',hand:[bones.RightHand,bones.LeftHand],snap:{},snapHips:new THREE.Vector3(),spd:0,anim:false,blendT:1,mixer:null,actions:{},cur:null};
  if(Object.keys(M.clips).length>=3){S.mixer=new THREE.AnimationMixer(root);for(const k in M.clips){const a=S.mixer.clipAction(M.clips[k]);a.setLoop(THREE.LoopRepeat);S.actions[k]=a;}
    S.mixer.timeScale=1;S.phase=Math.random()*5;}
  c.skin=S;c.modelKind=kind;
}
function detachSkin(c){if(c.skin){scene.remove(c.skin.root);for(const e of c.skin.meshes)e.m.geometry.dispose();c.skin=null;}}

// ---------- character controller + animation ----------
// Standing characters are KINEMATIC (like a game character controller): a capsule moved by the input,
// sliding along walls, snapping to steps, playing motion-captured clips. The ragdoll points are then
// placed on the animated skeleton (hitboxes = what you see). When hit hard, stunned, unconscious,
// falling, swimming or dead, the controller lets go and the physical ragdoll takes over with the same
// velocity. Getting up blends from the ragdoll pose back to the clip.
const ANIM_BLEND=0.3,GETUP_T=0.75,ARM_BONES=['RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand'];
const K_RAD=0.3,K_STEP=0.45,K_H=1.75,WALK_V=1.5,RUN_V=3.4;
const _yawQ=new THREE.Quaternion(),_Y=new THREE.Vector3(0,1,0);
function hasCtrl(c){return!!(c.skin&&c.skin.mixer);}
function ctrlWanted(c){
  if(!c.alive||!c.conscious||c.arrest||!c.canStand||c.tasedT>0||c.tetra||c.para)return false;
  if(c.stun>0.25||c.koT>0||c.faintT>0)return false;
  const k=c.k;if(k){const wl=waterLevel(k.x,k.z),g=groundAt(k.x,k.z,k.y+K_STEP);if(wl>g+1.2)return false;}  // deep water : swim as a ragdoll
  return true;
}
function initCtrl(c){const pel=c.P[c.pelvis];c.k={x:pel.x,y:groundAt(pel.x,pel.z,pel.y),z:pel.z,vx:0,vy:0,vz:0,yaw:c.yaw,grounded:true,mode:'rag',getup:0,airT:0};}
function enterCtrl(c){const k=c.k,pel=c.P[c.pelvis];k.x=pel.x;k.z=pel.z;k.y=groundAt(pel.x,pel.z,pel.y+0.5);k.vx=k.vy=k.vz=0;k.mode='ctrl';k.getup=GETUP_T;k.grounded=true;
  const S=c.skin;snapshot(S);S.blendT=0;S.blendLen=GETUP_T;c.upT=1;}
function enterRag(c){const k=c.k;k.mode='rag';const S=c.skin;snapshot(S);S.blendT=0;S.blendLen=0.18;}
// horizontal circle vs box push-out (slide along walls), ground snap with step-up / step-down
function ctrlMove(c,dt){
  const k=c.k,inp=c.input;
  const lim=Math.min(c.legFn[0],c.legFn[1]);
  let max=RUN_V*clamp(c.speedF,0.15,1)*c.speedMul;if(lim<0.6)max=Math.min(max,WALK_V*0.8);
  if(k.getup>0){k.getup-=dt;max=0;}
  let mx=inp.mx||0,mz=inp.mz||0;const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;}
  const tx=mx*max,tz=mz*max,acc=k.grounded?12:2;
  k.vx+=(tx-k.vx)*clamp(dt*acc,0,1);k.vz+=(tz-k.vz)*clamp(dt*acc,0,1);
  if(k.grounded&&inp.jump&&c.jumpCd<=0&&lim>0.7&&c.painEff<60&&k.getup<=0){k.vy=4.3;k.grounded=false;c.jumpCd=0.8;c.airT=0.4;}
  k.vy-=9.8*dt;
  let nx=k.x+k.vx*dt,nz=k.z+k.vz*dt,ny=k.y+k.vy*dt;
  // walls : boxes overlapping the capsule between knee (step) height and the head
  for(let pass=0;pass<2;pass++)for(const b of boxesNear(nx,nz,K_RAD+1)){
    if(b.max.y<=ny+K_STEP||b.min.y>=ny+K_H)continue;
    const cx=clamp(nx,b.min.x,b.max.x),cz=clamp(nz,b.min.z,b.max.z);let dx=nx-cx,dz=nz-cz;const d=Math.hypot(dx,dz);
    if(d>=K_RAD)continue;
    if(d<1e-6){const o=[nx-b.min.x,b.max.x-nx,nz-b.min.z,b.max.z-nz];const m=Math.min(...o);const i=o.indexOf(m);dx=i===0?-1:i===1?1:0;dz=i===2?-1:i===3?1:0;nx+=dx*(m+K_RAD);nz+=dz*(m+K_RAD);}
    else{dx/=d;dz/=d;nx+=dx*(K_RAD-d);nz+=dz*(K_RAD-d);}
    const vn=k.vx*dx+k.vz*dz;if(vn<0){k.vx-=vn*dx;k.vz-=vn*dz;}}
  // terrain cliffs : do not walk off into the void sideways, only fall when moving off a ledge on purpose
  const g=groundAt(nx,nz,ny+K_STEP);
  if(ny<=g+0.02&&k.vy<=0){ny=g;k.vy=0;k.grounded=true;}
  else if(k.grounded&&k.vy<=0&&ny-g<0.35){ny=g;k.vy=0;}
  else k.grounded=false;
  // other characters : keep a body width apart
  for(const o of chars){if(o===c)continue;const q=o.k&&o.k.mode==='ctrl'?o.k:o.P[o.pelvis];const dx=nx-q.x,dz=nz-q.z,d=Math.hypot(dx,dz);if(d<0.55&&d>1e-4&&Math.abs((q.y||0)-ny)<1.6){const m=(0.55-d)*0.5/d;nx+=dx*m;nz+=dz*m;}}
  k.vx=(nx-k.x)/dt;k.vz=(nz-k.z)/dt;k.x=nx;k.y=ny;k.z=nz;
  if(!k.grounded)k.airT+=dt;else k.airT=0;
  // heading : face where you go, or where you aim while attacking
  const sp=Math.hypot(k.vx,k.vz);const attacking=c.swing>=0||(c.isPlayer&&c._aimT>GT)||(c.team===1&&c.ai&&c.ai.los);
  let want=k.yaw;if(attacking||sp<0.3)want=c.yaw;else want=Math.atan2(k.vx,k.vz);
  let dy=want-k.yaw;while(dy>Math.PI)dy-=Math.PI*2;while(dy<-Math.PI)dy+=Math.PI*2;k.yaw+=dy*clamp(dt*10,0,1);
  if(!c.isPlayer&&!attacking)c.yaw=k.yaw;
  // footsteps
  c.stepT-=sp*dt;if(c.stepT<0&&k.grounded&&sp>0.6){c.stepT=0.75;sfxAt(c.P[c.pelvis]);SFX.step();}
  c.onGround=k.grounded;c.gndY=g;
}
function setClip(S,name,ts){const a=S.actions[name];if(!a)return;a.timeScale=ts;if(S.cur===name)return;
  const prev=S.cur&&S.actions[S.cur];a.reset();a.time=Math.random()*a.getClip().duration;a.setEffectiveWeight(1).fadeIn(0.22).play();if(prev)prev.fadeOut(0.22);S.cur=name;}
function snapshot(S){const M=S.M;for(const n of M.order){const b=S.bones[n];if(!b)continue;(S.snap[n]||(S.snap[n]=new THREE.Quaternion())).copy(b.quaternion);}S.snapHips.copy(S.bones.Hips.position);}
// ragdoll point <- bone (world positions of the animated skeleton)
const PT_FROM_BONE=[['head','Head','HeadTop_End',0.45],['neck','Neck',null,0],['chest','Spine1','Spine2',0.6],['pelvis','Hips',null,0]];
function bonePos(S,n){const b=S.bones[n];if(!b)return null;b.getWorldPosition(_mv);return{x:_mv.x,y:_mv.y,z:_mv.z};}
function pointsFromSkeleton(c,dt,armsToo){
  const S=c.skin,P=c.P,k=c.k;const vx=k.vx*dt,vy=Math.min(0,k.vy)*dt,vz=k.vz*dt;
  const set=(i,q)=>{if(!q)return;const p=P[i];p.x=q.x;p.y=q.y;p.z=q.z;p.ox=q.x-vx;p.oy=q.y-vy;p.oz=q.z-vz;};
  const mid=(a,b,t)=>{const A=bonePos(S,a),B=b?bonePos(S,b):null;return A&&B?lerp3(A,B,t):A;};
  set(c.head,mid('Head','HeadTop_End',0.45));set(c.neck,bonePos(S,'Neck'));set(c.chest,mid('Spine1','Spine2',0.6));set(c.pelvis,bonePos(S,'Hips'));
  const fw={x:Math.sin(k.yaw),y:0,z:Math.cos(k.yaw)};const ch=P[c.chest];set(c.chestF,{x:ch.x+fw.x*0.11,y:ch.y+0.02,z:ch.z+fw.z*0.11});
  const SD=['Right','Left'];
  for(let s=0;s<2;s++){const n=SD[s],L=c.legs[s],A=c.arms[s];
    set(L.hip,bonePos(S,n+'UpLeg'));set(L.tm,mid(n+'UpLeg',n+'Leg',0.5));set(L.kn,bonePos(S,n+'Leg'));set(L.sm,mid(n+'Leg',n+'Foot',0.5));
    const ft=bonePos(S,n+'Foot');if(ft){ft.y-=0.03;set(L.ft,ft);}const toe=bonePos(S,n+'ToeBase');if(toe){toe.y=Math.max(toe.y-0.02,(ft?ft.y:toe.y)-0.04);set(L.toe,toe);}
    set(A.sh,bonePos(S,n+'Arm'));
    if(armsToo){set(A.um,mid(n+'Arm',n+'ForeArm',0.5));set(A.el,bonePos(S,n+'ForeArm'));set(A.fm,mid(n+'ForeArm',n+'Hand',0.5));set(A.ha,mid(n+'Hand',n+'HandMiddle1',0.6));}}
}
// called every fixed step after the physics
function animStep(c,dt){
  const S=c.skin;if(!S)return;if(!S.mixer){return;}
  if(!c.k)initCtrl(c);const k=c.k;
  const want=ctrlWanted(c);
  if(k.mode==='ctrl'&&(!want||k.airT>0.9))enterRag(c);
  else if(k.mode==='rag'&&want){const pel=c.P[c.pelvis];const sp=Math.hypot(pel.x-pel.ox,pel.y-pel.oy,pel.z-pel.oz)*60;
    const standing=pel.y-groundAt(pel.x,pel.z,pel.y+0.5)>0.75;
    if(sp<1.5&&(c._downT=(c._downT||0)+dt)>(standing?0.1:c.isPlayer?0.6:1.2)){c._downT=0;enterCtrl(c);if(standing){c.skin.blendLen=0.2;c.k.getup=0;}}}
  if(k.mode!=='rag')c._downT=0;
  S.blendT=(S.blendT||0)+dt;
  if(k.mode==='ctrl'){
    const w=WEAPONS[c.weapon];const armsRag=c.hasWeapon&&(w.len>0||c.swing>=0);
    const v=Math.hypot(k.vx,k.vz),lim=Math.min(c.legFn[0],c.legFn[1]);
    const back=Math.sin(k.yaw)*k.vx+Math.cos(k.yaw)*k.vz<-0.2;   // walking backwards while aiming
    if(!k.grounded&&k.airT>0.15)setClip(S,'idle',0.4);
    else if(v<0.3||k.getup>0)setClip(S,S.actions.idleN?'idleN':'idle',1);
    else if(v<2.6||lim<0.6)setClip(S,'walk',clamp(v/WALK_V,0.5,2)*(back?-1:1));
    else setClip(S,'run',clamp(v/RUN_V,0.75,1.4)*(back?-1:1));
    S.mixer.update(dt);
    _yawQ.setFromAxisAngle(_Y,k.yaw);const h=S.bones.Hips;h.quaternion.premultiply(_yawQ);_mv.copy(h.position).applyQuaternion(_yawQ);
    h.position.set(k.x/S.M.scale+_mv.x,k.y/S.M.scale+_mv.y,k.z/S.M.scale+_mv.z);
    if(lim<0.6&&v>0.3){const sideK=c.legFn[0]<c.legFn[1]?1:-1;_mq.setFromAxisAngle(_mv.set(Math.sin(k.yaw),0,Math.cos(k.yaw)),Math.sin(GT*7)*0.06*sideK);h.quaternion.premultiply(_mq);}
    S.root.updateMatrixWorld(true);
    if(armsRag)driveFromRagdoll(c,ARM_BONES);
    blendIn(S);S.root.updateMatrixWorld(true);
    pointsFromSkeleton(c,dt,!armsRag);
  }else{driveFromRagdoll(c,'all');blendIn(S);S.root.updateMatrixWorld(true);}
}
function blendIn(S){const L=S.blendLen||ANIM_BLEND;if(S.blendT>=L)return;const t=S.blendT/L,e=t*t*(3-2*t);
  for(const n of S.M.order){const b=S.bones[n],q=S.snap[n];if(b&&q)b.quaternion.copy(_mq2.copy(q).slerp(b.quaternion,e));}
  _mv2.copy(S.bones.Hips.position);S.bones.Hips.position.lerpVectors(S.snapHips,_mv2,e);}
function poseSkin(c){/* posing happens in animStep (fixed step) */}

// ragdoll retargeting : each mapped bone is aimed along its ragdoll segment (with hinge-based twist)
function driveFromRagdoll(c,drive){
  const S=c.skin,M=S.M,P=c.P,B=S.bones;const pel=P[c.pelvis];
  const latP=v3(sub(P[c.hip[0]],P[c.hip[1]])),latC=v3(sub(P[c.sh[0]],P[c.sh[1]]));
  const upC=v3(sub(P[c.neck],P[c.chest])).normalize(),upP=v3(sub(P[c.chest],P[c.pelvis])).normalize();
  const fwdC=new THREE.Vector3().crossVectors(upC,latC).normalize(),fwdP=new THREE.Vector3().crossVectors(upP,latP).normalize();
  const hinge=(a,b,cc,fb,flip)=>{const u=v3(sub(P[b],P[a])).normalize(),w=v3(sub(P[cc],P[b])).normalize();const n=new THREE.Vector3().crossVectors(u,w);
    if(n.lengthSq()<0.02){n.crossVectors(u,flip?fb.clone().negate():fb);if(n.lengthSq()<0.02)n.crossVectors(u,upC);}return n.normalize();};
  const sec={latP:latP.normalize(),latC:latC.normalize(),
    armN0:hinge(c.arms[0].sh,c.arms[0].el,c.arms[0].ha,fwdC,false),armN1:hinge(c.arms[1].sh,c.arms[1].el,c.arms[1].ha,fwdC,false),
    legN0:hinge(c.legs[0].hip,c.legs[0].kn,c.legs[0].ft,fwdP,true),legN1:hinge(c.legs[1].hip,c.legs[1].kn,c.legs[1].ft,fwdP,true)};
  const T=c._bt||(c._bt=boneTargets(c));const W=S.wq;const all=drive==='all';
  for(const n of M.order){const b=B[n];if(!b)continue;const parent=b.parent&&b.parent.isBone?W[shortBone(b.parent.name)]:null;
    const t=T[n],mp=M.map[n];const wq=W[n]||(W[n]=new THREE.Quaternion());
    const driven=t&&mp&&(all||drive.indexOf(n)>=0);
    if(driven){const p=v3(sub(P[t[1]],P[t[0]]));if(p.lengthSq()<1e-8)p.set(0,1,0);p.normalize();
      const f=sec[t[2]].clone();f.sub(_mv.copy(p).multiplyScalar(f.dot(p)));if(f.lengthSq()<1e-6){f.copy(fwdC);f.sub(_mv.copy(p).multiplyScalar(f.dot(p)));}f.normalize();
      basisMat(_mm,p,f);const fl=_mv2.copy(mp.f).sub(_mv.copy(mp.a).multiplyScalar(mp.f.dot(mp.a))).normalize();basisMat(_mm2,mp.a.clone(),fl);
      _mm.multiply(_mm2.transpose());wq.setFromRotationMatrix(_mm);
      if(parent)b.quaternion.copy(_mq.copy(parent).invert().multiply(wq));else b.quaternion.copy(wq);}
    else{if(all)b.quaternion.copy(M.bind[n].lq);if(parent)wq.copy(parent).multiply(b.quaternion);else wq.copy(b.quaternion);}
    if(n==='Hips'&&all)b.position.set(pel.x/M.scale,(pel.y-0.02)/M.scale,pel.z/M.scale);
  }
}

// region tint written into vertex colors (only when something visible changed)
const TINT={pale:new THREE.Color(0.86,0.84,0.86),cyan:new THREE.Color(0.62,0.72,0.9),dead:new THREE.Color(0.78,0.76,0.78),bruise:new THREE.Color(0.45,0.28,0.42),
  blood:new THREE.Color(0.42,0.03,0.03),burn1:new THREE.Color(1,0.55,0.45),burn2:new THREE.Color(0.55,0.16,0.1),burn3:new THREE.Color(0.07,0.05,0.04),wet:new THREE.Color(0.72,0.72,0.75)};
const EXPOSED={head:1,neck:1,handR:1,handL:1};
function tintSkin(c){
  const S=c.skin,f=c.lossF||0;const cols=[];let hash='';
  for(const r of REG_KEYS){const col=new THREE.Color(1,1,1).multiplyScalar(S.tintK);
    if(EXPOSED[r]){if(f>0.12)col.lerp(TINT.pale,clamp((f-0.12)*2.2,0,0.8));const cy=Math.max((90-c.spo2)/25,(34.5-c.temp)/4);if(cy>0)col.lerp(TINT.cyan,clamp(cy,0,0.6));
      if(!c.alive&&c.deadT>10)col.lerp(TINT.dead,clamp(c.deadT/90,0,0.6));if(c.bruise[r]>0)col.lerp(TINT.bruise,clamp(c.bruise[r]*0.6,0,0.6));}
    if(c.wet>0.3)col.multiply(TINT.wet);
    if(c.soak[r]>0)col.lerp(TINT.blood,clamp(c.soak[r]/280,0,0.85));
    const b=c.burn[r];if(b.deg>0)col.lerp(b.deg===3?TINT.burn3:b.deg===2?TINT.burn2:TINT.burn1,clamp(0.35+b.area*0.7,0,b.deg===3?0.95:b.deg===2?0.85:EXPOSED[r]?0.6:0.25));
    cols.push(col);hash+=col.r.toFixed(2)+col.g.toFixed(2)+col.b.toFixed(2);}
  if(hash===S.hash)return;S.hash=hash;
  for(const e of S.meshes){const a=e.m.geometry.attributes.color,arr=a.array,rg=e.reg;for(let i=0;i<rg.length;i++){const cc=cols[rg[i]];arr[i*3]=cc.r;arr[i*3+1]=cc.g;arr[i*3+2]=cc.b;}a.needsUpdate=true;}
}
// world position of the model's hand (weapon grip)
function skinHand(c,s){const b=c.skin&&c.skin.hand[s];if(!b)return null;b.getWorldPosition(_mv);return{x:_mv.x,y:_mv.y,z:_mv.z};}
