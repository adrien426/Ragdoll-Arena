"use strict";
/* =====================================================================
   ENGINE : math, audio, renderer, textures, materials, particles
   ===================================================================== */
const rnd=(a,b)=>a+Math.random()*(b-a);
const rndi=(a,b)=>Math.floor(rnd(a,b+1));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const vlen=a=>Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const norm=a=>{const l=vlen(a)||1e-6;return{x:a.x/l,y:a.y/l,z:a.z/l};};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const lerp3=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const UP={x:0,y:1,z:0};
const hdist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function orthoN(v,axis){const r=sub(v,mul(axis,dot(v,axis)));const l=vlen(r);if(l<1e-5){const alt=Math.abs(axis.y)<0.9?UP:{x:1,y:0,z:0};return norm(cross(axis,alt));}return mul(r,1/l);}
function segSeg(p1,q1,p2,q2){
  const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2);const a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s,t;
  if(a<=1e-9&&e<=1e-9){s=t=0;}
  else if(a<=1e-9){s=0;t=clamp(f/e,0,1);}
  else{const c=dot(d1,r);if(e<=1e-9){t=0;s=clamp(-c/a,0,1);}else{const b=dot(d1,d2),den=a*e-b*b;s=den!==0?clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}}}
  const c1=add(p1,mul(d1,s)),c2=add(p2,mul(d2,t));return{s,t,d:vlen(sub(c1,c2))};
}
function pointSeg(p,a,b){const ab=sub(b,a);const t=clamp(dot(sub(p,a),ab)/(dot(ab,ab)||1e-9),0,1);return{t,d:vlen(sub(p,add(a,mul(ab,t))))};}
function rayBox(o,d,b){let tmin=0,tmax=1e9;for(const k of ['x','y','z']){if(Math.abs(d[k])<1e-9){if(o[k]<b.min[k]||o[k]>b.max[k])return null;}else{let t1=(b.min[k]-o[k])/d[k],t2=(b.max[k]-o[k])/d[k];if(t1>t2){const q=t1;t1=t2;t2=q;}if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;if(tmin>tmax)return null;}}return tmin;}
let GT=0; // game time (s)

/* ================= AUDIO ================= */
let AC=null,NB=null,MASTER=null,SV=1;
function initAudio(){
  if(AC){if(AC.state==='suspended')AC.resume();return;}
  try{AC=new(window.AudioContext||window.webkitAudioContext)();MASTER=AC.createGain();MASTER.gain.value=SET.volume;MASTER.connect(AC.destination);
    const n=AC.sampleRate*2;NB=AC.createBuffer(1,n,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}catch(e){AC=null;}
}
function setVolume(v){if(MASTER)MASTER.gain.value=v;}
function noise(dur,type,freq,vol,q,delay){if(!AC)return;vol*=SV;if(vol<0.003)return;const t=AC.currentTime+(delay||0),s=AC.createBufferSource();s.buffer=NB;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);s.connect(f);f.connect(g);g.connect(MASTER);s.start(t,Math.random()*1.5);s.stop(t+dur+0.02);}
function tone(f0,f1,dur,type,vol,delay){if(!AC)return;vol*=SV;if(vol<0.003)return;const t=AC.currentTime+(delay||0),o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.connect(g);g.connect(MASTER);o.start(t);o.stop(t+dur+0.02);}
function voice(base,dur,vol,rough){if(!AC)return;vol*=SV;if(vol<0.003)return;const t=AC.currentTime,o=AC.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(base,t);o.frequency.linearRampToValueAtTime(base*rnd(1.05,1.25),t+dur*0.3);o.frequency.linearRampToValueAtTime(base*0.7,t+dur);
  const lfo=AC.createOscillator();lfo.frequency.value=rnd(5,9);const lg=AC.createGain();lg.gain.value=base*0.04*(rough||1);lfo.connect(lg);lg.connect(o.frequency);
  const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=base*5;f.Q.value=1.2;const g=AC.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+0.05);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(f);f.connect(g);g.connect(MASTER);o.start(t);lfo.start(t);o.stop(t+dur+0.05);lfo.stop(t+dur+0.05);}
