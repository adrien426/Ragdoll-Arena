"use strict";
/* =====================================================================
   BODY : ragdoll creation, Verlet physics, active-ragdoll control,
          instanced rendering (skin / clothes colours per region)
   ===================================================================== */
let chars=[],player=null;
const G=9.8/3600,FRIC=0.55;
const KIND_BASE={head:'skin',neck:'skin',thorax:'shirt',abdomen:'shirt',pelvis:'pants',uarmR:'shirt',uarmL:'shirt',larmR:'skin',larmL:'skin',handR:'skin',handL:'skin',thighR:'pants',thighL:'pants',shinR:'pants',shinL:'pants',footR:'shoe',footL:'shoe'};

function makeChar(X,Z,yaw,team,o){
  o=o||{};
  const gy=groundAt(X,Z,o.y!==undefined?o.y:60);
  const f={x:Math.sin(yaw),y:0,z:Math.cos(yaw)},R={x:-Math.cos(yaw),y:0,z:Math.sin(yaw)};
  const P=[],S=[],H=[];
  const pt=(r,u,fw,rad)=>{const x=X+R.x*r+f.x*fw,y=gy+u,z=Z+R.z*r+f.z*fw;P.push({x,y,z,ox:x,oy:y,oz:z,r:rad||0.04,vy:0});return P.length-1;};
  const st=(a,b,part,kind,k)=>{kind=kind||'bone';let len=vlen(sub(P[a],P[b]));if(kind==='min')len*=0.45;const k0=k||(kind==='stiff'?0.35:kind==='rigid'?0.8:1);S.push({a,b,part,kind,len,k0,k:k0,active:true});};
  const head=pt(0,1.68,0,0.11),neck=pt(0,1.5,0,0.05),chest=pt(0,1.25,0,0.11),chestF=pt(0,1.27,0.11,0.05),pelvis=pt(0,0.97,0,0.1);
  const sh=[pt(0.19,1.44,0,0.06),pt(-0.19,1.44,0,0.06)],hip=[pt(0.1,0.92,0,0.07),pt(-0.1,0.92,0,0.07)];
  const Tt=[neck,chest,chestF,pelvis,sh[0],sh[1],hip[0],hip[1]];
  for(let i=0;i<Tt.length;i++)for(let j=i+1;j<Tt.length;j++)st(Tt[i],Tt[j],'torso','rigid');
  st(head,neck,'head');st(head,chest,'neckS','stiff');st(head,sh[0],'neckS','stiff');st(head,sh[1],'neckS','stiff');st(head,chestF,'neckS','stiff');
  H.push({a:head,b:head,reg:'head',r:0.115},{a:neck,b:head,reg:'neck',r:0.055,split:0.5,reg2:'head'},{a:chest,b:neck,tb:0.32,reg:'thorax',r:0.165},{a:sh[0],b:sh[1],reg:'thorax',r:0.07},{a:chest,b:pelvis,reg:'abdomen',r:0.155},{a:hip[0],b:hip[1],reg:'pelvis',r:0.115});
  const arms=[],legs=[];
  for(let s=0;s<2;s++){
    const SS=SIDES[s],o_=s?-1:1;
    const um=pt(o_*0.21,1.29,0),el=pt(o_*0.22,1.14,0),fm=pt(o_*0.22,1.0,0),ha=pt(o_*0.22,0.86,0,0.045);
    st(sh[s],um,'uarm'+SS);st(um,el,'uarm'+SS);st(sh[s],el,'uarm'+SS,'stiff');
    st(el,fm,'larm'+SS);st(fm,ha,'larm'+SS);st(el,ha,'larm'+SS,'stiff');st(sh[s],ha,'larm'+SS,'min');
    arms.push({sh:sh[s],um,el,fm,ha});
    H.push({a:sh[s],b:um,reg:'uarm'+SS,r:0.06},{a:um,b:el,reg:'uarm'+SS,r:0.057},{a:el,b:fm,reg:'larm'+SS,r:0.048},{a:fm,b:ha,reg:'larm'+SS,r:0.047,split:0.62,reg2:'hand'+SS});
    const tm=pt(o_*0.1,0.71,0),kn=pt(o_*0.1,0.5,0),sm=pt(o_*0.1,0.28,0),ft=pt(o_*0.1,0.06,-0.02,0.05),toe=pt(o_*0.1,0.035,0.15,0.035);
    st(hip[s],tm,'thigh'+SS);st(tm,kn,'thigh'+SS);st(hip[s],kn,'thigh'+SS,'stiff');
    st(kn,sm,'shin'+SS);st(sm,ft,'shin'+SS);st(kn,ft,'shin'+SS,'stiff');st(hip[s],ft,'shin'+SS,'min');
    st(ft,toe,'foot'+SS);st(sm,toe,'foot'+SS,'stiff');st(kn,toe,'shin'+SS,'stiff',0.12);
    legs.push({hip:hip[s],tm,kn,sm,ft,toe});
    H.push({a:hip[s],b:tm,reg:'thigh'+SS,r:0.088},{a:tm,b:kn,reg:'thigh'+SS,r:0.078},{a:kn,b:sm,reg:'shin'+SS,r:0.065},{a:sm,b:ft,reg:'shin'+SS,r:0.058},{a:ft,b:toe,reg:'foot'+SS,r:0.046});
  }
  const c={P,S,H,head,neck,chest,chestF,pelvis,sh,hip,arms,legs,team,isPlayer:team===0,weapon:o.weapon||0,yaw,
    sex:o.sex||(Math.random()<0.5?'M':'F'),age:o.age||(Math.random()<0.2?rndi(66,86):rndi(18,65)),seed:Math.random()*100,
    alive:true,phase:0,swing:-1,cd:0,recoil:0,useArm:0,hasWeapon:team!==2,
    aimP:add({x:X,y:gy+1.3,z:Z},mul(f,10)),wDir:f,aimWob:0,downT:0,input:{mx:0,mz:0,jump:false,attack:false,reload:false},
    upT:1,airT:0,jumpCd:0,deadT:0,dmgMul:1,cdMul:1,speedMul:1,stepT:0,sleep:0,lastHit:null,groanT:0,stun:0,
    ai:{react:rnd(0.25,0.6),t:0,off:rnd(-3,3),tgt:null,jit:0,strafe:Math.random()<0.5?1:-1,state:'wander',wp:null,idle:0,fleeT:0,stuck:0,avoidT:0,avoidDir:1,losT:0,los:false,alarmT:-99},
  };
  c.name=o.name||pick(c.sex==='M'?NAMES_M:NAMES_F);
  c.height=o.height||Math.round(c.sex==='M'?rnd(168,192):rnd(156,178));c.weight=o.weight||Math.round((c.height/100)**2*rnd(19.5,28.5)*(c.age>60?1.03:1));c.bloodType=o.bloodType||pickBloodType();
  const hairC=c.age>=62?pick(['#bfbcb6','#d8d6d0','#8f8c88']):c.age>=50&&Math.random()<0.5?'#6e6a66':(o.hair||'#2a1a10');
  c.col={skin:hexL(o.skin||'#d9a47c'),shirt:hexL(o.shirt||'#555555'),pants:hexL(o.pants||'#2a3150'),shoe:hexL(o.shoe||'#151515'),hair:hexL(hairC),eye:hexL('#141414')};
  c.winter=SET.temp<8;c.kind=Object.assign({},KIND_BASE);if(c.winter){c.kind.larmR=c.kind.larmL='shirt';}c.insul=c.winter?0.6:1;
  c.rc={};c.colT=-1;
  initMedical(c);c.bloodMax=c.weight*(c.sex==='M'?70:65)*rnd(0.97,1.03);c.blood=c.bloodMax;c.boneK=c.age>=75?0.65:c.age>=65?0.75:c.age>=50?0.9:1;c.thermoK=c.age>=70?0.8:1;
  c.ammo=WEAPONS.map(w=>w.mag||0);c.reloadT=0;
  buildDrawLists(c);buildWeaponMeshes(c,o.allWeapons);c.modelKind=o.model||null;
  if(typeof attachSkin==='function'&&MODELS.ready)attachSkin(c);
  return c;
}
function buildDrawLists(c){
  const sg=[[c.neck,c.head,0.05,'neck']],jt=[];
  for(let s=0;s<2;s++){const S=SIDES[s],A=c.arms[s],L=c.legs[s];
    sg.push([A.sh,A.um,0.058,'uarm'+S],[A.um,A.el,0.054,'uarm'+S],[A.el,A.fm,0.046,'larm'+S],[A.fm,A.ha,0.04,'larm'+S],[L.hip,L.tm,0.085,'thigh'+S],[L.tm,L.kn,0.075,'thigh'+S],[L.kn,L.sm,0.062,'shin'+S],[L.sm,L.ft,0.052,'shin'+S]);
    jt.push([A.sh,0.068,'uarm'+S],[A.um,0.055,'uarm'+S],[A.el,0.05,'larm'+S],[A.fm,0.044,'larm'+S],[A.ha,0.05,'hand'+S],[L.hip,0.085,'thigh'+S],[L.tm,0.077,'thigh'+S],[L.kn,0.066,'shin'+S],[L.sm,0.056,'shin'+S],[L.ft,0.05,'shin'+S]);}
  c.dSeg=sg;c.dJoint=jt;
}
function buildWeaponMeshes(c,all){
  const g=new THREE.Group();scene.add(g);c.wg=g;c.wm=[];
  WEAPONS.forEach((w,i)=>{if(!all&&!(c.team===1&&i===c.weapon)){c.wm.push(null);return;}const wg=new THREE.Group();wg.visible=false;g.add(wg);buildWeapon(wg,w);c.wm.push(wg);});
}
function buildWeapon(wg,w){
  const ad=(geo,m,x,y,z,rx)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);if(rx)me.rotation.x=rx;me.castShadow=true;wg.add(me);};
  if(w.id==='knife'){ad(new THREE.BoxGeometry(0.025,0.03,0.09),M.metal,0,0,0);ad(new THREE.BoxGeometry(0.006,0.03,0.15),M.steel,0,0,0.12);}
  else if(w.id==='bat'){ad(new THREE.CylinderGeometry(0.02,0.018,0.35,8),M.woodBat,0,0,0.12,Math.PI/2);ad(new THREE.CylinderGeometry(0.035,0.022,0.45,10),M.woodBat,0,0,0.5,Math.PI/2);}
  else if(w.id==='katana'){ad(new THREE.BoxGeometry(0.03,0.03,0.22),M.metal,0,0,0);ad(new THREE.BoxGeometry(0.08,0.01,0.015),M.gold,0,0,0.12);ad(new THREE.BoxGeometry(0.006,0.03,0.75),M.steel,0,0,0.5);}
  else if(w.id==='pistol'){ad(new THREE.BoxGeometry(0.03,0.05,0.19),M.metal,0,0.03,0.07);ad(new THREE.BoxGeometry(0.028,0.09,0.04),M.metal,0,-0.02,0);}
  else if(w.id==='taser'){ad(new THREE.BoxGeometry(0.035,0.06,0.16),M.yellow,0,0.03,0.06);ad(new THREE.BoxGeometry(0.03,0.09,0.04),M.metal,0,-0.02,0);}
  else if(w.id==='molotov'){ad(new THREE.CylinderGeometry(0.035,0.04,0.2,10),M.glassGreen,0,0,0.04,Math.PI/2);ad(new THREE.CylinderGeometry(0.012,0.015,0.07,6),M.white,0,0,0.17,Math.PI/2);}
  else if(w.id==='brick')ad(new THREE.BoxGeometry(0.105,0.07,0.22),M.brickP||M.red,0,0,0.06);
  else if(w.id==='grenade'){ad(new THREE.SphereGeometry(0.045,10,8),M.grenade||M.metalGreen,0,0,0.03);ad(new THREE.BoxGeometry(0.015,0.05,0.02),M.metal,0,0.05,0.03);}
  else if(w.type==='gun'){const L=w.len;ad(new THREE.BoxGeometry(0.045,0.07,L*0.55),M.metal,0,0.02,L*0.3);ad(new THREE.CylinderGeometry(0.012,0.012,L*0.5,8),M.metal,0,0.03,L*0.75,Math.PI/2);
    ad(new THREE.BoxGeometry(0.04,0.09,0.25),w.id==='shotgun'?M.woodBat:M.metal,0,-0.01,-0.15);ad(new THREE.BoxGeometry(0.03,0.08,0.04),M.metal,0,-0.05,0.02);
    if(w.id==='rifle')ad(new THREE.BoxGeometry(0.03,0.12,0.05),M.metal,0,-0.07,0.2);
    if(w.id==='sniper')ad(new THREE.CylinderGeometry(0.022,0.022,0.3,10),M.metal,0,0.08,0.3,Math.PI/2);}
}
function removeChar(c){if(c.wg)scene.remove(c.wg);if(c.skin)detachSkin(c);const i=chars.indexOf(c);if(i>=0)chars.splice(i,1);}

