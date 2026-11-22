"use strict";
/* =====================================================================
   MAPS : Luxembourg (Ville-Haute, Pont Adolphe, vallée de la Pétrusse,
          quartier Gare) + "Quartier Noir" (ville inventée dangereuse)
   ===================================================================== */
const MAPOBJ=[],boxes=[],LAMPS=[],PERM_FIRES=[];
let MAP=null;
function addObj(o){scene.add(o);MAPOBJ.push(o);return o;}
function clearMap(){for(const o of MAPOBJ){scene.remove(o);o.traverse(n=>{if(n.geometry)n.geometry.dispose();});}MAPOBJ.length=0;boxes.length=0;LAMPS.length=0;PERM_FIRES.length=0;GRID.clear();}

/* ---------- geometry batching (one draw call per material) ---------- */
function mergeGeos(geos){
  let nv=0,ni=0;for(const g of geos){nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=new Float32Array(nv*2);const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);
  let vo=0,io=0;
  for(const g of geos){const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,cnt=p.count;
    pos.set(p.array.subarray?p.array.subarray(0,cnt*3):p.array,vo*3);if(n)nor.set(n.array.subarray(0,cnt*3),vo*3);if(u)uv.set(u.array.subarray(0,cnt*2),vo*2);
    if(g.index){const a=g.index.array;for(let i=0;i<g.index.count;i++)idx[io+i]=a[i]+vo;io+=g.index.count;}else{for(let i=0;i<cnt;i++)idx[io+i]=vo+i;io+=cnt;}
    vo+=cnt;g.dispose();}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(pos,3));out.setAttribute('normal',new THREE.BufferAttribute(nor,3));out.setAttribute('uv',new THREE.BufferAttribute(uv,2));out.setIndex(new THREE.BufferAttribute(idx,1));out.computeBoundingSphere();return out;
}
class Batch{
  constructor(){this.g=new Map();}
  add(geo,mat){if(!this.g.has(mat))this.g.set(mat,[]);this.g.get(mat).push(geo);}
  build(){for(const [mat,geos] of this.g){for(let i=0;i<geos.length;i+=1500){const m=new THREE.Mesh(mergeGeos(geos.slice(i,i+1500)),mat);m.castShadow=!mat.transparent;m.receiveShadow=true;addObj(m);}}this.g.clear();}
}
function boxGeo(sx,sy,sz,us,vs){const g=new THREE.BoxGeometry(sx,sy,sz);if(us){vs=vs||us;const uv=g.attributes.uv;const dims=[[sz,sy],[sz,sy],[sx,sz],[sx,sz],[sx,sy],[sx,sy]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*dims[f][0]/us,uv.getY(i)*dims[f][1]/vs);}}return g;}
function addCollider(x0,y0,z0,x1,y1,z1){boxes.push({min:{x:x0,y:y0,z:z0},max:{x:x1,y:y1,z:z1},cx:(x0+x1)/2,cz:(z0+z1)/2,hx:(x1-x0)/2,hz:(z1-z0)/2,stamp:0});}
function bx(B,cx,cy,cz,sx,sy,sz,mat,us,vs,col){const g=boxGeo(sx,sy,sz,us,vs);g.translate(cx,cy,cz);B.add(g,mat);if(col!==false)addCollider(cx-sx/2,cy-sy/2,cz-sz/2,cx+sx/2,cy+sy/2,cz+sz/2);}
function cyl(B,cx,cy,cz,rt,rb,h,seg,mat,rotY){const g=new THREE.CylinderGeometry(rt,rb,h,seg||8);if(rotY)g.rotateY(rotY);g.translate(cx,cy,cz);B.add(g,mat);}
function sphere(B,cx,cy,cz,r,mat,sx,sy,sz){const g=new THREE.SphereGeometry(r,10,8);g.scale(sx||1,sy||1,sz||1);g.translate(cx,cy,cz);B.add(g,mat);}
function plane(B,x0,z0,x1,z1,y,mat,us,vs){const w=x1-x0,d=z1-z0;const g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);if(us){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/us,uv.getY(i)*d/(vs||us));}g.translate((x0+x1)/2,y,(z0+z1)/2);B.add(g,mat);}
function prism(B,cx,y0,cz,len,wid,hgt,mat,alongX){const sh=new THREE.Shape();sh.moveTo(-wid/2,0);sh.lineTo(wid/2,0);sh.lineTo(0,hgt);sh.lineTo(-wid/2,0);const g=new THREE.ExtrudeGeometry(sh,{depth:len,bevelEnabled:false});g.translate(0,0,-len/2);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);if(alongX)g.rotateY(Math.PI/2);g.translate(cx,y0,cz);B.add(g,mat);}