const SFX={
  punch(){tone(150,45,0.12,'sine',0.5);noise(0.06,'lowpass',800,0.4);},
  blunt(){tone(110,35,0.2,'sine',0.75);noise(0.1,'lowpass',600,0.55);},
  slash(){noise(0.15,'bandpass',3000,0.35,2);noise(0.08,'lowpass',500,0.35);},
  stab(){noise(0.06,'lowpass',500,0.5);tone(90,50,0.08,'sine',0.35);},
  crack(){noise(0.05,'highpass',2500,0.9);noise(0.09,'bandpass',1200,0.8,4);tone(90,40,0.12,'square',0.2);},
  shot(v){v=v||1;noise(0.3*v,'lowpass',1900,0.85);tone(160,40,0.15,'square',0.25);noise(0.9,'lowpass',300,0.15,0,0.05);},
  big(){noise(0.65,'lowpass',1000,1);tone(90,30,0.3,'sawtooth',0.4);noise(1.4,'lowpass',250,0.25,0,0.08);},
  flesh(){noise(0.07,'lowpass',400,0.6);tone(80,40,0.08,'sine',0.4);},
  ric(){noise(0.06,'highpass',3000,0.25);tone(2400,900,0.12,'sine',0.06);},
  swing(){noise(0.12,'bandpass',900,0.18,1);},
  heal(){tone(500,900,0.15,'sine',0.15);},
  step(){noise(0.04,'lowpass',300,0.07);},
  thud(){tone(70,30,0.25,'sine',0.8);noise(0.15,'lowpass',300,0.6);},
  glass(){noise(0.25,'highpass',4000,0.5);tone(3200,1800,0.2,'triangle',0.08);},
  whoosh(){noise(0.8,'lowpass',700,0.6);},
  taser(){for(let i=0;i<6;i++)noise(0.05,'bandpass',3500,0.3,6,i*0.07);},
  splash(){noise(0.5,'lowpass',1200,0.5);},
  reload(){tone(1200,900,0.04,'square',0.08);tone(700,500,0.05,'square',0.08,0.25);},
  click(){tone(1500,1200,0.03,'square',0.06);},
  heart(){tone(62,40,0.12,'sine',0.55);tone(55,35,0.1,'sine',0.38,0.15);},
  flat(){tone(880,880,1.2,'sine',0.12);},
  ring(){tone(4200,4100,3,'sine',0.05);},
  cough(){noise(0.15,'bandpass',600,0.4,1);noise(0.12,'bandpass',500,0.35,1,0.22);},
  groan(p){voice(rnd(105,150)*(p||1),rnd(0.45,0.7),0.17,1);},
  scream(p){voice(rnd(230,330)*(p||1),rnd(0.7,1.1),0.22,2.5);},
};
function sfxAt(pos){if(!camera||!pos){SV=1;return;}const d=Math.hypot(pos.x-camera.position.x,pos.y-camera.position.y,pos.z-camera.position.z);SV=clamp(1.15-d/38,0.08,1);}
const LOOPS={};
function loopSnd(name,type,freq,q){if(!AC)return null;if(LOOPS[name])return LOOPS[name];const s=AC.createBufferSource();s.buffer=NB;s.loop=true;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;const g=AC.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(MASTER);s.start();LOOPS[name]={g,f};return LOOPS[name];}
function loopVol(name,v){const L=LOOPS[name];if(L&&AC)L.g.gain.setTargetAtTime(v,AC.currentTime,0.25);}

/* ================= RENDERER ================= */
const glc=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas:glc,antialias:SET.quality!=='low',powerPreference:'high-performance'});
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xc4d2dc,40,220);scene.background=new THREE.Color(0xc4d2dc);
const camera=new THREE.PerspectiveCamera(62,1,0.05,700);
const hemi=new THREE.HemisphereLight(0xdfe8ff,0x4a4236,0.62);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d8,1.75);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
{const sc=sun.shadow.camera;sc.left=-26;sc.right=26;sc.top=26;sc.bottom=-26;sc.near=1;sc.far=140;}
sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.025;scene.add(sun);scene.add(sun.target);
const flashLight=new THREE.PointLight(0xffb060,0,8,2);scene.add(flashLight);
const fireLight=new THREE.PointLight(0xff7a2a,0,12,2);scene.add(fireLight);
const lampLights=[0,1].map(()=>{const l=new THREE.PointLight(0xffd59a,1.4,17,2);l.visible=false;scene.add(l);return l;});
const torch=new THREE.SpotLight(0xfff2dc,0,38,0.42,0.55,1.4);torch.visible=false;scene.add(torch);scene.add(torch.target);
let _shadowState=null;function applyQuality(){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,SET.quality==='high'?1.5:SET.quality==='medium'?1.15:0.9));const sh=SET.quality!=='low';sun.castShadow=sh;renderer.shadowMap.enabled=sh;if(_shadowState!==null&&_shadowState!==sh)scene.traverse(o=>{if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.needsUpdate=true);else o.material.needsUpdate=true;}});_shadowState=sh;}
applyQuality();

/* sky */
const skyCan=document.createElement('canvas');skyCan.width=4;skyCan.height=256;
const skyTex=new THREE.CanvasTexture(skyCan);skyTex.encoding=THREE.sRGBEncoding;
const sky=new THREE.Mesh(new THREE.SphereGeometry(520,24,16),new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,depthWrite:false}));
sky.renderOrder=-1;scene.add(sky);
function paintSky(top,mid,hor,low){const x=skyCan.getContext('2d');const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,top);g.addColorStop(0.38,mid);g.addColorStop(0.5,hor);g.addColorStop(0.56,low||hor);g.addColorStop(1,low||hor);x.fillStyle=g;x.fillRect(0,0,4,256);skyTex.needsUpdate=true;}
const stars=(()=>{const n=700,p=new Float32Array(n*3);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,e=Math.random()*1.3+0.12;p[i*3]=Math.cos(a)*Math.cos(e)*480;p[i*3+1]=Math.sin(e)*480;p[i*3+2]=Math.sin(a)*Math.cos(e)*480;}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,fog:false}));m.visible=false;scene.add(m);return m;})();