/* ---------- surface anchors (wounds, shards) ---------- */
function capA(c,h){return h.ta?lerp3(c.P[h.a],c.P[h.b],h.ta):c.P[h.a];}
function capB(c,h){return h.tb!==undefined?lerp3(c.P[h.a],c.P[h.b],h.tb):c.P[h.b];}
function capFrame(c,hi){const h=c.H[hi],P=c.P;const a=capA(c,h),b=capB(c,h);let u;if(h.a===h.b)u=norm(sub(P[c.head],P[c.neck]));else u=norm(sub(b,a));
  const tf=norm(cross(UP,sub(P[c.sh[1]],P[c.sh[0]])));const ref=orthoN(dot(tf,tf)>0.5?tf:{x:1,y:0,z:0},u);const ref2=cross(u,ref);return{a,b,u,ref,ref2,h};}
function anchorAt(c,p){let best=null;for(let i=0;i<c.H.length;i++){const h=c.H[i];const r=pointSeg(p,capA(c,h),capB(c,h));const d=r.d-h.r;if(!best||d<best.d)best={hi:i,t:r.t,d};}
  const F=capFrame(c,best.hi);const q=lerp3(F.a,F.b,best.t);const o=sub(p,q);return{hi:best.hi,t:best.t,ang:Math.atan2(dot(o,F.ref2),dot(o,F.ref)),r:F.h.r};}
