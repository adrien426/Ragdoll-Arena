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
  sc.traverse(o=>{if(o.isBone)bones[shortBone(o.name)]=o;if(o.isSkinnedMesh)skinned.push(o);});
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
  return{kind,scene:sc,bind,map,scale,regs,order,sex:MODEL_FILES[kind]};
}

function loadModels(){
  if(MODELS.ready||MODELS.loading)return;
  if(!THREE.GLTFLoader||!THREE.SkeletonUtils||location.protocol==='file:'){MODELS.failed=true;return;}
  MODELS.loading=true;const ld=new THREE.GLTFLoader();if(window.MeshoptDecoder)ld.setMeshoptDecoder(MeshoptDecoder);
  const jobs=Object.keys(MODEL_FILES).map(k=>new Promise(res=>ld.load('assets/models/'+k+'.glb',g=>{try{const m=prepModel(k,g);if(m)MODELS.kinds[k]=m;}catch(e){console.warn('Model prep failed',k,e);}res();},undefined,e=>{console.warn('Model unavailable',k,e);res();})));
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
  c.skin={root,bones,meshes,M,kind,wq:{},tintK:tint,hash:'',hand:[bones.RightHand,bones.LeftHand]};c.modelKind=kind;
}
function detachSkin(c){if(c.skin){scene.remove(c.skin.root);for(const e of c.skin.meshes)e.m.geometry.dispose();c.skin=null;}}

// pose every bone from the ragdoll points
function poseSkin(c){
  const S=c.skin,M=S.M,P=c.P,B=S.bones;
  const pel=P[c.pelvis];S.root.position.set(0,0,0);
  // body frame helpers
  const latP=v3(sub(P[c.hip[0]],P[c.hip[1]])),latC=v3(sub(P[c.sh[0]],P[c.sh[1]]));
  const upC=v3(sub(P[c.neck],P[c.chest])).normalize(),upP=v3(sub(P[c.chest],P[c.pelvis])).normalize();
  const fwdC=new THREE.Vector3().crossVectors(upC,latC).normalize(),fwdP=new THREE.Vector3().crossVectors(upP,latP).normalize();
  const hinge=(a,b,cc,fb,flip)=>{const u=v3(sub(P[b],P[a])).normalize(),w=v3(sub(P[cc],P[b])).normalize();const n=new THREE.Vector3().crossVectors(u,w);
    if(n.lengthSq()<0.02){n.crossVectors(u,flip?fb.clone().negate():fb);if(n.lengthSq()<0.02)n.crossVectors(u,upC);}return n.normalize();};
  const sec={latP:latP.normalize(),latC:latC.normalize(),
    armN0:hinge(c.arms[0].sh,c.arms[0].el,c.arms[0].ha,fwdC,false),armN1:hinge(c.arms[1].sh,c.arms[1].el,c.arms[1].ha,fwdC,false),
    legN0:hinge(c.legs[0].hip,c.legs[0].kn,c.legs[0].ft,fwdP,true),legN1:hinge(c.legs[1].hip,c.legs[1].kn,c.legs[1].ft,fwdP,true)};
  const T=c._bt||(c._bt=boneTargets(c));
  const W=S.wq;
  for(const n of M.order){const b=B[n];if(!b)continue;const parent=b.parent&&b.parent.isBone?W[shortBone(b.parent.name)]:null;
    const t=T[n],mp=M.map[n];let wq=W[n]||(W[n]=new THREE.Quaternion());
    if(t&&mp){const p=v3(sub(P[t[1]],P[t[0]]));if(p.lengthSq()<1e-8)p.set(0,1,0);p.normalize();
      const f=sec[t[2]].clone();f.sub(_mv.copy(p).multiplyScalar(f.dot(p)));if(f.lengthSq()<1e-6){f.copy(fwdC);f.sub(_mv.copy(p).multiplyScalar(f.dot(p)));}f.normalize();
      basisMat(_mm,p,f);const fl=_mv2.copy(mp.f).sub(_mv.copy(mp.a).multiplyScalar(mp.f.dot(mp.a))).normalize();basisMat(_mm2,mp.a.clone(),fl);
      _mm.multiply(_mm2.transpose());wq.setFromRotationMatrix(_mm);
      if(parent)b.quaternion.copy(_mq.copy(parent).invert().multiply(wq));else b.quaternion.copy(wq);}
    else{b.quaternion.copy(M.bind[n].lq);if(parent)wq.copy(parent).multiply(b.quaternion);else wq.copy(b.quaternion);}
    if(n==='Hips')b.position.set(pel.x/M.scale,(pel.y-0.02)/M.scale,pel.z/M.scale);
  }
  S.root.updateMatrixWorld(true);
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