/* rain / snow */
const RAIN_N=900;
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RAIN_N*6),3));
const rainMat=new THREE.LineBasicMaterial({color:0xaab4be,transparent:true,opacity:0.38});
const rainMesh=new THREE.LineSegments(rainGeo,rainMat);rainMesh.frustumCulled=false;rainMesh.visible=false;scene.add(rainMesh);
const rainDrops=[];for(let i=0;i<RAIN_N;i++)rainDrops.push({x:rnd(-16,16),y:rnd(-2,18),z:rnd(-16,16),s:rnd(0.8,1.2)});
let SNOW=false;
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RAIN_N*3),3));
const snowMesh=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xffffff,size:0.14,map:null,transparent:true,opacity:0.95,depthWrite:false}));snowMesh.frustumCulled=false;snowMesh.visible=false;scene.add(snowMesh);
function updRain(dt){
  if(SNOW&&snowMesh.visible){const a=snowGeo.attributes.position.array;const cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
    for(let i=0;i<RAIN_N;i++){const d=rainDrops[i];d.y-=1.1*d.s*dt;d.x+=Math.sin(GT*0.7+i)*0.35*dt;d.z+=Math.cos(GT*0.5+i*1.3)*0.25*dt;if(d.y<-3){d.y=rnd(10,16);d.x=rnd(-14,14);d.z=rnd(-14,14);}a[i*3]=cx+d.x;a[i*3+1]=cy+d.y;a[i*3+2]=cz+d.z;}
    snowGeo.attributes.position.needsUpdate=true;return;}
  if(!rainMesh.visible)return;const a=rainGeo.attributes.position.array;const cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
  const vy=SNOW?1.1:11,len=SNOW?0.05:0.45;
  for(let i=0;i<RAIN_N;i++){const d=rainDrops[i];d.y-=vy*d.s*dt;if(SNOW){d.x+=Math.sin(GT*0.7+i)*0.3*dt;}
    if(d.y<-3){d.y=rnd(12,18);d.x=rnd(-16,16);d.z=rnd(-16,16);}
    const x=cx+d.x,y=cy+d.y,z=cz+d.z;a[i*6]=x;a[i*6+1]=y;a[i*6+2]=z;a[i*6+3]=x+(SNOW?0.03:0.05);a[i*6+4]=y-len;a[i*6+5]=z;}
  rainGeo.attributes.position.needsUpdate=true;
}

/* ================= TEXTURES ================= */
function ctex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);try{t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}catch(e){}return t;}
function speckle(x,w,h,n,amp,sz){sz=sz||2;for(let i=0;i<n;i++){const v=(Math.random()-0.5)*amp;x.fillStyle=v>0?'rgba(255,255,255,'+v+')':'rgba(0,0,0,'+(-v)+')';x.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*sz,1+Math.random()*sz);}}
const T={};
T.asphalt=ctex(512,512,(x,w,h)=>{x.fillStyle='#4b4b4e';x.fillRect(0,0,w,h);speckle(x,w,h,26000,0.28);for(let i=0;i<7;i++){x.strokeStyle='rgba(15,15,15,.4)';x.lineWidth=1+Math.random()*2;x.beginPath();let px=Math.random()*w,py=Math.random()*h;x.moveTo(px,py);for(let k=0;k<7;k++){px+=rnd(-40,40);py+=rnd(-40,40);x.lineTo(px,py);}x.stroke();}for(let i=0;i<5;i++){x.fillStyle='rgba(30,30,32,.35)';x.fillRect(rnd(0,w),rnd(0,h),rnd(30,90),rnd(20,60));}});
T.paving=ctex(256,256,(x,w,h)=>{x.fillStyle='#5a554e';x.fillRect(0,0,w,h);const n=10,s=w/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const l=rndi(120,170);x.fillStyle='rgb('+l+','+(l-6)+','+(l-14)+')';const o=(j%2)*s/2;x.beginPath();x.roundRect?x.roundRect(i*s+o+1.5,j*s+1.5,s-3,s-3,5):x.rect(i*s+o+1.5,j*s+1.5,s-3,s-3);x.fill();}speckle(x,w,h,4000,0.15);});
T.sidewalk=ctex(256,256,(x,w,h)=>{x.fillStyle='#9a9790';x.fillRect(0,0,w,h);speckle(x,w,h,8000,0.14);x.strokeStyle='rgba(40,40,40,.45)';x.lineWidth=2;for(let i=0;i<=4;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,h);x.stroke();x.beginPath();x.moveTo(0,i*64);x.lineTo(w,i*64);x.stroke();}});
T.sandstone=ctex(256,256,(x,w,h)=>{x.fillStyle='#8f7d5e';x.fillRect(0,0,w,h);const rows=6;for(let r=0;r<rows;r++){const hh=h/rows,o=(r%2)*32;for(let c=-1;c<5;c++){const l=rndi(165,205);x.fillStyle='rgb('+l+','+(l-18)+','+(l-48)+')';x.fillRect(c*64+o+2,r*hh+2,60,hh-4);}}speckle(x,w,h,9000,0.18);});
T.stoneLight=ctex(256,256,(x,w,h)=>{x.fillStyle='#bcb2a0';x.fillRect(0,0,w,h);for(let r=0;r<8;r++){x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,r*32,w,2);for(let c=0;c<4;c++)x.fillRect(c*64+(r%2)*32,r*32,2,32);}speckle(x,w,h,7000,0.12);});
T.slate=ctex(256,256,(x,w,h)=>{x.fillStyle='#3d424a';x.fillRect(0,0,w,h);for(let r=0;r<16;r++)for(let c=0;c<16;c++){const l=rndi(48,72);x.fillStyle='rgb('+(l-4)+','+l+','+(l+8)+')';x.fillRect(c*16+(r%2)*8,r*16,15,14);}speckle(x,w,h,3000,0.12);});
T.facLux=ctex(256,256,(x,w,h)=>{x.fillStyle='#ffffff';x.fillRect(0,0,w,h);speckle(x,w,h,6000,0.1);
  for(let fl=0;fl<2;fl++){const y0=fl*128;x.fillStyle='rgba(0,0,0,.14)';x.fillRect(0,y0+121,w,5);x.fillStyle='rgba(255,255,255,.35)';x.fillRect(0,y0+118,w,3);
    for(let k=0;k<2;k++){const x0=k*128+34;x.fillStyle='rgba(0,0,0,.12)';x.fillRect(x0-9,y0+12,78,104);x.fillStyle='#2a333d';x.fillRect(x0,y0+20,60,86);
      x.fillStyle='#f6f3ec';x.fillRect(x0+28,y0+20,4,86);x.fillRect(x0,y0+56,60,4);x.fillStyle='rgba(255,255,255,.09)';x.fillRect(x0+3,y0+23,22,30);
      x.fillStyle='rgba(60,70,60,.55)';x.fillRect(x0-22,y0+20,13,86);x.fillRect(x0+69,y0+20,13,86);x.fillStyle='rgba(0,0,0,.25)';x.fillRect(x0-6,y0+107,72,6);}}});