function anchorPos(c,an,extra){const F=capFrame(c,an.hi);const q=lerp3(F.a,F.b,an.t);const rr=an.r+(extra||0);return add(q,add(mul(F.ref,Math.cos(an.ang)*rr),mul(F.ref2,Math.sin(an.ang)*rr)));}

/* ---------- PHYSICS ---------- */
function physics(c){
  if(!c.alive&&c.sleep>150)return;
  const P=c.P,pel=P[c.pelvis];
  const wl=waterLevel(pel.x,pel.z);
  let minVy=0,impP=-1,avgVy=0;
  for(let i=0;i<P.length;i++){const p=P[i];let vx=(p.x-p.ox)*0.999,vy=(p.y-p.oy)*0.999,vz=(p.z-p.oz)*0.999;
    const vm=Math.abs(vx)+Math.abs(vy)+Math.abs(vz);if(vm>0.7){const k=0.7/vm;vx*=k;vy*=k;vz*=k;}avgVy+=vy;
    if(p.y<wl){vx*=0.92;vy*=0.9;vz*=0.92;vy+=G*(i===0?0.9:i===3?0.85:i===2?1.3:i<=8?1.16:0.95)*(i<=8?1-(c.sink||0)*0.38:1);}
    p.ox=p.x;p.oy=p.y;p.oz=p.z;p.x+=vx;p.y+=vy-G;p.z+=vz;p.vy=vy;p.top=false;}
  const near=boxesNear(pel.x,pel.z,2.6);
  // continuous collision: fast points must not tunnel through walls
  for(const p of P){const dx=p.x-p.ox,dy=p.y-p.oy,dz=p.z-p.oz,dl=Math.sqrt(dx*dx+dy*dy+dz*dz);if(dl<p.r*0.8)continue;
    const o={x:p.ox,y:p.oy,z:p.oz},d={x:dx/dl,y:dy/dl,z:dz/dl};let tb=dl+p.r;
    for(const b of near){if(o.x>b.min.x-0.01&&o.x<b.max.x+0.01&&o.z>b.min.z-0.01&&o.z<b.max.z+0.01&&o.y>b.min.y-0.01&&o.y<b.max.y+0.01)continue;const t=rayBox(o,d,b);if(t!==null&&t<tb)tb=t;}
    if(tb<dl+p.r){const k=Math.max(0,tb-p.r*0.6);p.x=o.x+d.x*k;p.y=o.y+d.y*k;p.z=o.z+d.z*k;
      // keep the tangential velocity, drop the part going into the wall
      p.ox=p.x-dx*0.3;p.oy=p.y-dy*0.3;p.oz=p.z-dz*0.3;}}
  for(let it=0;it<8;it++){
    if(it>=3)jointLimits(c,it>=5);
    for(const s of c.S){
      if(!s.active)continue;const a=P[s.a],b=P[s.b];let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;
      if(s.kind==='min'&&d>=s.len)continue;
      const k=s.k*(d-s.len)/d*0.5;dx*=k;dy*=k;dz*=k;a.x+=dx;a.y+=dy;a.z+=dz;b.x-=dx;b.y-=dy;b.z-=dz;
    }

    for(let i=0;i<P.length;i++){const p=P[i];
      const th=terrainH(p.x,p.z);
      if(p.y<th+p.r){
        if(p.y<th+p.r-0.4&&terrainH(p.ox,p.oz)+p.r<=p.y+0.05){p.x=p.ox;p.z=p.oz;}
        else{if(it===0&&p.vy<minVy){minVy=p.vy;impP=i;}p.y=th+p.r;if(p.oy>p.y)p.oy=p.y;}
      }
      const r=p.r;
      for(const b of near){
        if(p.x>b.min.x-r&&p.x<b.max.x+r&&p.y>b.min.y-r&&p.y<b.max.y+r&&p.z>b.min.z-r&&p.z<b.max.z+r){
          const o0=p.x-(b.min.x-r),o1=(b.max.x+r)-p.x,o2=p.y-(b.min.y-r),o3=(b.max.y+r)-p.y,o4=p.z-(b.min.z-r),o5=(b.max.z+r)-p.z;
          let mi=0,mv=o0;if(o1<mv){mi=1;mv=o1;}if(o2<mv){mi=2;mv=o2;}if(o3<mv){mi=3;mv=o3;}if(o4<mv){mi=4;mv=o4;}if(o5<mv){mi=5;mv=o5;}
          // deep inside : leave through the face the point came from, never through the far side
          if(mv>r*1.2){const e=0.002;if(p.ox<=b.min.x-r+e)mi=0;else if(p.ox>=b.max.x+r-e)mi=1;else if(p.oz<=b.min.z-r+e)mi=4;else if(p.oz>=b.max.z+r-e)mi=5;else if(p.oy>=b.max.y+r-e)mi=3;else if(p.oy<=b.min.y-r+e)mi=2;}
          if(mi===0){p.x=b.min.x-r;p.ox=p.x;}else if(mi===1){p.x=b.max.x+r;p.ox=p.x;}
          else if(mi===2){p.y=b.min.y-r;}else if(mi===3){if(it===0&&p.vy<minVy){minVy=p.vy;impP=i;}p.y=b.max.y+r;if(p.oy>p.y)p.oy=p.y;p.top=true;}
          else if(mi===4){p.z=b.min.z-r;p.oz=p.z;}else{p.z=b.max.z+r;p.oz=p.z;}
        }
      }
    }
  }
  for(const p of P){if(p.top||p.y<=terrainH(p.x,p.z)+p.r+0.01){p.ox=p.x-(p.x-p.ox)*FRIC;p.oz=p.z-(p.z-p.oz)*FRIC;}}
  avgVy/=P.length;
  // safety net : a single non-finite value would spread to the whole body, restore the last good pose instead
  if(!Number.isFinite(P[c.pelvis].x+P[c.pelvis].y+P[c.pelvis].z+P[c.head].y)){if(c._safe){for(let i=0;i<P.length;i++){const q=c._safe[i];Object.assign(P[i],{x:q[0],y:q[1],z:q[2],ox:q[0],oy:q[1],oz:q[2]});}}return;}
  if(!c._safeT||GT-c._safeT>0.5){c._safeT=GT;c._safe=P.map(p=>[p.x,p.y,p.z]);}
  if(minVy<-0.108&&impP>=0&&avgVy<-0.09)fallInjury(c,impP,-Math.max(minVy,avgVy*1.1)*60);
  if(!c.alive){let mv=0;for(const p of P){const v=Math.abs(p.x-p.ox)+Math.abs(p.y-p.oy)+Math.abs(p.z-p.oz);if(v>mv)mv=v;}c.sleep=mv<0.0009?c.sleep+1:0;}
  c.inWater=pel.y<wl;const hd=P[c.head];const hu=norm(sub(hd,P[c.neck]));const hr=orthoN(sub(P[c.sh[0]],P[c.sh[1]]),hu);const hf=cross(hu,hr);const mo={x:hd.x+hf.x*0.085-hu.x*0.045,y:hd.y+hf.y*0.085-hu.y*0.045,z:hd.z+hf.z*0.085-hu.z*0.045};c.mouth=mo;c.headUnder=mo.y<waterLevel(mo.x,mo.z)-0.005;
}
function wake(c){c.sleep=0;}
/* ---------- anatomical joint limits & self collision ----------
   Knee = hinge bending backwards only, hip = cone, limbs cannot pass through the torso or each other. */