/* ---------- spatial grid for colliders ---------- */
const GRID=new Map(),GC=8,EMPTY=[];let STAMP=1;
const gkey=(ix,iz)=>(ix+600)*2000+(iz+600);
function buildGrid(){GRID.clear();for(const b of boxes){const ix0=Math.floor(b.min.x/GC),ix1=Math.floor(b.max.x/GC),iz0=Math.floor(b.min.z/GC),iz1=Math.floor(b.max.z/GC);for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){const k=gkey(ix,iz);let a=GRID.get(k);if(!a){a=[];GRID.set(k,a);}a.push(b);}}}
function boxesAt(x,z){return GRID.get(gkey(Math.floor(x/GC),Math.floor(z/GC)))||EMPTY;}
function boxesNear(x,z,r){STAMP++;const out=[];const ix0=Math.floor((x-r)/GC),ix1=Math.floor((x+r)/GC),iz0=Math.floor((z-r)/GC),iz1=Math.floor((z+r)/GC);for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){const a=GRID.get(gkey(ix,iz));if(a)for(const b of a)if(b.stamp!==STAMP){b.stamp=STAMP;out.push(b);}}return out;}
function terrainH(x,z){return MAP?MAP.terrain(x,z):0;}
function waterLevel(x,z){return MAP&&MAP.water?MAP.water(x,z):-1e9;}
function groundAt(x,z,y){let g=terrainH(x,z);const a=boxesAt(x,z);for(const b of a){if(x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z&&b.max.y<=y+0.3&&b.max.y>g)g=b.max.y;}return g;}
function insideBox(x,y,z,m){m=m||0;for(const b of boxesAt(x,z)){if(x>b.min.x-m&&x<b.max.x+m&&z>b.min.z-m&&z<b.max.z+m&&y>b.min.y-0.1&&y<b.max.y)return true;}return false;}

/* ---------- shared props ---------- */
function tree(B,x,z,s,y0){s=s||1;y0=y0||0;cyl(B,x,y0+1.8*s,z,0.13*s,0.2*s,3.6*s,7,M.bark);const g=new THREE.IcosahedronGeometry(2.1*s,1);g.scale(1,0.85,1);g.translate(x,y0+4.9*s,z);B.add(g,M.leaf);
  const g2=new THREE.IcosahedronGeometry(1.4*s,1);g2.translate(x+0.9*s,y0+4.2*s,z-0.5*s);B.add(g2,M.leaf);addCollider(x-0.22,y0,z-0.22,x+0.22,y0+3.4*s,z+0.22);}
function deadTree(B,x,z){cyl(B,x,1.8,z,0.1,0.18,3.6,6,M.burnt);for(let i=0;i<3;i++){const g=new THREE.CylinderGeometry(0.03,0.06,1.4,5);g.rotateZ(rnd(-1.1,1.1));g.rotateY(rnd(0,6));g.translate(x,rnd(2.6,3.4),z);B.add(g,M.burnt);}addCollider(x-0.2,0,z-0.2,x+0.2,3.4,z+0.2);}
function lamp(B,x,z,y0,broken){y0=y0||0;cyl(B,x,y0+2.2,z,0.05,0.08,4.4,6,M.metalDark);bx(B,x,y0+4.5,z,0.28,0.4,0.28,broken?M.metalDark:M.lampHead,0,0,false);addCollider(x-0.1,y0,z-0.1,x+0.1,y0+4.4,z+0.1);if(!broken)LAMPS.push({x,y:y0+4.4,z});}
function bench(B,x,z,alongX){if(alongX){bx(B,x,0.45,z,1.8,0.08,0.45,M.wood,1,1,false);bx(B,x,0.75,z-0.2,1.8,0.45,0.06,M.wood,1,1,false);addCollider(x-0.9,0,z-0.25,x+0.9,0.5,z+0.25);}else{bx(B,x,0.45,z,0.45,0.08,1.8,M.wood,1,1,false);bx(B,x-0.2,0.75,z,0.06,0.45,1.8,M.wood,1,1,false);addCollider(x-0.25,0,z-0.9,x+0.25,0.5,z+0.9);}}
function car(B,x,z,alongX,paint,burnt){const body=burnt?M.burnt:CAR_PAINT[paint%CAR_PAINT.length];const L=4.3,W=1.8;const sx=alongX?L:W,sz=alongX?W:L;
  bx(B,x,0.72,z,sx,0.72,sz,body,0,0,false);bx(B,x+(alongX?-0.2:0),1.37,z+(alongX?0:-0.2),alongX?2.3:1.6,0.58,alongX?1.6:2.3,burnt?M.burnt:M.glass,0,0,false);
  for(const a of [-1,1])for(const b of [-1,1]){const g=new THREE.CylinderGeometry(0.33,0.33,0.24,12);if(alongX)g.rotateX(Math.PI/2);else g.rotateZ(Math.PI/2);g.translate(x+(alongX?a*1.35:b*0.82),0.33,z+(alongX?b*0.82:a*1.35));B.add(g,burnt?M.rust:M.tire);}
  addCollider(x-sx/2,0,z-sz/2,x+sx/2,1.08,z+sz/2);addCollider(x-(alongX?1.15:0.8),1.08,z-(alongX?0.8:1.15),x+(alongX?1.15:0.8),1.66,z+(alongX?0.8:1.15));}