T.litLux=ctex(256,256,(x,w,h)=>{x.fillStyle='#000';x.fillRect(0,0,w,h);for(let fl=0;fl<2;fl++)for(let k=0;k<2;k++){if(Math.random()<0.45){x.fillStyle=pick(['#ffd88a','#ffe2a8','#ffc870']);x.fillRect(k*128+34,fl*128+20,60,86);x.fillStyle='#000';x.fillRect(k*128+62,fl*128+20,4,86);x.fillRect(k*128+34,fl*128+56,60,4);}}});
T.shopLux=ctex(256,180,(x,w,h)=>{x.fillStyle='#d9d2c2';x.fillRect(0,0,w,h);speckle(x,w,h,4000,0.1);for(let k=0;k<2;k++){const x0=k*128+14;x.fillStyle='#1d252d';x.beginPath();x.moveTo(x0,h);x.lineTo(x0,60);x.quadraticCurveTo(x0+50,20,x0+100,60);x.lineTo(x0+100,h);x.fill();x.fillStyle='rgba(255,255,255,.08)';x.fillRect(x0+8,70,30,80);}x.fillStyle=pick(['#7a2f2f','#2f4d7a','#2f6b4a','#6b4a2f','#333']);x.fillRect(0,0,w,14);x.fillStyle='rgba(0,0,0,.3)';x.fillRect(0,h-10,w,10);});
T.litShop=ctex(256,180,(x,w,h)=>{x.fillStyle='#000';x.fillRect(0,0,w,h);for(let k=0;k<2;k++){if(Math.random()<0.7){const x0=k*128+14;x.fillStyle='#ffe0a0';x.beginPath();x.moveTo(x0,h-10);x.lineTo(x0,60);x.quadraticCurveTo(x0+50,20,x0+100,60);x.lineTo(x0+100,h-10);x.fill();}}});
T.facDark=ctex(256,256,(x,w,h)=>{x.fillStyle='#ffffff';x.fillRect(0,0,w,h);speckle(x,w,h,9000,0.22);for(let i=0;i<14;i++){x.fillStyle='rgba(0,0,0,'+rnd(0.05,0.18)+')';x.fillRect(rnd(0,w),rnd(0,h*0.5),rnd(3,10),rnd(40,200));}
  x.strokeStyle='rgba(0,0,0,.25)';x.lineWidth=2;for(let i=0;i<=3;i++){x.beginPath();x.moveTo(0,i*85);x.lineTo(w,i*85);x.stroke();}
  for(let fl=0;fl<3;fl++)for(let k=0;k<3;k++){const x0=k*85+22,y0=fl*85+20;const r=Math.random();x.fillStyle=r<0.12?'#5a4632':r<0.2?'#111':'#262c33';x.fillRect(x0,y0,42,48);x.fillStyle='rgba(255,255,255,.07)';x.fillRect(x0+3,y0+3,16,20);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(x0-3,y0+48,48,5);}});
T.litDark=ctex(256,256,(x,w,h)=>{x.fillStyle='#000';x.fillRect(0,0,w,h);for(let fl=0;fl<3;fl++)for(let k=0;k<3;k++){if(Math.random()<0.3){x.fillStyle=pick(['#ffb565','#ffcf8a','#9fc4ff','#ff9a55']);x.fillRect(k*85+22,fl*85+20,42,48);}}});
T.brick=ctex(256,256,(x,w,h)=>{x.fillStyle='#5a3b30';x.fillRect(0,0,w,h);for(let r=0;r<24;r++)for(let c=0;c<9;c++){const l=rndi(110,160);x.fillStyle='rgb('+l+','+(l*0.5|0)+','+(l*0.38|0)+')';x.fillRect(c*30+(r%2)*15-15,r*10.66+1,28,9);}speckle(x,w,h,6000,0.18);
  for(let fl=0;fl<2;fl++)for(let k=0;k<2;k++){const x0=k*128+38,y0=fl*128+22;x.fillStyle='#d8d0c0';x.fillRect(x0-4,y0-4,58,84);x.fillStyle='#20262c';x.fillRect(x0,y0,50,76);x.fillStyle='#d8d0c0';x.fillRect(x0+23,y0,4,76);}});