function _pushPt(p,dx,dy,dz,k){p.x+=dx*k;p.y+=dy*k;p.z+=dz*k;}
function jointLimits(c,self){
  const P=c.P;const pel=P[c.pelvis],ch=P[c.chest];
  let ux=ch.x-pel.x,uy=ch.y-pel.y,uz=ch.z-pel.z;let l=Math.hypot(ux,uy,uz)||1;ux/=l;uy/=l;uz/=l;
  const h0=P[c.hip[0]],h1=P[c.hip[1]];let rx=h0.x-h1.x,ry=h0.y-h1.y,rz=h0.z-h1.z;l=Math.hypot(rx,ry,rz)||1;rx/=l;ry/=l;rz/=l; // body right
  const fx=uy*rz-uz*ry,fy=uz*rx-ux*rz,fz=ux*ry-uy*rx; // forward = up x right
  for(let s=0;s<2;s++){const L=c.legs[s],hip=P[L.hip],kn=P[L.kn],ft=P[L.ft],sg=s===0?1:-1;
    // ---- hip cone : no hyper-extension, no crossing far over the midline, no thigh above the head
    let tx=kn.x-hip.x,ty=kn.y-hip.y,tz=kn.z-hip.z;const tl=Math.hypot(tx,ty,tz)||1e-6;tx/=tl;ty/=tl;tz/=tl;
    let f=tx*fx+ty*fy+tz*fz,dn=-(tx*ux+ty*uy+tz*uz),lo=sg*(tx*rx+ty*ry+tz*rz);
    let fix=false;if(f<-0.5){f=-0.5;fix=true;}if(lo<-0.28){lo=-0.28;fix=true;}if(dn<-0.4){dn=-0.4;fix=true;}
    if(fix){let nx=fx*f-ux*dn+rx*sg*lo,ny=fy*f-uy*dn+ry*sg*lo,nz=fz*f-uz*dn+rz*sg*lo;const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
      const k=0.5;kn.x+=(hip.x+nx*tl-kn.x)*k;kn.y+=(hip.y+ny*tl-kn.y)*k;kn.z+=(hip.z+nz*tl-kn.z)*k;tx=nx;ty=ny;tz=nz;}
    // ---- knee hinge : shin may only fold backwards (more play if the cruciate / collateral ligaments are torn)
    const lig=Math.min(c.mus[MUS_IDX['acl'+SIDES[s]]],c.mus[MUS_IDX['pcl'+SIDES[s]]],c.mus[MUS_IDX['mcl'+SIDES[s]]]);const tol=lig<40?0.22:0.04;
    let wx=ft.x-kn.x,wy=ft.y-kn.y,wz=ft.z-kn.z;const wl=Math.hypot(wx,wy,wz)||1e-6;
    // bend direction d = (-right) x thigh  (points backwards for a standing body)
    let dx=-(ry*tz-rz*ty),dy=-(rz*tx-rx*tz),dz=-(rx*ty-ry*tx);const dl=Math.hypot(dx,dy,dz);
    if(dl>0.3){dx/=dl;dy/=dl;dz/=dl;
      const a=(wx*dx+wy*dy+wz*dz)/wl;if(a<-tol){const m=(-tol-a)*wl;_pushPt(ft,dx,dy,dz,m*0.65);_pushPt(kn,dx,dy,dz,-m*0.35);}
      // varus / valgus : limited sideways fold
      let qx=dy*tz-dz*ty,qy=dz*tx-dx*tz,qz=dx*ty-dy*tx;const b=(wx*qx+wy*qy+wz*qz)/wl;const lim=lig<40?0.4:0.18;
      if(Math.abs(b)>lim){const m=(Math.abs(b)-lim)*wl*Math.sign(b);_pushPt(ft,qx,qy,qz,-m*0.65);_pushPt(kn,qx,qy,qz,m*0.35);}}
  }
  if(!self)return;
  // limbs vs torso capsule (pelvis -> neck)
  const nk=P[c.neck];
  const torso=(pi,R)=>{const p=P[pi];const r=pointSeg(p,pel,nk);if(r.d<R&&r.d>1e-5){const q=lerp3(pel,nk,r.t);const m=(R-r.d)/r.d;p.x+=(p.x-q.x)*m;p.y+=(p.y-q.y)*m;p.z+=(p.z-q.z)*m;}};
  for(const A of c.arms){torso(A.el,0.13);torso(A.fm,0.13);torso(A.ha,0.12);}
  for(const L of c.legs){torso(L.kn,0.12);torso(L.sm,0.12);torso(L.ft,0.11);}
  // legs vs each other (thighs and shins)
  const L0=c.legs[0],L1=c.legs[1];
  for(const [a0,b0,a1,b1,R] of [[L0.hip,L0.kn,L1.hip,L1.kn,0.15],[L0.kn,L0.ft,L1.kn,L1.ft,0.11]]){
    const A0=P[a0],B0=P[b0],A1=P[a1],B1=P[b1];const r=segSeg(A0,B0,A1,B1);if(r.d>=R||r.d<1e-5)continue;
    const p0=lerp3(A0,B0,r.s),p1=lerp3(A1,B1,r.t);const nx=(p0.x-p1.x)/r.d,ny=(p0.y-p1.y)/r.d,nz=(p0.z-p1.z)/r.d,m=(R-r.d)*0.5;
    _pushPt(B0,nx,ny,nz,m*(0.3+r.s));_pushPt(B1,nx,ny,nz,-m*(0.3+r.t));if(a0!==L0.hip){_pushPt(A0,nx,ny,nz,m*(1.3-r.s));_pushPt(A1,nx,ny,nz,-m*(1.3-r.t));}}
}
function nudge(p,t,k,damp){p.x+=(t.x-p.x)*k;p.y+=(t.y-p.y)*k;p.z+=(t.z-p.z)*k;damp=damp||0.85;p.ox=p.x-(p.x-p.ox)*damp;p.oy=p.y-(p.y-p.oy)*damp;p.oz=p.z-(p.z-p.oz)*damp;}