function boundary(x0,z0,x1,z1){addCollider(x0-2,-40,z0,x0,60,z1);addCollider(x1,-40,z0,x1+2,60,z1);addCollider(x0,-40,z0-2,x1,60,z0);addCollider(x0,-40,z1,x1,60,z1+2);}

/* ---------- Luxembourg buildings ---------- */
function luxBuilding(B,x0,z0,x1,z1,floors,tint){
  const w=x1-x0,d=z1-z0,cx=(x0+x1)/2,cz=(z0+z1)/2,gH=4.2,uH=floors*3.2,H=gH+uH;
  bx(B,cx,gH/2,cz,w,gH,d,M.shopLux,6,4.2,false);
  bx(B,cx,gH+uH/2,cz,w,uH,d,M.facLux[tint%M.facLux.length],6,6.4,false);
  bx(B,cx,gH+0.12,cz,w+0.3,0.25,d+0.3,M.stoneLight,2,2,false);
  bx(B,cx,H+0.15,cz,w+0.45,0.3,d+0.45,M.stoneLight,2,2,false);
  const rh=rnd(2.6,4.2);bx(B,cx,H+0.3+rh*0.32,cz,w-0.5,rh*0.64,d-0.5,M.slate,3,3,false);
  prism(B,cx,H+0.3+rh*0.64,cz,(w>d?w:d)-1.2,(w>d?d:w)-1.2,rh*0.55,M.slate,w>d);
  if(Math.random()<0.5){const n=Math.max(1,Math.floor(w/5));for(let i=0;i<n;i++)bx(B,x0+2.5+i*(w-5)/Math.max(1,n-1||1),H+0.6+rh*0.4,z0+0.6,0.9,1.1,0.9,M.slate,1,1,false);}
  bx(B,x0+rnd(1,w-1),H+rh+0.6,cz,0.5,1.2,0.5,M.brick,1,1,false);
  addCollider(x0,0,z0,x1,H+rh,z1);
}
function fillBlock(B,x0,z0,x1,z1,fmin,fmax){
  const along=(x1-x0)>=(z1-z0);const L=along?x1-x0:z1-z0,D=along?z1-z0:x1-x0;
  const rows=D>22?2:1;const rd=rows===2?Math.min(11,D/2-1):D;
  for(let r=0;r<rows;r++){let p=0;while(p<L-3){let w=Math.min(rnd(7,13),L-p);if(L-p-w<5)w=L-p;
      const a0=p,a1=p+w;const b0=r===0?0:D-rd,b1=r===0?rd:D;
      if(along)luxBuilding(B,x0+a0,z0+b0,x0+a1,z0+b1,rndi(fmin,fmax),rndi(0,9));else luxBuilding(B,x0+b0,z0+a0,x0+b1,z0+a1,rndi(fmin,fmax),rndi(0,9));p+=w;}}
}
function tower(B,x,z,w,h,mat,roofH,clock){bx(B,x,h/2,z,w,h,w,mat,4,4,false);bx(B,x,h+0.3,z,w+0.4,0.6,w+0.4,M.stoneLight,2,2,false);const g=new THREE.CylinderGeometry(0,w*0.78,roofH,4);g.rotateY(Math.PI/4);g.translate(x,h+0.6+roofH/2,z);B.add(g,M.slate);
  if(clock){for(const [dx,dz,ry] of [[0,1,0],[0,-1,Math.PI],[1,0,Math.PI/2],[-1,0,-Math.PI/2]]){const p=new THREE.PlaneGeometry(w*0.6,w*0.6);p.rotateY(ry);p.translate(x+dx*(w/2+0.02),h-w*0.55,z+dz*(w/2+0.02));B.add(p,M.clock);}}
  addCollider(x-w/2,0,z-w/2,x+w/2,h+roofH,z+w/2);}