T.graffiti=ctex(512,128,(x,w,h)=>{x.fillStyle='#55575a';x.fillRect(0,0,w,h);speckle(x,w,h,6000,0.25);
  for(let i=0;i<7;i++){const cx=rnd(20,w-60),cy=rnd(30,h-20),col=pick(['#e0306a','#29b6f6','#ffd54f','#7cff4f','#ff7043','#b388ff','#ffffff']);x.lineWidth=rnd(5,12);x.lineCap='round';x.strokeStyle='#111';
    const pts=[];for(let k=0;k<5;k++)pts.push([cx+rnd(-60,60),cy+rnd(-30,30)]);
    for(const pass of [0,1]){x.strokeStyle=pass?col:'#111';x.lineWidth=pass?x.lineWidth-3:x.lineWidth+3;x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(let k=1;k<5;k++)x.quadraticCurveTo(pts[k][0]+rnd(-20,20),pts[k][1]+rnd(-20,20),pts[k][0],pts[k][1]);x.stroke();}}
  x.font='bold 40px Impact,Arial Black,sans-serif';for(let i=0;i<4;i++){x.fillStyle=pick(['#ff4081','#00e5ff','#ffea00','#76ff03','#ff6e40']);x.strokeStyle='#000';x.lineWidth=3;const s=String.fromCharCode(rndi(65,90))+String.fromCharCode(rndi(65,90))+String.fromCharCode(rndi(65,90));const px=rnd(0,w-100),py=rnd(45,h-10);x.strokeText(s,px,py);x.fillText(s,px,py);}
  x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,h-12,w,12);});