/* ---------- ACTIVE RAGDOLL CONTROL ---------- */
function control(c,dt){
  const P=c.P,pel=P[c.pelvis];
  c.airT-=dt;c.jumpCd-=dt;
  if(c.tasedT>0){spasm(c,0.012);c.upT=0;return;}
  const conscious=c.alive&&c.conscious&&!c.arrest;
  if(!conscious||c.stun>0||c.tetra){c.upT=0;if(conscious&&c.tetra)c.crawling=false;return;}
  const f={x:Math.sin(c.yaw),y:0,z:Math.cos(c.yaw)},R={x:-Math.cos(c.yaw),y:0,z:Math.sin(c.yaw)};
  // kinematic character controller (animated body) : move the capsule, the arms still aim physically
  if(c.k&&c.k.mode==='ctrl'){if(c.input.attack)c._aimT=GT+0.8;ctrlMove(c,dt);c.crawling=false;armControl(c,f,R,1,!c.k.grounded);return;}
  const gh=groundAt(pel.x,pel.z,pel.y-0.45);
  const wl=waterLevel(pel.x,pel.z);
  const footY=Math.min(P[c.legs[0].ft].y,P[c.legs[1].ft].y)-gh;
  const onGround=footY<0.17||pel.y-gh<0.55;c.onGround=onGround;c.gndY=gh;
  const mv={x:c.input.mx,y:0,z:c.input.mz};
  c.upT=Math.min(1,c.upT+dt*(c.canStand?0.8:0.4));
  const ramp=0.15+0.85*c.upT;
  c.crawling=false;
  if(wl>gh+1.3&&pel.y<wl+0.35){ // swimming
    const sk=c.sink||0,sw=1-sk*0.85;nudge(P[c.head],{x:pel.x+f.x*0.5,y:wl+0.12-sk*0.7,z:pel.z+f.z*0.5},0.08*sw,0.9);nudge(P[c.chest],{x:pel.x+f.x*0.25,y:wl-0.05-sk*0.6,z:pel.z+f.z*0.25},0.06*sw,0.9);
    if(sk>0.2&&Math.random()<0.25)spasm(c,0.006*sk);
    if(mv.x||mv.z){for(const i of [c.chest,c.neck,c.head,c.pelvis]){P[i].x+=mv.x*0.012;P[i].z+=mv.z*0.012;}}
    c.wet=1;
  }else if(c.canStand){
    const lf=c.legFn,sup=c.support,pain=c.painEff;
    const standH=gh+0.95-(1-sup)*0.14-pain*0.0005;
    const k=(onGround&&c.airT<=0?0.2:0.02)*ramp*(0.55+0.45*sup);
    const dz=c.dizzy;const sw=dz>8?Math.sin(GT*1.7+c.seed)*dz*0.0012:0,sw2=dz>8?Math.cos(GT*1.13+c.seed*2)*dz*0.0008:0;
    const lean={x:mv.x*0.05+R.x*sw+f.x*sw2,z:mv.z*0.05+R.z*sw+f.z*sw2};
    const dmp=onGround&&c.airT<=0?0.9:1;
    nudge(pel,{x:pel.x,y:onGround?standH:pel.y,z:pel.z},k,dmp);
    const at=(u,r,fw,l)=>({x:pel.x+R.x*r+f.x*fw+lean.x*l,y:pel.y+u,z:pel.z+R.z*r+f.z*fw+lean.z*l});
    nudge(P[c.chest],at(0.28,0,0,1),k,dmp);nudge(P[c.chestF],at(0.3,0,0.11,1),k,dmp);nudge(P[c.neck],at(0.53,0,0,1.4),k,dmp);nudge(P[c.head],at(0.71,0,0.02,1.7),k,dmp);
    nudge(P[c.sh[0]],at(0.47,0.19,0,1.3),k,dmp);nudge(P[c.sh[1]],at(0.47,-0.19,0,1.3),k,dmp);nudge(P[c.hip[0]],at(-0.05,0.1,0,0),k,dmp);nudge(P[c.hip[1]],at(-0.05,-0.1,0,0),k,dmp);
    const wade=pel.y<wl?0.5:1;
    const sp=0.05*c.speedF*c.speedMul*wade;
    const want=mul(mv,sp);
    if(onGround)for(const i of [c.head,c.neck,c.chest,c.chestF,c.pelvis,c.sh[0],c.sh[1],c.hip[0],c.hip[1]]){const p=P[i];const vx=p.x-p.ox,vz=p.z-p.oz;p.ox=p.x-(vx+(want.x-vx)*0.3*ramp);p.oz=p.z-(vz+(want.z-vz)*0.3*ramp);}
    const V={x:pel.x-pel.ox,y:0,z:pel.z-pel.oz};const spH=Math.hypot(V.x,V.z);
    c.phase+=spH*10.5;
    const amt=clamp(spH/0.025,0,1);const dirV=spH>1e-4?mul(V,1/spH):f;
    c.stepT-=spH;if(c.stepT<0&&onGround&&amt>0.5){c.stepT=0.7;sfxAt(pel);SFX.step();}
    const weak=lf[0]<lf[1]?0:1;
    if(lf[weak]<0.6&&amt>0.2){const ph=c.phase+weak*Math.PI;pel.y-=Math.max(0,-Math.cos(ph))*(0.6-lf[weak])*0.035*amt;}
    for(let s=0;s<2;s++){
      if(lf[s]<0.15)continue;
      const L=c.legs[s],ph=c.phase+s*Math.PI,hp=P[L.hip];const q=0.4+0.6*lf[s];
      const ft={x:hp.x+dirV.x*Math.sin(ph)*0.3*amt*q+f.x*0.02,y:gh+0.06+Math.max(0,Math.cos(ph))*0.13*amt*q,z:hp.z+dirV.z*Math.sin(ph)*0.3*amt*q+f.z*0.02};
      if(onGround&&c.airT<=0){
        nudge(P[L.ft],ft,0.33*ramp,0.8);nudge(P[L.toe],{x:ft.x+f.x*0.16,y:ft.y-0.02,z:ft.z+f.z*0.16},0.25*ramp,0.8);
        nudge(P[L.kn],{x:(hp.x+ft.x)/2+f.x*0.09,y:(hp.y+ft.y)/2,z:(hp.z+ft.z)/2+f.z*0.09},0.2*ramp,0.85);
      }
    }
    if(c.input.jump&&onGround&&lf[0]>0.7&&lf[1]>0.7&&c.jumpCd<=0&&c.painEff<60){for(const p of P)p.oy=p.y-0.058;c.airT=0.4;c.jumpCd=0.8;}
    if(dz>45&&Math.random()<dt*0.1*(dz-45)/20)c.stun=Math.max(c.stun,rnd(0.8,1.6));
  }else{
    if(onGround&&(mv.x||mv.z)&&(c.armFn[0]+c.armFn[1])>0.5){
      const cs=0.0065*Math.min(1,(c.armFn[0]+c.armFn[1])/2)*(1-c.painEff*0.005);
      for(const i of [c.chest,c.neck,c.head,c.sh[0],c.sh[1],c.chestF]){P[i].x+=mv.x*cs;P[i].z+=mv.z*cs;}
      const s=Math.sin(GT*3.2)>0?0:1;const A=c.arms[s],shp=P[A.sh];
      if(c.armFn[s]>0.2){const tx=shp.x+mv.x*0.42+R.x*(s?-0.15:0.15),tz=shp.z+mv.z*0.42+R.z*(s?-0.15:0.15);nudge(P[A.ha],{x:tx,y:groundAt(tx,tz,shp.y)+0.05,z:tz},0.2,0.85);}
      c.crawling=true;
    }
    if(c.painEff>55&&Math.random()<0.06)spasm(c,0.02);
  }
  armControl(c,f,R,ramp,!onGround);
  if(c.shiver>0){const a=c.shiver*0.0035;for(const i of [c.chest,c.head,c.arms[0].ha,c.arms[1].ha]){P[i].x+=rnd(-a,a);P[i].y+=rnd(-a,a);P[i].z+=rnd(-a,a);}}
}
function spasm(c,a){const P=c.P;for(const A of c.arms){const p=P[A.ha];p.x+=rnd(-a,a);p.y+=rnd(-a,a);p.z+=rnd(-a,a);}for(const L of c.legs){const p=P[L.ft];p.x+=rnd(-a,a);p.z+=rnd(-a,a);}}
function armControl(c,f,R,ramp,air){
  const P=c.P,w=WEAPONS[c.weapon];
  const ok=[c.armFn[0]>0.18,c.armFn[1]>0.18];
  c.useArm=ok[0]?0:(ok[1]?1:-1);
  if(c.crawling)return;
  const wob=c.aimWob=(1-Math.min(c.armFn[Math.max(0,c.useArm)],1))*0.05+c.painEff*0.0005+c.shiver*0.02+c.dizzy*0.0006;
  const nk=P[c.neck];const dist=vlen(sub(c.aimP,nk));
  const aimP={x:c.aimP.x+Math.sin(GT*7.3+c.seed)*wob*dist,y:c.aimP.y+Math.cos(GT*5.7+c.seed)*wob*dist,z:c.aimP.z+Math.sin(GT*6.1+c.seed*3)*wob*dist};
  const flail=c.burning>0&&!c.isPlayer;
  for(let s=0;s<2;s++){
    if(!ok[s])continue;
    const A=c.arms[s],shp=P[A.sh],side=s?-1:1;
    let hand;
    if(flail)hand=add(shp,{x:rnd(-0.5,0.5),y:rnd(-0.2,0.5),z:rnd(-0.5,0.5)});
    else if(s===c.useArm&&c.hasWeapon&&!(c.holdW&&c.holdArm===s)){
      const d=norm(sub(aimP,shp));
      if(w.type==='gun'||w.type==='taser'){hand=add(shp,mul(d,0.5-c.recoil*0.07));c.wDir=d;}
      else if(w.id==='fists'){const e=c.swing<0?0:Math.sin(c.swing*Math.PI);hand=add(add(shp,mul(d,0.25+e*0.32)),mul(UP,-0.05));c.wDir=d;}
      else if(w.type==='throw'){const th=c.swing<0?0.5:2.2-3*c.swing;const v=norm(add(mul(d,Math.cos(th)),mul(UP,Math.sin(th))));hand=add(shp,mul(v,0.5));c.wDir=v;}
      else{const th=c.swing<0?0.15:1.7-2.5*(1-Math.pow(1-c.swing,2));const v=norm(add(mul(d,Math.cos(th)),add(mul(UP,Math.sin(th)),mul(R,-side*0.25))));hand=add(shp,mul(v,0.45));c.wDir=norm(add(v,mul(d,0.6)));}
    }
    else if(s!==c.useArm&&c.hasWeapon&&w.two&&w.type==='gun'&&c.useArm>=0&&!(c.holdW&&c.holdArm===s)){const msh=P[c.arms[c.useArm].sh];hand=add(msh,mul(norm(sub(aimP,msh)),0.36));}
    else if(c.holdW&&c.holdArm===s){hand=anchorPos(c,c.holdW.an,0.03);}
    else if(c.hasWeapon&&w.id==='fists'){hand=add(shp,mul(norm(sub(aimP,shp)),0.2));}
    else if(c.ai&&c.ai.state==='flee'&&!c.isPlayer){hand=add(shp,add(mul(UP,-0.35),add(mul(f,Math.sin(c.phase+s*Math.PI)*0.3),mul(R,side*0.08))));}
    else hand=add(shp,add(mul(UP,-0.52),mul(f,0.08)));
    const elb=add(lerp3(shp,hand,0.5),add(mul(UP,-0.07),mul(R,side*0.06)));
    if(air){nudge(P[A.ha],hand,0.06,1);nudge(P[A.el],elb,0.04,1);}else{nudge(P[A.ha],hand,0.4*ramp,0.85);nudge(P[A.el],elb,0.25*ramp,0.9);}
  }
}