/* ---------- LUXEMBOURG terrain ---------- */
function luxH(x,z){
  const az=Math.abs(z);let h;
  if(az>=15)h=0;else if(az>=12.6)h=-17*(15-az)/2.4;else if(az>=7)h=-17-5*(12.6-az)/5.6;else if(az>=2.6)h=-22;else h=-22-1.3*Math.min(1,(2.6-az)/1.2);
  if(z>=7&&z<=15&&x>=-45){const r=x>=45?0:-22+(x+45)/90*22;if(r>h)h=r;}
  return h;
}
function luxRampH(x){return x>=45?0:-22+(x+45)/90*22;}
function luxRegion(p){if(p.z>15.2)return'N';if(p.z<-15.2)return'S';if(Math.abs(p.x)<5.3&&p.y>-3)return'B';if(p.z>=7.2&&p.x>=-40&&p.y>luxH(p.x,p.z)-0.6&&luxH(p.x,p.z)>-21.4)return'R';return'V';}
const LUX_WP={N:{x:0,z:17.5},S:{x:0,z:-17.5},RT:{x:47,z:13},RB:{x:-41,z:9.5}};
const LUX_PATH={N:{S:['N','S'],V:['RT','RB'],B:['N'],R:['RT']},S:{N:['S','N'],V:['S','N','RT','RB'],B:['S'],R:['S','N','RT']},B:{N:['N'],S:['S'],V:['N','RT','RB'],R:['N','RT']},R:{N:['RT'],S:['RT','N','S'],B:['RT','N'],V:['RB']},V:{N:['RB','RT'],S:['RB','RT','N','S'],B:['RB','RT','N'],R:['RB']}};
function luxNav(me,target){const a=luxRegion(me),b=luxRegion(target);if(a===b)return null;const path=(LUX_PATH[a]||{})[b];if(!path)return null;for(const k of path){const w=LUX_WP[k];if(Math.hypot(w.x-me.x,w.z-me.z)>2.2)return w;}return null;}