T.noise=ctex(256,256,(x,w,h)=>{x.fillStyle='#cfcfcf';x.fillRect(0,0,w,h);speckle(x,w,h,14000,0.3,3);});
T.wood=ctex(256,256,(x,w,h)=>{x.fillStyle='#8a6235';x.fillRect(0,0,w,h);for(let i=0;i<8;i++){x.fillStyle=i%2?'#7d5830':'#94693a';x.fillRect(0,i*32,w,30);for(let k=0;k<40;k++){x.fillStyle='rgba(60,35,10,.25)';x.fillRect(Math.random()*w,i*32+Math.random()*30,rnd(10,60),1);}}x.strokeStyle='#4a3218';x.lineWidth=14;x.strokeRect(0,0,w,h);x.beginPath();x.moveTo(0,0);x.lineTo(w,h);x.stroke();});
T.rust=ctex(256,256,(x,w,h)=>{x.fillStyle='#5b3b26';x.fillRect(0,0,w,h);speckle(x,w,h,12000,0.35,3);for(let i=0;i<30;i++){x.fillStyle='rgba('+rndi(90,150)+','+rndi(40,70)+',20,.35)';x.beginPath();x.arc(rnd(0,w),rnd(0,h),rnd(5,25),0,7);x.fill();}});
T.leaf=ctex(128,128,(x,w,h)=>{x.fillStyle='#3d5e2a';x.fillRect(0,0,w,h);for(let i=0;i<500;i++){x.fillStyle='rgba('+rndi(30,90)+','+rndi(70,130)+','+rndi(20,50)+',.6)';x.beginPath();x.arc(rnd(0,w),rnd(0,h),rnd(2,6),0,7);x.fill();}});
T.bark=ctex(64,128,(x,w,h)=>{x.fillStyle='#5a4a3a';x.fillRect(0,0,w,h);for(let i=0;i<40;i++){x.fillStyle='rgba(0,0,0,.25)';x.fillRect(rnd(0,w),0,rnd(1,3),h);}speckle(x,w,h,1500,0.2);});
T.flame=ctex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,250,220,1)');g.addColorStop(0.3,'rgba(255,190,80,.9)');g.addColorStop(0.65,'rgba(255,90,20,.35)');g.addColorStop(1,'rgba(255,40,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
T.smoke=ctex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(0.6,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
T.clock=ctex(128,128,(x,w,h)=>{x.fillStyle='#1d2328';x.fillRect(0,0,w,h);x.fillStyle='#f2efe6';x.beginPath();x.arc(64,64,58,0,7);x.fill();x.strokeStyle='#111';x.lineWidth=3;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;x.beginPath();x.moveTo(64+Math.cos(a)*46,64+Math.sin(a)*46);x.lineTo(64+Math.cos(a)*54,64+Math.sin(a)*54);x.stroke();}x.lineWidth=5;x.beginPath();x.moveTo(64,64);x.lineTo(40,44);x.stroke();x.lineWidth=3;x.beginPath();x.moveTo(64,64);x.lineTo(92,40);x.stroke();});
T.flagLux=ctex(96,64,(x,w,h)=>{x.fillStyle='#ED2939';x.fillRect(0,0,w,h/3);x.fillStyle='#ffffff';x.fillRect(0,h/3,w,h/3);x.fillStyle='#00A1DE';x.fillRect(0,2*h/3,w,h/3+1);});
T.water=ctex(128,128,(x,w,h)=>{x.fillStyle='#3d5d5a';x.fillRect(0,0,w,h);for(let i=0;i<120;i++){x.strokeStyle='rgba(255,255,255,'+rnd(0.03,0.1)+')';x.lineWidth=1;x.beginPath();const px=rnd(0,w),py=rnd(0,h);x.moveTo(px,py);x.quadraticCurveTo(px+8,py-3,px+16,py);x.stroke();}},[30,2]);

T.flake=ctex(32,32,(x,w,h)=>{const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.45,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
snowMesh.material.map=T.flake;snowMesh.material.size=0.3;snowMesh.material.needsUpdate=true;
/* ================= MATERIALS ================= */
const std=(o)=>{const m=new THREE.MeshStandardMaterial(Object.assign({roughness:0.85,metalness:0},o));m.color.convertSRGBToLinear();return m;};
const hexL=h=>new THREE.Color(h).convertSRGBToLinear();
const M={
  asphalt:std({map:T.asphalt,roughness:0.95}),paving:std({map:T.paving,roughness:0.9}),sidewalk:std({map:T.sidewalk,roughness:0.9}),
  sandstone:std({map:T.sandstone,roughness:0.92}),stoneLight:std({map:T.stoneLight,roughness:0.9}),slate:std({map:T.slate,roughness:0.6,metalness:0.1}),
  facLux:['#efe6d2','#e6dcc4','#f2ede4','#e9d9b8','#dfe3e2','#efd9c8'].map(c=>std({map:T.facLux,color:c,emissiveMap:T.litLux,emissive:0xffffff,emissiveIntensity:0})),
  shopLux:std({map:T.shopLux,emissiveMap:T.litShop,emissive:0xffffff,emissiveIntensity:0}),
  facDark:['#8a8a88','#76797d','#9a948a','#6d6a66'].map(c=>std({map:T.facDark,color:c,emissiveMap:T.litDark,emissive:0xffffff,emissiveIntensity:0})),
  brick:std({map:T.brick,roughness:0.92,emissiveMap:T.litLux,emissive:0xffffff,emissiveIntensity:0}),
  graffiti:std({map:T.graffiti,roughness:0.9}),concrete:std({map:T.noise,color:'#8e8c86',roughness:0.92}),
  terrain:std({map:T.noise,vertexColors:true,roughness:0.95}),grass:std({map:T.noise,color:'#5f7f3c',roughness:0.95}),
  wood:std({map:T.wood,roughness:0.85}),rust:std({map:T.rust,roughness:0.85,metalness:0.3}),
  metal:std({color:0x1d1f22,metalness:0.7,roughness:0.38}),metalDark:std({color:0x26292c,metalness:0.6,roughness:0.5}),
  metalGreen:std({color:0x2f4a3c,metalness:0.5,roughness:0.5}),copper:std({color:0x5f8f7e,metalness:0.3,roughness:0.6}),
  steel:std({color:0xd8dde3,metalness:0.9,roughness:0.2}),woodBat:std({color:0x9a6a3a,roughness:0.6}),
  glass:std({color:0x223040,metalness:0.6,roughness:0.12}),glassGreen:std({color:0x2a6b3a,metalness:0.2,roughness:0.15,transparent:true,opacity:0.8}),
  tire:std({color:0x111111,roughness:0.9}),gold:std({color:0xd9b24a,metalness:1,roughness:0.28}),
  leaf:std({map:T.leaf,roughness:0.9}),bark:std({map:T.bark,roughness:0.95}),
  lampHead:std({color:0xfff1c8,emissive:0xffd890,emissiveIntensity:0.15}),
  line:std({color:0xdedad0,roughness:0.8,polygonOffset:true,polygonOffsetFactor:-1}),
  clock:std({map:T.clock,roughness:0.5}),flag:std({map:T.flagLux,side:THREE.DoubleSide,roughness:0.8}),
  water:std({map:T.water,color:0x9fb8b4,metalness:0.25,roughness:0.12,transparent:true,opacity:0.86}),
  blood:std({color:0x4a0000,roughness:0.22,metalness:0.1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
  bone:std({color:0xeee5d0,roughness:0.5}),yellow:std({color:0xe0b000,roughness:0.5}),
  burnt:std({color:0x161412,roughness:0.95}),bin:std({color:0x2f5d3a,roughness:0.6,metalness:0.3}),
  red:std({color:0x9a1c1c,roughness:0.6}),white:std({color:0xe8e8e8,roughness:0.6}),
};
const CAR_PAINT=[0x8a1c1c,0x1c3f8a,0xcfcfcf,0x222222,0x2f6b3a,0x7a7a7a,0xc9a227,0x5a2e6e].map(c=>std({color:c,metalness:0.55,roughness:0.33}));

/* ================= CHARACTER INSTANCE POOLS ================= */
const ZERO_M=new THREE.Matrix4().makeScale(0,0,0);
function makePool(geo,cap,opt){const m=new THREE.InstancedMesh(geo,std(Object.assign({roughness:0.78},opt||{})),cap);m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;const c=new THREE.Color(1,1,1);for(let i=0;i<cap;i++){m.setMatrixAt(i,ZERO_M);m.setColorAt(i,c);}m.count=0;scene.add(m);return m;}
const POOL={
  cyl:makePool(new THREE.CylinderGeometry(1,1,1,10,1,true),900),
  sph:makePool(new THREE.SphereGeometry(1,12,9),1150),
  box:makePool(new THREE.BoxGeometry(1,1,1),460),
  hair:makePool(new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*0.5),44,{roughness:0.95}),
  eye:makePool(new THREE.SphereGeometry(1,8,6),130,{roughness:0.2}),
  wound:makePool(new THREE.SphereGeometry(1,7,5),760,{roughness:0.25}),
  shard:makePool(new THREE.BoxGeometry(1,1,1),160,{roughness:0.5}),
};
POOL.wound.castShadow=false;POOL.shard.castShadow=false;POOL.eye.castShadow=false;

/* ================= PARTICLES ================= */
const PMAX=1000;
const pMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),std({roughness:0.3}),PMAX);pMesh.frustumCulled=false;scene.add(pMesh);
const dummy=new THREE.Object3D();
const COLP={blood:hexL(0x6a0000),dust:hexL(0x8f877a),spark:hexL(0xffd27a),water:hexL(0xbcd4e0),glass:hexL(0x6fbf7f)};
for(let i=0;i<PMAX;i++){pMesh.setMatrixAt(i,ZERO_M);pMesh.setColorAt(i,COLP.blood);}
const parts3=[];
function spawnP(p,v,kind,r){parts3.push({x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z,kind,life:kind==='blood'?5:kind==='water'?1.2:0.7,r:r||(kind==='blood'?rnd(0.008,0.018):rnd(0.008,0.02))});if(parts3.length>PMAX)parts3.shift();}
const stains=[];const stainGeo=new THREE.CircleGeometry(1,18);
function addStain(x,z,y,r){
  for(const s of stains){const dx=s.m.position.x-x,dz=s.m.position.z-z;if(Math.abs(s.m.position.y-y)<0.06&&dx*dx+dz*dz<(s.r*0.7)*(s.r*0.7)){s.r=Math.min(s.r+r*0.22,1.2);s.m.scale.set(s.r,s.r*0.92,1);return;}}
  let s;if(stains.length>=260){s=stains.shift();}else{const m=new THREE.Mesh(stainGeo,M.blood);m.rotation.x=-Math.PI/2;m.receiveShadow=true;scene.add(m);s={m};}
  s.r=r*2.2;s.m.position.set(x,y+0.006+Math.random()*0.003,z);s.m.rotation.z=Math.random()*6;s.m.scale.set(s.r,s.r,1);stains.push(s);
}
function clearStains(){for(const s of stains)scene.remove(s.m);stains.length=0;parts3.length=0;}
function updParticles(dt){
  for(let i=parts3.length-1;i>=0;i--){const q=parts3[i];q.vy-=9.8/3600;q.x+=q.vx;q.y+=q.vy;q.z+=q.vz;q.life-=dt;
    const gh=groundAt(q.x,q.z,q.y);
    if(q.y<=gh+0.004||q.life<=0){if(q.kind==='blood'&&q.y<=gh+0.004&&q.y>waterLevel(q.x,q.z))addStain(q.x,q.z,gh,q.r*1.6);parts3.splice(i,1);}}
  for(let i=0;i<PMAX;i++){const q=parts3[i];if(q){dummy.position.set(q.x,q.y,q.z);dummy.scale.setScalar(q.r);dummy.updateMatrix();pMesh.setMatrixAt(i,dummy.matrix);pMesh.setColorAt(i,COLP[q.kind]||COLP.dust);}else pMesh.setMatrixAt(i,ZERO_M);}
  pMesh.instanceMatrix.needsUpdate=true;if(pMesh.instanceColor)pMesh.instanceColor.needsUpdate=true;
}

/* flames & smoke (point sprites) */
function makePoints(n,map,size,blend,opacity){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3).fill(-9999),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({size,map,vertexColors:true,transparent:true,opacity:opacity||1,depthWrite:false,blending:blend,sizeAttenuation:true}));m.frustumCulled=false;scene.add(m);return{m,g,n,list:[]};}
const FL=makePoints(500,T.flame,0.95,THREE.AdditiveBlending,0.85);
const SM=makePoints(900,T.smoke,1.3,THREE.NormalBlending,0.55);
function emitFlame(x,y,z,s){if(FL.list.length>=FL.n)FL.list.shift();FL.list.push({x,y,z,vx:rnd(-0.002,0.002),vy:rnd(0.01,0.022)*(s||1),vz:rnd(-0.002,0.002),life:rnd(0.3,0.65),max:0.65});}
function emitSmoke(x,y,z,grey,life,vy,tint,spd){if(SM.list.length>=SM.n)SM.list.shift();const sp=spd||0.004;SM.list.push({x,y,z,vx:rnd(-sp,sp),vy:vy!==undefined?vy:rnd(0.01,0.02),vz:rnd(-sp,sp),life:life||rnd(1.5,3),max:life||3,g:grey===undefined?0.25:grey,tint:tint||null});}
function updSprites(dt){
  {const a=FL.g.attributes.position.array,c=FL.g.attributes.color.array;for(let i=FL.list.length-1;i>=0;i--){const q=FL.list[i];q.x+=q.vx;q.y+=q.vy;q.z+=q.vz;q.life-=dt;if(q.life<=0)FL.list.splice(i,1);}
    for(let i=0;i<FL.n;i++){const q=FL.list[i];if(q){a[i*3]=q.x;a[i*3+1]=q.y;a[i*3+2]=q.z;const k=q.life/q.max;const f=Math.min(1,k*1.6);c[i*3]=f;c[i*3+1]=f*(0.18+0.62*k);c[i*3+2]=f*(0.04+0.3*k*k);}else{a[i*3+1]=-9999;}}
    FL.g.attributes.position.needsUpdate=true;FL.g.attributes.color.needsUpdate=true;}
  {const a=SM.g.attributes.position.array,c=SM.g.attributes.color.array;for(let i=SM.list.length-1;i>=0;i--){const q=SM.list[i];q.x+=q.vx;q.y+=q.vy;q.z+=q.vz;q.life-=dt;if(q.life<=0)SM.list.splice(i,1);}
    for(let i=0;i<SM.n;i++){const q=SM.list[i];if(q){a[i*3]=q.x;a[i*3+1]=q.y;a[i*3+2]=q.z;const k=clamp(q.life/q.max,0,1);const v=q.g*k+0.02;if(q.tint){c[i*3]=v*q.tint[0];c[i*3+1]=v*q.tint[1];c[i*3+2]=v*q.tint[2];}else c[i*3]=c[i*3+1]=c[i*3+2]=v;}else a[i*3+1]=-9999;}
    SM.g.attributes.position.needsUpdate=true;SM.g.attributes.color.needsUpdate=true;}
}