/* ---------- RENDERING (instanced) ---------- */
const _m=new THREE.Matrix4(),_mb=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_v=new THREE.Vector3(),_bx=new THREE.Vector3(),_by=new THREE.Vector3(),_bz=new THREE.Vector3();
const YA=new THREE.Vector3(0,1,0),ZA=new THREE.Vector3(0,0,1);const _qh=new THREE.Quaternion(),_qtilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),0.55);
const CPALE=hexL('#d6cec4'),CCYAN=hexL('#8796b8'),CFLUSH=hexL('#d8665a'),CBRUISE=hexL('#4e2c5a'),CBLOOD=hexL('#4a0404'),
  CBURN=[null,hexL('#ff6a55'),hexL('#a8281c'),hexL('#120c0a')],CWET=hexL('#2c2e33'),CDEAD=hexL('#b5ada5');
function updateColors(c){
  const f=c.lossF||0;
  for(const r of REG_KEYS){
    const kind=c.kind[r];const col=c.rc[r]||(c.rc[r]=new THREE.Color());col.copy(c.col[kind]);
    if(kind==='skin'){
      if(f>0.12)col.lerp(CPALE,clamp((f-0.12)*2.2,0,0.72));
      const cy=Math.max((90-c.spo2)/25,(34.5-c.temp)/4);if(cy>0)col.lerp(CCYAN,clamp(cy,0,0.55));
      if(!c.alive&&c.deadT>10)col.lerp(CDEAD,clamp(c.deadT/90,0,0.5));
      if(c.temp>39.2&&c.alive)col.lerp(CFLUSH,clamp((c.temp-39.2)/3,0,0.4));
      if(c.bruise[r]>0)col.lerp(CBRUISE,clamp(c.bruise[r]*0.6,0,0.6));
    }else if(c.wet>0.3)col.lerp(CWET,c.wet*0.25);
    if(c.soak[r]>0)col.lerp(CBLOOD,clamp(c.soak[r]/(kind==='skin'?260:380),0,kind==='skin'?0.6:0.85));
    const b=c.burn[r];if(b.deg>0)col.lerp(CBURN[b.deg],clamp(0.35+b.area*0.7,0,b.deg===3?0.95:b.deg===2?0.85:0.65));
  }
}
function basisQ(q,right,up){const u=norm(up);let r=sub(right,mul(u,dot(right,u)));const rl=vlen(r);r=rl>1e-5?mul(r,1/rl):orthoN({x:1,y:0,z:0},u);const z=cross(r,u);_bx.set(r.x,r.y,r.z);_by.set(u.x,u.y,u.z);_bz.set(z.x,z.y,z.z);_mb.makeBasis(_bx,_by,_bz);q.setFromRotationMatrix(_mb);}
function renderCharacters(){
  let ci=0,si=0,bi=0,hi=0,ei=0,wi=0,di=0;
  const camP=camera.position;
  for(const c of chars){
    const P=c.P,rc=c.rc;
    if(c.skin){poseSkin(c);if(GT-c.colT>0.2||c.colT<0){tintSkin(c);c.colT=GT;}}else{
    if(GT-c.colT>0.2||c.colT<0){updateColors(c);c.colT=GT;}
    for(const d of c.dSeg){if(ci>=POOL.cyl.instanceMatrix.count)break;const a=P[d[0]],b=P[d[1]];_v.set(b.x-a.x,b.y-a.y,b.z-a.z);const L=_v.length()||1e-4;_v.multiplyScalar(1/L);_q.setFromUnitVectors(YA,_v);_p.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);_s.set(d[2],L,d[2]);_m.compose(_p,_q,_s);POOL.cyl.setMatrixAt(ci,_m);POOL.cyl.setColorAt(ci,rc[d[3]]);ci++;}
    _q.identity();
    for(const j of c.dJoint){const p=P[j[0]];_p.set(p.x,p.y,p.z);_s.setScalar(j[1]);_m.compose(_p,_q,_s);POOL.sph.setMatrixAt(si,_m);POOL.sph.setColorAt(si,rc[j[2]]);si++;}
    // torso boxes
    const right=sub(P[c.sh[0]],P[c.sh[1]]),hr=sub(P[c.hip[0]],P[c.hip[1]]);
    const upT=sub(P[c.neck],P[c.chest]),upB=sub(P[c.chest],P[c.pelvis]);
    const cm=lerp3(lerp3(P[c.sh[0]],P[c.sh[1]],0.5),P[c.chest],0.55);
    basisQ(_q,right,upT);_p.set(cm.x,cm.y,cm.z);_s.set(0.38,0.34,0.22);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,rc.thorax);bi++;
    const bm=lerp3(P[c.chest],P[c.pelvis],0.5);basisQ(_q,add(right,hr),upB);_p.set(bm.x,bm.y,bm.z);_s.set(0.33,0.25,0.19);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,rc.abdomen);bi++;
    const pm=lerp3(P[c.hip[0]],P[c.hip[1]],0.5);basisQ(_q,hr,upB);_p.set(pm.x,pm.y+0.03,pm.z);_s.set(0.35,0.18,0.21);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,rc.pelvis);bi++;
    for(let s=0;s<2;s++){const L=c.legs[s];const ft=P[L.ft],toe=P[L.toe];const fd=sub(toe,ft);basisQ(_q,hr,cross(fd,hr));const mid=lerp3(ft,toe,0.45);_p.set(mid.x,mid.y-0.005,mid.z);_s.set(0.1,0.075,0.27);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,rc['foot'+SIDES[s]]);bi++;}
    // head
    const hp=P[c.head],hu=sub(hp,P[c.neck]);basisQ(_q,right,hu);
    _p.set(hp.x,hp.y,hp.z);_s.set(0.105,0.12,0.11);_m.compose(_p,_q,_s);POOL.sph.setMatrixAt(si,_m);POOL.sph.setColorAt(si,rc.head);si++;
    const u=norm(hu),r=orthoN(right,u),fz=cross(r,u); // fz = -forward
    const fw=mul(fz,-1);
    const hc=add(hp,add(mul(u,0.012),mul(fw,-0.014)));_p.set(hc.x,hc.y,hc.z);_s.set(0.114,0.126,0.12);_qh.copy(_q).multiply(_qtilt);_m.compose(_p,_qh,_s);POOL.hair.setMatrixAt(hi,_m);POOL.hair.setColorAt(hi,c.col.hair);hi++;
    const closed=!c.alive||!c.conscious;
    for(const sg of [-1,1]){const e=add(hp,add(mul(r,sg*0.036),add(mul(u,0.018),mul(fw,0.1))));_p.set(e.x,e.y,e.z);_s.set(0.016,closed?0.004:0.014,0.012);_m.compose(_p,_q,_s);POOL.eye.setMatrixAt(ei,_m);POOL.eye.setColorAt(ei,c.eyeRed?CBLOOD:c.col.eye);ei++;
      const ea=add(hp,add(mul(r,sg*0.106),mul(u,0.0)));_p.set(ea.x,ea.y,ea.z);_s.set(0.014,0.028,0.02);_m.compose(_p,_q,_s);POOL.sph.setMatrixAt(si,_m);POOL.sph.setColorAt(si,rc.head);si++;
      const br=add(hp,add(mul(r,sg*0.036),add(mul(u,0.042),mul(fw,0.103))));_p.set(br.x,br.y,br.z);_s.set(0.03,0.006,0.008);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,c.col.hair);bi++;}
    const ns=add(hp,add(mul(u,-0.012),mul(fw,0.112)));_p.set(ns.x,ns.y,ns.z);_s.set(0.024,0.045,0.035);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,rc.head);bi++;
    const mo=add(hp,add(mul(u,-0.055),mul(fw,0.1)));_p.set(mo.x,mo.y,mo.z);_s.set(0.04,c.painEff>50&&c.alive?0.012:0.007,0.012);_m.compose(_p,_q,_s);POOL.box.setMatrixAt(bi,_m);POOL.box.setColorAt(bi,MOUTHC);bi++;
    }
    // wounds
    for(const w of c.wounds){if(wi>=360)break;const p=anchorPos(c,w.an,-0.004);_p.set(p.x,p.y,p.z);const sz=w.size||0.02;_s.setScalar(sz*(w.bandaged?1.6:1));_m.compose(_p,_q.identity(),_s);POOL.wound.setMatrixAt(wi,_m);POOL.wound.setColorAt(wi,w.bandaged?BANDC:w.exit?WEXIT:WENT);wi++;}
    for(const sh of c.shards){if(di>=80)break;const p=anchorPos(c,sh.an,0.012);_p.set(p.x,p.y,p.z);_q.setFromEuler(sh.e);_s.set(0.014,0.014,0.07);_m.compose(_p,_q,_s);POOL.shard.setMatrixAt(di,_m);POOL.shard.setColorAt(di,c.splint[sh.id]?BANDC:SHARDC);di++;}
    // weapon
    if(c.wm){for(const g of c.wm)if(g)g.visible=false;
      const w=WEAPONS[c.weapon],g=c.wm[c.weapon];
      if(g&&c.alive&&c.useArm>=0&&w.len>0&&c.reloadT<=0&&!c.crawling){if(!g.userData.real&&!g.userData.tried&&PROPS.ready){g.userData.tried=true;realWeapon(g,w);}g.visible=true;const h=(c.skin&&skinHand(c,c.useArm))||P[c.arms[c.useArm].ha];g.position.set(h.x,h.y,h.z);const wd=(c.skin&&skinWeaponDir(c,c.useArm))||c.wDir;_v.set(wd.x,wd.y,wd.z).normalize();g.quaternion.setFromUnitVectors(ZA,_v);}}
  }
  POOL.cyl.count=ci;POOL.sph.count=si;POOL.box.count=bi;POOL.hair.count=hi;POOL.eye.count=ei;POOL.wound.count=wi;POOL.shard.count=di;
  for(const k in POOL){const m=POOL[k];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
}
const MOUTHC=hexL('#5a2a28'),BANDC=hexL('#ece8df'),WEXIT=hexL('#560303'),WENT=hexL('#2e0101'),SHARDC=hexL('#f3ecdc');