function buildLux(){
  const B=new Batch();
  // plateau ground
  plane(B,-100,15,100,100,0,M.asphalt,8,8);plane(B,-100,-100,100,-15,0,M.asphalt,8,8);
  // valley terrain mesh
  {const g=new THREE.PlaneGeometry(200,30,200,60);g.rotateX(-Math.PI/2);const pos=g.attributes.position;const col=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const h=luxH(x,z);pos.setY(i,h);
      const sl=Math.abs(luxH(x,z+0.5)-luxH(x,z-0.5))+Math.abs(luxH(x+0.5,z)-luxH(x-0.5,z));let r,gg,b;
      if(z>=7&&z<=15&&x>=-45&&Math.abs(h-luxRampH(x))<0.02){r=0.62;gg=0.6;b=0.55;}
      else if(sl>1.3){r=0.66;gg=0.58;b=0.42;}else if(Math.abs(z)<2.7){r=0.32;gg=0.3;b=0.24;}else if(sl>0.4){r=0.42;gg=0.45;b=0.3;}else{r=0.33;gg=0.48;b=0.22;}
      const v=rnd(0.88,1.1);col[i*3]=Math.pow(r*v,2.2);col[i*3+1]=Math.pow(gg*v,2.2);col[i*3+2]=Math.pow(b*v,2.2);}
    g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*40,uv.getY(i)*6);
    const m=new THREE.Mesh(g,M.terrain);m.receiveShadow=true;addObj(m);}
  {const g=new THREE.PlaneGeometry(200,5.2);g.rotateX(-Math.PI/2);g.translate(0,-22.15,0);const m=new THREE.Mesh(g,M.water);m.receiveShadow=true;addObj(m);}
  // plazas / corniche paving
  plane(B,-65,15,65,18.6,0.02,M.paving,3,3);plane(B,-24,18.6,-5.5,26,0.02,M.paving,3,3);plane(B,6,25,31,41,0.02,M.paving,3,3);plane(B,-26,-26,-5.5,-15,0.02,M.paving,3,3);
  plane(B,-9,-58,-5,-15,0.02,M.sidewalk,4,4);plane(B,5,-58,9,-15,0.02,M.sidewalk,4,4);plane(B,-9,18.6,-5,70,0.02,M.sidewalk,4,4);plane(B,5,18.6,9,70,0.02,M.sidewalk,4,4);
  for(let z=-55;z<70;z+=6)if(Math.abs(z)>16)bx(B,0,0.025,z,0.15,0.01,3,M.line,0,0,false);
  // parapets along cliffs
  for(const [a,b] of [[-65,-5.6],[5.6,41]])bx(B,(a+b)/2,0.55,15.2,b-a,1.1,0.4,M.sandstone,2,1.1);
  for(const [a,b] of [[-65,-5.6],[5.6,65]])bx(B,(a+b)/2,0.55,-15.2,b-a,1.1,0.4,M.sandstone,2,1.1);
  for(let x=-39;x<65;x+=6){const xm=Math.min(x+3,64);const r=luxRampH(xm);bx(B,Math.min(x+3,62),r+0.5,7.15,6,1.2,0.3,M.sandstone,2,1.2);}
  // fortification buttresses on the north cliff (Corniche)
  for(const x of [-58,-44,-30,-18,16,28])bx(B,x,-8.5,13.4,4,17,2.6,M.sandstone,3,3);
  // ===== PONT ADOLPHE (double arch) =====
  bx(B,0,-0.7,0,11,1.4,30,M.sandstone,3,3);
  plane(B,-3.4,-15,3.4,15,0.015,M.asphalt,8,8);plane(B,-5,-15,-3.4,15,0.015,M.sidewalk,3,3);plane(B,3.4,-15,5,15,0.015,M.sidewalk,3,3);
  for(const rx of [-2.25,-0.75,0.75,2.25])bx(B,rx,0.03,0,0.08,0.03,30,M.metal,0,0,false);
  bx(B,-5.2,0.55,0,0.4,1.1,30,M.sandstone,2,1.1);bx(B,5.2,0.55,0,0.4,1.1,30,M.sandstone,2,1.1);
  for(const ax of [-3,3]){for(let i=0;i<22;i++){const a0=Math.PI*i/22,a1=Math.PI*(i+1)/22;const zA=12.5*Math.cos(a0),yA=-22+19*Math.sin(a0),zB=12.5*Math.cos(a1),yB=-22+19*Math.sin(a1);
      const len=Math.hypot(zB-zA,yB-yA)+0.12;const g=boxGeo(3.6,1.8,len,2,2);g.rotateX(Math.atan2(-(yB-yA),zB-zA));g.translate(ax,(yA+yB)/2,(zA+zB)/2);B.add(g,M.sandstone);
      addCollider(ax-1.8,Math.min(yA,yB)-0.9,Math.min(zA,zB),ax+1.8,Math.max(yA,yB)+0.9,Math.max(zA,zB));}
    for(const zp of [-10.5,-8,-5.5,-3,3,5.5,8,10.5]){const ya=-22+19*Math.sqrt(Math.max(0,1-(zp/12.5)**2))+0.9;const hgt=-1.4-ya;if(hgt>0.2)bx(B,ax,ya+hgt/2,zp,2.4,hgt,1.1,M.sandstone,2,2);}}
  for(const zs of [-1,1])bx(B,0,-11.7,zs*13.75,11,20.6,2.5,M.sandstone,3,3);
  for(const zl of [-12,-4,4,12])for(const xs of [-5.2,5.2]){cyl(B,xs,1.6,zl,0.05,0.07,2.2,6,M.metalDark);bx(B,xs,2.8,zl,0.3,0.4,0.3,M.lampHead,0,0,false);LAMPS.push({x:xs,y:2.8,z:zl});}
  // ===== VILLE-HAUTE (north) =====
  // Place de la Constitution + Gëlle Fra
  {const x=-14,z=21.5;bx(B,x,1,z,3.2,2,3.2,M.sandstone,2,2,false);const ob=new THREE.CylinderGeometry(0.33,0.75,11,4);ob.rotateY(Math.PI/4);ob.translate(x,7.5,z);B.add(ob,M.stoneLight);
    cyl(B,x,13.6,z,0.12,0.3,1.2,8,M.gold);sphere(B,x,14.35,z,0.14,M.gold);bx(B,x,14.45,z,0.08,0.7,0.08,M.gold,0,0,false);
    {const t=new THREE.TorusGeometry(0.2,0.035,6,14);t.translate(x,14.95,z);B.add(t,M.gold);}addCollider(x-1.6,0,z-1.6,x+1.6,13,z+1.6);
    cyl(B,-20,4,24,0.06,0.08,8,6,M.metal);const fl=new THREE.PlaneGeometry(2.2,1.4);fl.translate(-18.85,7.2,24);B.add(fl,M.flag);addCollider(-20.1,0,23.9,-19.9,8,24.1);}
  // Cathedral Notre-Dame
  {const x0=-29,z0=28.5;bx(B,x0+11,7,z0+5,20,14,10,M.stoneLight,4,4,false);prism(B,x0+11,14,z0+5,20,10,5,M.slate,true);
    tower(B,x0+2.4,z0+5,5,29,M.stoneLight,0.1,true);cyl(B,x0+2.4,29.6+9,z0+5,0,2.6,18,8,M.slate,Math.PI/8);
    for(const zz of [z0+1.6,z0+8.4]){bx(B,x0+19.5,10.5,zz,3,21,3,M.stoneLight,3,3,false);cyl(B,x0+19.5,21+5,zz,0,1.7,10,8,M.slate,Math.PI/8);}
    bx(B,x0+0.2,2.6,z0+5,0.4,5.2,3,M.metalDark,0,0,false);addCollider(x0,0,z0,x0+21,22,z0+10);}
  fillBlock(B,-64,24,-36,41,3,5);
  // Place d'Armes: kiosk, trees, terraces
  {const x=18.5,z=33;cyl(B,x,0.4,z,3.6,3.8,0.8,8,M.stoneLight);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;cyl(B,x+Math.cos(a)*3.2,2.4,z+Math.sin(a)*3.2,0.09,0.09,3.2,6,M.metalGreen);}
    cyl(B,x,5.1,z,0.15,4.3,2.2,8,M.copper);addCollider(x-3.6,0,z-3.6,x+3.6,0.8,z+3.6);
    for(const [tx,tz] of [[9,27.5],[15,27.5],[22,27.5],[28,27.5],[9,38.5],[28,38.5]])tree(B,tx,tz,1.1);
    for(let i=0;i<5;i++){const tx=10+i*4,tz=39.5;cyl(B,tx,0.7,tz,0.45,0.45,0.05,10,M.white);cyl(B,tx,0.36,tz,0.05,0.05,0.7,6,M.metalDark);}
    for(const [bx_,bz] of [[12,30],[25,30],[12,36],[25,36]])bench(B,bx_,bz,true);}
  fillBlock(B,36,24,64,41,3,5);
  // north blocks along Grand-Rue
  {const x0=8,z0=48;luxBuilding(B,x0,z0,x0+20,z0+9,3,2);for(const tx of [x0+1.2,x0+18.8]){cyl(B,tx,9,z0+0.8,1.2,1.2,18,10,M.stoneLight);cyl(B,tx,19.6,z0+0.8,0,1.5,3.2,10,M.slate);}addCollider(x0,0,z0-0.5,x0+20,19,z0+9);
    fillBlock(B,x0,58,x0+20,66,3,5);}
  fillBlock(B,-64,47,-36,66,3,5);fillBlock(B,-30,47,-9,66,3,5);fillBlock(B,36,47,64,66,3,5);
  for(let z=22;z<68;z+=9){tree(B,-7,z,0.85);tree(B,7,z,0.85);}
  for(let z=24;z<68;z+=12){lamp(B,-5.6,z);lamp(B,5.6,z);}
  for(let x=-60;x<62;x+=11)if(Math.abs(x)>8)lamp(B,x,16.2);
  for(const [x,z,al] of [[-4.1,30,false],[4.1,36,false],[-4.1,52,false],[4.1,60,false],[-40,44,true],[44,44,true],[-22,44,true]])car(B,x,z,al,rndi(0,7));
  for(const [x,z] of [[-30,17.5],[-40,17.5],[30,17.5],[22,17.5]])bench(B,x,z,true);
  // ===== QUARTIER GARE (south) =====
  {// BCEE-like bank with clock tower (Place de Metz)
    luxBuilding(B,-31,-38,-12,-27,4,4);tower(B,-14,-27.5,4.5,31,M.stoneLight,4,true);}
  fillBlock(B,-64,-35,-35,-19,4,6);fillBlock(B,9,-35,64,-19,4,6);fillBlock(B,-64,-58,-9,-41,4,6);fillBlock(B,9,-58,64,-41,4,6);
  {// Gare Centrale
    bx(B,0,7,-64,44,14,8,M.facLux[1],6,6.4,false);bx(B,0,14.3,-64,44.5,0.6,8.5,M.stoneLight,2,2,false);prism(B,0,14.6,-64,44,8,3.5,M.slate,true);
    tower(B,15,-60.5,5.5,32,M.stoneLight,6,true);bx(B,0,3.2,-59.9,10,6.4,0.3,M.glass,0,0,false);addCollider(-22,0,-68,22,18,-60);}
  for(let z=-20;z>-58;z-=8){tree(B,-7,z,0.85);tree(B,7,z,0.85);}
  for(let z=-22;z>-58;z-=12){lamp(B,-5.6,z);lamp(B,5.6,z);}
  for(const [x,z,al] of [[-4.1,-30,false],[4.1,-44,false],[30,-38,true],[-44,-38,true],[20,-38,true]])car(B,x,z,al,rndi(0,7));
  {cyl(B,-8.7,1.3,-48,0.04,0.04,2.6,6,M.metalDark);bx(B,-7.6,2.6,-48,2.6,0.08,1.4,M.glass,0,0,false);bench(B,-7.6,-48.3,true);}
  // ===== VALLÉE DE LA PÉTRUSSE =====
  for(let x=-60;x<62;x+=7.5){if(Math.abs(x)<8)continue;tree(B,x+rnd(-1,1),rnd(3.4,5.8),rnd(0.7,1),-22);tree(B,x+rnd(-1,1),-rnd(3.4,5.8),rnd(0.7,1),-22);}
  bx(B,-20,-21.75,0,2.2,0.3,6.4,M.wood,1,1);bx(B,-20.95,-21.2,0,0.08,0.8,6.4,M.metalDark,0,0);bx(B,-19.05,-21.2,0,0.08,0.8,6.4,M.metalDark,0,0);
  for(let i=0;i<4;i++){const x=-62+i*4.2;bx(B,x,-22+5.5,-5.4,4,11,3.2,M.facLux[i%6],6,6.4,false);prism(B,x,-22+11,-5.4,3.2,4,2.4,M.slate,false);addCollider(x-2,-22,-7,x+2,-22+13.4,-3.8);}
  for(let x=-40;x<40;x+=14)lamp(B,x,-6.6,-22);
  boundary(-66,-66,66,70);
  B.build();buildGrid();
  MAP={name:'lux',label:'Luxembourg',terrain:luxH,water:(x,z)=>Math.abs(z)<2.6?-22.15:-1e9,spawn:{x:3,z:21},yaw:Math.PI,nav:luxNav,region:luxRegion,bounds:[-64,-64,64,68]};
}