/* tracers & taser wires */
const trPool=[];
for(let i=0;i<30;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));const m=new THREE.LineBasicMaterial({color:0xffe08a,transparent:true,opacity:0});const l=new THREE.Line(g,m);l.frustumCulled=false;scene.add(l);trPool.push({l,t:0,max:0.07});}
let trI=0;
function addLine(a,b,color,life){const T=trPool[trI++%trPool.length];const arr=T.l.geometry.attributes.position.array;arr[0]=a.x;arr[1]=a.y;arr[2]=a.z;arr[3]=b.x;arr[4]=b.y;arr[5]=b.z;T.l.geometry.attributes.position.needsUpdate=true;T.l.material.color.setHex(color||0xffe08a);T.t=T.max=life||0.07;T.l.material.opacity=1;return T;}
function updLines(dt){for(const T of trPool){if(T.t>0){T.t-=dt;T.l.material.opacity=Math.max(0,T.t/T.max);}}}

/* ================= ENVIRONMENT ================= */
function applyEnvironment(){
  const night=SET.night,rain=SET.rain,dark=SET.map==='dark',cold=SET.temp<=0;
  SNOW=rain&&cold;
  let top,mid,hor,low,fogC;
  if(night){top=dark?'#030305':'#050913';mid=dark?'#151119':'#0f1729';hor=dark?'#3b2a22':'#24304a';low=dark?'#1a1512':'#121a28';fogC=dark?0x1c1612:0x182030;}
  else if(rain){top=SNOW?'#a9b0b8':'#6a737c';mid=SNOW?'#c3c8ce':'#8d959c';hor=SNOW?'#dadde1':'#a7acb0';fogC=SNOW?0xd3d7dc:0x99a0a5;}
  else if(dark){top='#6f7680';mid='#9a9890';hor='#c2b39a';fogC=0xb0a690;}
  else{top='#4f86cf';mid='#94bbe6';hor='#d8e4ec';fogC=cold?0xd8dee6:0xc8d6e0;}
  paintSky(top,mid,hor,low);
  scene.fog.color.setHex(fogC).convertSRGBToLinear();scene.background.setHex(fogC);
  scene.fog.near=night?6:rain?18:dark?30:45;scene.fog.far=night?75:rain?115:dark?160:240;
  hemi.intensity=night?0.17:rain?0.5:0.62;hemi.color.setHex(night?0x8a9ad0:0xdfe8ff);hemi.groundColor.setHex(night?0x1b1a20:0x4a4236);
  sun.intensity=night?0.2:rain?0.6:dark?1.3:1.75;sun.color.setHex(night?0x9db4ff:dark?0xffd8b0:0xfff0d8);
  renderer.toneMappingExposure=night?1.3:1.0;
  stars.visible=night&&!rain;rainMesh.visible=rain&&!SNOW;snowMesh.visible=SNOW;rainMat.color.setHex(SNOW?0xffffff:0xaab4be);rainMat.opacity=SNOW?0.85:0.38;
  for(const l of lampLights)l.visible=night;torch.visible=night;
  M.lampHead.emissiveIntensity=night?2.4:0.12;
  const wi=night?0.85:0;for(const m of M.facLux)m.emissiveIntensity=wi;for(const m of M.facDark)m.emissiveIntensity=wi*0.9;M.brick.emissiveIntensity=wi*0.7;M.shopLux.emissiveIntensity=night?0.75:0;
  M.asphalt.roughness=rain&&!SNOW?0.32:0.95;M.asphalt.metalness=rain&&!SNOW?0.15:0;M.paving.roughness=rain&&!SNOW?0.4:0.9;
  M.asphalt.color.setHex(SNOW?0xe8ecf0:0xffffff).convertSRGBToLinear();M.paving.color.setHex(SNOW?0xe6eaee:0xffffff).convertSRGBToLinear();M.sidewalk.color.setHex(SNOW?0xf0f3f6:0xffffff).convertSRGBToLinear();
  setVolume(SET.volume);
}