/* ---------- QUARTIER NOIR (invented, gritty) ---------- */
function darkBuilding(B,x0,z0,x1,z1,h,tint,brick){
  const w=x1-x0,d=z1-z0,cx=(x0+x1)/2,cz=(z0+z1)/2;
  bx(B,cx,h/2,cz,w,h,d,brick?M.brick:M.facDark[tint%M.facDark.length],brick?6:6,brick?6:6,false);
  bx(B,cx,1.75,cz,w+0.06,3.5,d+0.06,M.graffiti,12,3.5,false);
  bx(B,cx,h+0.5,cz,w,1,d,M.concrete,4,1,false);bx(B,cx,h+0.1,cz,w-0.8,0.2,d-0.8,M.concrete,4,4,false);
  if(Math.random()<0.6)bx(B,cx+rnd(-w/4,w/4),h+1.2,cz+rnd(-d/4,d/4),2,1.4,1.6,M.metalDark,0,0,false);
  if(Math.random()<0.4)cyl(B,cx+rnd(-w/3,w/3),h+2.2,cz+rnd(-d/3,d/3),1.2,1.2,2.4,10,M.rust);
  addCollider(x0,0,z0,x1,h+1,z1);
}
function barrelFire(B,x,z){cyl(B,x,0.45,z,0.32,0.3,0.9,10,M.rust);addCollider(x-0.32,0,z-0.32,x+0.32,0.9,z+0.32);PERM_FIRES.push({x,y:0.95,z,r:0.45,perm:true,life:1e9});}
function buildDark(){
  const B=new Batch();
  plane(B,-100,-100,100,100,0,M.asphalt,7,7);
  const starts=[-66,-26,14];
  const types=[['towers','brick','lot'],['brick','plaza','towers'],['lot','towers','brick']];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const x0=starts[i],z0=starts[j],x1=x0+28,z1=z0+28;const ty=types[i][j];
    plane(B,x0-2,z0-2,x1+2,z1+2,0.02,M.sidewalk,3,3);
    if(ty==='towers'){darkBuilding(B,x0,z0,x0+13,z0+13,rnd(24,44),rndi(0,3));darkBuilding(B,x0+15,z0+15,x1,z1,rnd(20,40),rndi(0,3));darkBuilding(B,x0+15,z0,x1,z0+11,rnd(10,16),0,true);darkBuilding(B,x0,z0+16,x0+11,z1,rnd(10,16),0,true);}
    else if(ty==='brick'){let p=0;while(p<28){const w=Math.min(rnd(7,11),28-p);darkBuilding(B,x0+p,z0,x0+p+w,z0+10,rnd(9,17),rndi(0,3),Math.random()<0.6);darkBuilding(B,x0+p,z1-10,x0+p+w,z1,rnd(9,17),rndi(0,3),Math.random()<0.6);p+=w;}
      bx(B,x0+14,0.6,z0+14,1.2,1.2,1.2,M.wood,1.2,1.2);barrelFire(B,x0+10,z0+14);}
    else if(ty==='lot'){for(const [a,b,c,d] of [[x0,z0,x1,z0+0.3],[x0,z1-0.3,x1,z1],[x0,z0,x0+0.3,z1],[x1-0.3,z0,x1,z0+10],[x1-0.3,z0+18,x1,z1]])bx(B,(a+c)/2,0.6,(b+d)/2,c-a,1.2,d-b,M.concrete,3,1.2);
      car(B,x0+7,z0+8,true,0,true);car(B,x0+19,z0+20,false,0,true);car(B,x0+8,z0+21,true,3);barrelFire(B,x0+14,z0+12);barrelFire(B,x0+21,z0+7);
      for(let k=0;k<6;k++)bx(B,x0+rnd(3,25),0.3,z0+rnd(3,25),rnd(0.8,2),rnd(0.3,0.7),rnd(0.8,2),M.burnt,1,1);
      bx(B,x0+4,0.75,z0+25,1.8,1.5,1.1,M.bin,1,1);deadTree(B,x0+24,z0+3);}
    else{plane(B,x0,z0,x1,z1,0.03,M.paving,3,3);cyl(B,x0+14,0.4,z0+14,3,3.2,0.8,14,M.concrete);addCollider(x0+11.2,0,z0+11.2,x0+16.8,0.8,z0+16.8);
      bx(B,x0+6,1.4,z0+22,10,2.8,2.6,M.burnt,1,1);bx(B,x0+6,0.4,z0+22,10.2,0.8,2.8,M.rust,2,1,false);
      barrelFire(B,x0+20,z0+8);barrelFire(B,x0+8,z0+7);for(const [tx,tz] of [[x0+3,z0+3],[x0+25,z0+25],[x0+25,z0+3]])deadTree(B,tx,tz);bench(B,x0+20,z0+20,true);bench(B,x0+14,z0+5,true);}
  }
  for(const s of [-32,8,48])for(let t=-62;t<62;t+=13){lamp(B,s-5.2,t,0,Math.random()<0.35);lamp(B,t,s-5.2,0,Math.random()<0.35);}
  for(let i=0;i<12;i++){const s=pick([-32,8,48]),t=rnd(-60,60);const along=Math.random()<0.5;const x=along?t:s+rnd(-3,3),z=along?s+rnd(-3,3):t;if(insideBox(x,0.5,z,2)||Math.hypot(x-8,z-8)<7)continue;
    const r=Math.random();if(r<0.4)car(B,x,z,along,rndi(0,7),Math.random()<0.5);else if(r<0.6){bx(B,x,0.75,z,1.8,1.5,1.1,M.bin,1,1);}else if(r<0.8)bx(B,x,0.45,z,along?2.4:0.6,0.9,along?0.6:2.4,M.concrete,2,1);else barrelFire(B,x,z);}
  boundary(-70,-70,70,70);
  B.build();buildGrid();
  MAP={name:'dark',label:'Quartier Noir',terrain:()=>0,water:null,flat:true,spawn:{x:8,z:8},yaw:0,nav:null,region:null,bounds:[-68,-68,68,68]};
}

function buildMap(){clearMap();if(SET.map==='dark')buildDark();else buildLux();}
function spawnPoint(near,rmin,rmax,sameLevel){
  for(let i=0;i<60;i++){const a=Math.random()*Math.PI*2,d=rnd(rmin,rmax);const x=near.x+Math.sin(a)*d,z=near.z+Math.cos(a)*d;const bnd=MAP.bounds;
    if(x<bnd[0]||x>bnd[2]||z<bnd[1]||z>bnd[3])continue;
    const gy=groundAt(x,z,60);if(insideBox(x,gy+0.6,z,0.5))continue;if(gy-terrainH(x,z)>0.6)continue;
    if(sameLevel!==false&&Math.abs(gy-groundAt(near.x,near.z,near.y!==undefined?near.y:60))>2.5)continue;
    if(waterLevel(x,z)>gy)continue;
    return{x,z,y:gy};}
  return null;
}
