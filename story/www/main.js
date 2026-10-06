// floor-0-lift: floor-0 (PLAN s5 floor, H7) plus one switch for the lift (ORDERS 4b HB1): ?lift=duet,quiet,colour or
// WORLD.lift below. Off by default; with it off this page never loads ../lift/ and behaves as floor-0 did at Gate 5.
// Joins x1 FLATLAND-ENGINE v1 (slice law, polygons, Flatlander strip) and x2 VOICE-OF-SHAPES v1 (voices), both
// imported unchanged, with Devon's Tripo block (tripo-in/plain-cube-low.glb, Gate 1 + 1b PASS) as the gift.
// Pure parts are exported so Node can run them (slicecheck.mjs); the page boots only in a browser.
import {regularPolygon,prismMesh,triangleSoup,sliceTriangles,loopSegments,sightStrip,pointInside,clamp} from '../x1/20261005-x1-FLATLAND-ENGINE-v1/flatland-engine/lib/geometry.mjs';
import {inspectGlb} from '../x1/20261005-x1-FLATLAND-ENGINE-v1/flatland-engine/lib/glb.mjs';
import {readBinary} from '../x1/20261005-x1-FLATLAND-ENGINE-v1/flatland-engine/lib/load.mjs';
import {createVoices,MAX_VOICES} from '../x2/voices/voices.mjs';

// City, sizes and colours from world.json (draft, Oct 5 23:04 CT); poseShelf from improve/hexreach-plain-cube-low-output.txt.
export const WORLD={seed:1884,count:60,size:1,radius:20,plaza:7.5,giftSize:8,light:'#F2E8D5',eye:'#FFFFFF',gift:'#C8107A',background:'#040406',
  poseShelf:[0.337307,0,-0.323372,0.884112],cycle:{down:10,hold:4,up:10,street:6},reach:3.5,bendReach:8,observer:[0,24],fog:0.045,
  lift:['duet','quiet','colour']};   // THE LIFT SWITCH (STORY copy: on, as LIFT.md s.7 says). ?lift=off in the address turns it off.
// STORY: the opening that plays on load (?story=0 turns it off; any key, click or tap skips). Seconds on the story clock.
// Captions: Abbott's own words (Flatland, 1884, public domain) and one line of plain stage text. Sources in ../STORY.md.
// v2 (Devon: "jumping to the end of the story?"): the world comes first and is lived in for 36 s before the visitor.
// Beat 1 THE WORLD 0-36 | beat 2 THE VISITOR 36-58 | beat 3 THE UPLIFT 58-72 | beat 4 HAND OVER 72 (+10 s hint over free play).
export const STORY={handover:72,hintFor:10,
  approach:{walk:[12,22.5],touch:22.8,bow:[24.2,27.4],home:[28,34]},nowhere:[35.5,47],
  caps:[
  [2,9.5,'Nothing was visible, nor could be visible, to us, except Straight Lines.'],
  [11,19,'If Fog were non-existent, all lines would appear equally and indistinguishably clear.'],
  [23,30,'Feel and be felt.'],
  [37,45.5,'I mean a direction in which you cannot look, because you have no eye in your side.'],
  [59,65.2,'I saw a Line that was no Line; Space that was not Space.'],
  [65.8,71.8,'Upward, not Northward.']],
  hint:'The cube comes down again. While it cuts the plane, press C to call from inside its slice.'};
const ss=u=>{u=Math.min(1,Math.max(0,u));return u*u*(3-2*u);};
export const storyGiftT=T=>T<36?26:T<60?T-36:26;            // beat 1 and 3: held above (street phase); beat 2: one real down-hold-up pass
export const storyLift=T=>ss((T-58)/12);                     // 0 = eye at the table's edge, 1 = above (the eye slider's own scale)
export const storyObserver=T=>{const a=Math.PI/2+0.5*(1-ss(Math.min(T,11)/11)),r=23.5;return [r*Math.cos(a),r*Math.sin(a)];};   // a slow walk along the rim, then stand
// The citizen who comes to meet you (beat 1): walk in out of the fog, touch your corner, bow (step back, dip), walk home.
// Returns the scripted place and a small turn for the bow; null outside the approach.
export function storyApproach(T,home,obs,A=STORY.approach){
  const dx=home[0]-obs[0],dz=home[1]-obs[1],L=Math.hypot(dx,dz)||1,near=[obs[0]+dx/L*1.3,obs[1]+dz/L*1.3],back=[obs[0]+dx/L*2.4,obs[1]+dz/L*2.4];
  const mix=(p,q,u)=>[p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u];
  if(T<A.walk[0]||T>=A.home[1])return null;
  if(T<A.walk[1])return {pos:mix(home,near,ss((T-A.walk[0])/(A.walk[1]-A.walk[0]))),turn:0};
  if(T<A.bow[0])return {pos:near,turn:0};
  if(T<A.bow[1]){const u=(T-A.bow[0])/(A.bow[1]-A.bow[0]);return {pos:mix(near,back,ss(u*2)),turn:0.45*Math.sin(Math.PI*u)};}
  if(T<A.home[0])return {pos:back,turn:0};
  return {pos:mix(back,home,ss((T-A.home[0])/(A.home[1]-A.home[0]))),turn:0};
}
// The order's ladder of sides (book s.3): many Triangles, fewer of each higher rank, three near-Circles (40 sides). 60 in all.
const LADDER=[[3,16],[4,14],[5,10],[6,8],[7,3],[8,2],[9,1],[10,1],[11,1],[12,1],[40,3]];

export function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function city(w=WORLD){
  const r=rng(w.seed),out=[];
  for(const s of LADDER.flatMap(([n,k])=>Array(k).fill(n))){
    let x=0,z=0,tries=0;
    do{const a=r()*2*Math.PI,d=Math.sqrt(w.plaza**2+r()*(w.radius**2-w.plaza**2));x=d*Math.cos(a);z=d*Math.sin(a);}while(++tries<200&&out.some(c=>Math.hypot(c.home[0]-x,c.home[1]-z)<1.6));
    out.push({sides:s,home:[x,z],pos:[x,z],angle:r()*2*Math.PI,heading:Math.atan2(-z,-x),moving:false,touching:false,flare:0,beatUntil:0,d:Infinity});
  }
  return out;
}
// Height of the gift's centre above the plane at time t (s): down 10 s, held near the middle 4 s, up 10 s, 6 s of street (PLAN H1).
export function giftHeight(t,half,w=WORLD){
  const {down,hold,up,street}=w.cycle,T=down+hold+up+street,top=half+1.5,s=((t%T)+T)%T,e=u=>u*u*(3-2*u);
  if(s<down)return top*(1-e(s/down));
  if(s<down+hold)return half*0.012*Math.sin(2*Math.PI*(s-down)/hold);
  if(s<down+hold+up)return top*e((s-down-hold)/up);
  return top;
}
// File frame -> gift frame: centre the file's box, scale its largest side to `size`, turn by quaternion q [x,y,z,w]. Column-major, as three.js.
export function giftMatrix(min,max,q,size){
  const [x,y,z,w]=q,c=[0,1,2].map(i=>(min[i]+max[i])/2),s=size/Math.max(...[0,1,2].map(i=>max[i]-min[i]));
  const m=[(1-2*(y*y+z*z))*s,2*(x*y+z*w)*s,2*(x*z-y*w)*s,0, 2*(x*y-z*w)*s,(1-2*(x*x+z*z))*s,2*(y*z+x*w)*s,0, 2*(x*z+y*w)*s,2*(y*z-x*w)*s,(1-2*(x*x+y*y))*s,0, 0,0,0,1];
  for(let i=0;i<3;i++)m[12+i]=-(m[i]*c[0]+m[4+i]*c[1]+m[8+i]*c[2]);
  return m;
}
// The corners a citizen can feel on a slice outline: resample by arc length, turning angle over a small window, local maxima
// at or above 25 degrees (numbers from flatlaw-proof LAWS: windowFrac 0.03, cornerDeg 25). angle = the interior angle felt.
export function feltCorners(loop,{samples=128,windowFrac=0.03,cornerDeg=25}={}){
  const n=loop.length;if(n<3)return [];
  const seg=loop.map((p,i)=>Math.hypot(loop[(i+1)%n][0]-p[0],loop[(i+1)%n][1]-p[1])),total=seg.reduce((a,b)=>a+b,0);if(!(total>0))return [];
  const pts=[];let acc=0,j=0;
  for(let k=0;k<samples;k++){const want=k*total/samples;let guard=0;while(acc+seg[j]<want&&guard++<n){acc+=seg[j];j=(j+1)%n;}const u=seg[j]?(want-acc)/seg[j]:0,a=loop[j],b=loop[(j+1)%n];pts.push([a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])]);}
  const w=Math.max(2,Math.round(windowFrac*samples)),turn=pts.map((p,i)=>{const a=pts[(i-w+samples)%samples],c=pts[(i+w)%samples];let t=Math.atan2(c[1]-p[1],c[0]-p[0])-Math.atan2(p[1]-a[1],p[0]-a[0]);t=Math.atan2(Math.sin(t),Math.cos(t));return Math.abs(t)*180/Math.PI;});
  const idx=[];
  for(let i=0;i<samples;i++){if(turn[i]<cornerDeg)continue;let peak=true;for(let k=-w;k<=w&&peak;k++){const v=turn[(i+k+samples)%samples];if(v>turn[i]||(v===turn[i]&&k<0))peak=false;}if(peak)idx.push(i);}
  if(idx.length<2)return idx.map(i=>({x:pts[i][0],z:pts[i][1],angle:180-turn[i]}));
  // A worn block rounds its corners, so read each angle between the two straight arms (chords over the middle half of each arm).
  const at=f=>pts[((Math.round(f)%samples)+samples)%samples],arm=(i0,i1)=>{const span=((i1-i0)%samples+samples)%samples||samples,a=at(i0+span*0.25),b=at(i0+span*0.75);return Math.atan2(b[1]-a[1],b[0]-a[0]);};
  const turns=idx.map((i,k)=>{const t=arm(i,idx[(k+1)%idx.length])-arm(idx[(k-1+idx.length)%idx.length],i);return Math.atan2(Math.sin(t),Math.cos(t))*180/Math.PI;}),o=Math.sign(turns.reduce((a,b)=>a+b,0))||1;
  return idx.map((i,k)=>({x:pts[i][0],z:pts[i][1],angle:180-turns[k]*o}));
}
export function nearestOnSegments(p,segs){
  let d=Infinity,q=null;
  for(const [a,b] of segs){const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz||1e-12,u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/L,0,1),x=a[0]+u*dx,z=a[1]+u*dz,e=Math.hypot(p[0]-x,p[1]-z);if(e<d){d=e;q=[x,z];}}
  return {d,q};
}
export const rankOf=s=>clamp((Math.min(s,13)-3)/10,0,1)*0.9;
export const sidesForAngle=a=>a>=179.5?32:clamp(360/(180-a),3,32);   // an n-gon's interior angle is 180(n-2)/n

const api={ready:false,frames:0,t:0,gpu:'',slice:null,touches:0,audio:'locked',errors:[]};
async function boot(){
  window.floor0=api;
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const q=new URLSearchParams(location.search);let frozen=q.has('t')?Number(q.get('t')):null;if(frozen!==null&&!Number.isFinite(frozen))throw new Error('?t= must be a number of seconds.');
  const canvas=document.getElementById('world'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(WORLD.background);
  const gl=renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');api.gpu=String(info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
  const scene=new THREE.Scene();scene.background=new THREE.Color(WORLD.background);
  const hemi=new THREE.HemisphereLight('#fff4e6','#1a1020',1.6);scene.add(hemi);const key=new THREE.DirectionalLight('#fff0dd',2.2);key.position.set(-8,20,10);scene.add(key);
  const camera=new THREE.PerspectiveCamera(42,1,0.05,300);
  const plane=new THREE.Mesh(new THREE.CircleGeometry(WORLD.radius+3,96),new THREE.MeshBasicMaterial({color:'#0b0a10'}));plane.rotation.x=-Math.PI/2;plane.position.y=-0.03;scene.add(plane);

  // The city: x1's exact regular polygons, extruded thin on the plane, each with one bright eye point at its front (book s.4).
  const R=WORLD.size/2,people=city(),eyeGeo=new THREE.SphereGeometry(0.09,10,8),eyeMat=new THREE.MeshBasicMaterial({color:WORLD.eye}),light=new THREE.Color(WORLD.light),white=new THREE.Color('#ffffff');
  for(const c of people){
    const m=prismMesh(regularPolygon(c.sides,R,[0,0],c.angle),0,0.055),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.positions,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));
    c.mat=new THREE.MeshBasicMaterial({color:WORLD.light,side:THREE.DoubleSide});c.mesh=new THREE.Mesh(g,c.mat);c.eye=new THREE.Mesh(eyeGeo,eyeMat);scene.add(c.mesh,c.eye);
  }

  // The gift: x1's reader and GLB check, three's GLTFLoader, posed by hexreach's poseShelf. One matrix feeds both the picture and the slice.
  const bytes=await readBinary(new URL('models/cube.glb',location.href),{expectedBytes:746436}),problems=inspectGlb(bytes,{selfContained:true});if(problems.length)throw new Error(problems.join(' '));
  const manager=new THREE.LoadingManager();manager.setURLModifier(u=>{if(/^(data|blob):/.test(u))return u;throw new Error('The block asked for an outside file; it must embed its texture.');});
  const gltf=await new Promise((ok,no)=>new GLTFLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',ok,no));
  gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene),M=giftMatrix(box.min.toArray(),box.max.toArray(),WORLD.poseShelf,WORLD.giftSize);
  const chunks=[],giftMats=[];
  gltf.scene.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,pos=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){pos[i*3]=p.getX(i);pos[i*3+1]=p.getY(i);pos[i*3+2]=p.getZ(i);}
    chunks.push(triangleSoup({positions:pos,indices:o.geometry.index?o.geometry.index.array:null},new THREE.Matrix4().fromArray(M).multiply(o.matrixWorld).elements));
    for(const mat of [o.material].flat()){mat.transparent=true;giftMats.push(mat);}});
  const soup=new Float64Array(chunks.reduce((n,c)=>n+c.length,0));{let k=0;for(const c of chunks){soup.set(c,k);k+=c.length;}}
  let low=Infinity;for(let i=1;i<soup.length;i+=3)low=Math.min(low,soup[i]);const half=-low;
  const pose=new THREE.Group();pose.matrixAutoUpdate=false;pose.matrix.fromArray(M);pose.matrixWorldNeedsUpdate=true;pose.add(gltf.scene);const gift=new THREE.Group();gift.add(pose);scene.add(gift);

  // The slice on the plane, its corner glints, and touch flares.
  const sliceGroup=new THREE.Group();scene.add(sliceGroup);
  const fillMat=new THREE.MeshBasicMaterial({color:WORLD.gift,transparent:true,opacity:0.6,side:THREE.DoubleSide,depthTest:false}),lineMat=new THREE.LineBasicMaterial({color:'#ff86c8',depthTest:false});
  const glintGeo=new THREE.BufferGeometry();glintGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(32*3),3));const glints=new THREE.Points(glintGeo,new THREE.PointsMaterial({color:'#ffd6ee',size:0.45,depthTest:false}));glints.renderOrder=7;scene.add(glints);
  const flares=Array.from({length:16},()=>{const f=new THREE.Mesh(new THREE.RingGeometry(0.18,0.26,28),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,side:THREE.DoubleSide,depthTest:false}));f.rotation.x=-Math.PI/2;f.renderOrder=8;f.life=0;scene.add(f);return f;});
  function drawSlice(section,corners){
    for(const o of [...sliceGroup.children]){sliceGroup.remove(o);o.geometry.dispose();}
    for(const r of section.regions){const sh=new THREE.Shape(r.outer.map(p=>new THREE.Vector2(p[0],p[1])));for(const h of r.holes)sh.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],p[1]))));const g=new THREE.ShapeGeometry(sh);g.rotateX(Math.PI/2);g.translate(0,0.04,0);const m=new THREE.Mesh(g,fillMat);m.renderOrder=5;sliceGroup.add(m);}
    const edges=[...section.loops.flatMap(loopSegments),...section.openSegments];
    if(edges.length){const pts=[];for(const [a,b] of edges)pts.push(new THREE.Vector3(a[0],0.05,a[1]),new THREE.Vector3(b[0],0.05,b[1]));const l=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lineMat);l.renderOrder=6;sliceGroup.add(l);}
    const arr=glintGeo.attributes.position.array,n=Math.min(32,corners.length);for(let i=0;i<n;i++)arr.set([corners[i].x,0.07,corners[i].z],i*3);glintGeo.attributes.position.needsUpdate=true;glintGeo.setDrawRange(0,n);
  }

  // The voices: x2's engine, eight voices on the eight citizens nearest the gift (or the observer). Silent until a real tap.
  let observer=WORLD.observer.slice();   // STORY: the Flatlander's place; the story walks it, free play keeps WORLD.observer
  const engine=createVoices({ceiling:0.08}),voices=Array.from({length:MAX_VOICES},()=>({v:engine.createVoice({sides:3,rank:0.2,size:1,x:0,y:0}),owner:-1}));let ceiling=0.08;
  const unlock=async ev=>{if(engine.status.unlocked)return;try{await engine.unlock(ev);for(const s of voices)s.v.start();api.audio='on';document.getElementById('listen').dataset.on='1';}catch(e){api.audio='locked: '+e.message;}};
  document.getElementById('listen').addEventListener('click',unlock);addEventListener('pointerdown',unlock);addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')unlock(e);});
  document.addEventListener('visibilitychange',()=>{if(!engine.status.unlocked)return;if(document.hidden)engine.silence();else for(const s of voices)s.v.start();});
  function voiceStreet(sliceSides,area,now){
    const obs=observer;let order=people.map((c,i)=>[Number.isFinite(c.d)?c.d:100+Math.hypot(c.pos[0]-obs[0],c.pos[1]-obs[1]),i]).sort((a,b)=>a[0]-b[0]).slice(0,MAX_VOICES).map(r=>r[1]);
    if(lift)order=lift.voiceOrder(order);
    if(story&&!story.done&&story.app>=0&&!order.includes(story.app))order[order.length-1]=story.app;   // STORY: the citizen who comes to you always has its voice
    const held=new Set(voices.map(s=>s.owner)),free=voices.filter(s=>!order.includes(s.owner));for(const i of order)if(!held.has(i))free.shift().owner=i;
    for(const s of voices){
      // STORY beat 2: the visitor's own voice (its middle outline, a hexagon) placed at the listener, so it comes from no direction (book s.16).
      if(story&&!story.done&&story.nowhereOn&&s===voices[voices.length-1]){s.v.update({sides:6,rank:1,size:1.6,x:observer[0]/4,y:observer[1]/4,moving:false});continue;}
      const c=people[s.owner],w=sliceSides?clamp(1-c.d/WORLD.bendReach,0,1):0,beat=now<c.beatUntil;
      const sides=beat?c.beatSides:c.sides+(sliceSides-c.sides)*w*0.7;
      s.v.update({sides:lift?lift.voiceSides(s.owner,sides):sides,rank:beat?c.beatRank:rankOf(c.sides),size:1,x:c.pos[0]/4,y:c.pos[1]/4,moving:c.moving});}
    const next=Math.round((0.08-0.04*clamp(area/50,0,1))*200)/200;if(next!==ceiling){ceiling=next;engine.setCeiling(next);}   // the gift is a hole of silence: the street ducks
  }
  engine.setListener({x:WORLD.observer[0]/4,y:WORLD.observer[1]/4});

  // The touch: citizens within reach walk to the outline, touch it, turn their eye to it, flare, and sing the angle they felt.
  function feel(c,section,segs,corners,center,dt,now){
    let target=c.home,q=null;c.d=Infinity;
    if(segs.length){const n=nearestOnSegments(c.pos,segs);c.d=n.d;q=n.q;const inside=section.loops.some(l=>pointInside(c.pos,l));
      if(inside||c.d<WORLD.reach){let dx=c.pos[0]-q[0],dz=c.pos[1]-q[1],L=Math.hypot(dx,dz);if(inside||L<1e-6){dx=c.pos[0]-center[0];dz=c.pos[1]-center[1];L=Math.hypot(dx,dz)||1;}target=[q[0]+dx/L*(R+0.06),q[1]+dz/L*(R+0.06)];}}
    const tx=target[0]-c.pos[0],tz=target[1]-c.pos[1],L=Math.hypot(tx,tz),step=Math.min(L,2.5*dt);if(L>1e-6){c.pos[0]+=tx/L*step;c.pos[1]+=tz/L*step;}c.moving=step>0.4*dt;
    const touching=q!==null&&c.d<=R+0.12;
    if(touching&&!c.touching){let felt=180,best=1.2;for(const k of corners){const e=Math.hypot(k.x-q[0],k.z-q[1]);if(e<best){best=e;felt=k.angle;}}
      c.beatSides=sidesForAngle(felt);c.beatRank=felt<100?0.85:0.25;c.beatUntil=now+(felt<100?0.3:0.8);c.flare=1;api.touches++;
      const f=flares.find(x=>x.life<=0);if(f){f.position.set(q[0],0.06,q[1]);f.life=1;}}
    c.touching=touching;
    const look=q?Math.atan2(q[1]-c.pos[1],q[0]-c.pos[0]):c.heading;let dh=Math.atan2(Math.sin(look-c.heading),Math.cos(look-c.heading));c.heading+=dh*Math.min(1,dt*4);
    c.flare=Math.max(0,c.flare-dt*1.6);c.loop=regularPolygon(c.sides,R,c.pos,c.angle);
    c.mesh.position.set(c.pos[0],0,c.pos[1]);c.mat.color.copy(light).lerp(white,c.flare);c.eye.position.set(c.pos[0]+Math.cos(c.heading)*R*0.75,0.06,c.pos[1]+Math.sin(c.heading)*R*0.75);
  }

  // The Flatlander's sight: x1's sightStrip from one observer at the city's edge; gift hits in the gift's colour.
  const strip=document.getElementById('strip'),sctx=strip.getContext('2d');let giftCols=0;
  function drawStrip(section){
    const W=clamp(Math.round(strip.clientWidth||640),64,640);if(strip.width!==W||strip.height!==1){strip.width=W;strip.height=1;}
    giftCols=0;
    const o=observer,a=sightStrip(o,[0,0],people.flatMap(c=>loopSegments(c.loop)),W,Math.PI/2,WORLD.fog),gs=[...section.loops.flatMap(loopSegments),...section.openSegments],b=gs.length?sightStrip(o,[0,0],gs,W,Math.PI/2,WORLD.fog):null,img=sctx.createImageData(W,1);
    for(let i=0;i<W;i++){const g=b&&b.distances[i]<a.distances[i];if(g)giftCols++;const v=g?b.brightness[i]:a.brightness[i],c=g?[200,16,122]:[242,232,213];img.data.set([4+c[0]*v|0,4+c[1]*v|0,6+c[2]*v|0,255],i*4);}
    sctx.putImageData(img,0,0);
  }

  // The eye: one slider from above down to the table's edge; the strip below is always the eye inside the plane.
  const eye=document.getElementById('eye');
  function placeCamera(){const e=Number(eye.value),a=e*e*(3-2*e);camera.position.set(0,0.22+a*(40-0.22),26+a*(30-26));camera.lookAt(0,0.22+a*(2.5-0.22),0);}
  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?62:42;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();

  let section=sliceTriangles(new Float64Array(0),0),corners=[],lastH=NaN,last=performance.now();const t0=last;
  // The lift switch: the address wins over WORLD.lift. With no lift named, ../lift/ is never loaded.
  let lift=null;{const want=q.has('lift')?q.get('lift'):WORLD.lift.join(',');
    if(want&&want!=='off'){const L=await import('../lift/floor0-adapter.mjs'),list=L.parseLift(want);
      if(list.length){lift=L.createLift(list,{THREE,scene,WORLD,R,people,lineMat,eyeMat,hemi,key,t0,api});api.lift=lift.api;}}}
  api.setTime=t=>{frozen=Number.isFinite(t)?t:null;};api.setEye=v=>{eye.value=String(clamp(v,0,1));};

  // STORY: built from the engine's own state each frame (the slice, the strip, the voices, the eye), not a video.
  // Beat 1 (0-18 s) the plane: eye at the table's edge, the strip enlarged to most of the screen, the observer walking the rim.
  // Beat 2 (18-42 s) the visitor: one real pass of the cube, corner first; it reaches the line as a point at about 20.7 s.
  // Beat 3 (42-58 s) the uplift: the eye rises to above, the strip shrinks back to its band. Beat 4 (58 s) free play + one hint.
  const sc=document.getElementById('story'),sx=sc.getContext('2d'),cap=document.getElementById('cap');
  const story={on:q.get('story')!=='0',t:0,beat:0,eye:Number(eye.value),cap:-1,shown:[],giftCols:0,corners:0,done:true,how:null,endedAt:null,app:-1,appSides:0,appDist:null,touchAt:null,touchCols:null,nowhereOn:false,appMinD:null,appMaxD:null};
  {const o=WORLD.observer;let best=1e9;people.forEach((c,i)=>{const d=Math.hypot(c.home[0]-o[0],c.home[1]-o[1]),off=Math.abs(Math.atan2(c.home[0]-o[0],o[1]-c.home[1]));if(d>=12&&d<=21&&off<best){best=off;story.app=i;}});
   if(story.app>=0){const c=people[story.app];story.appSides=c.sides;story.appHome=c.home.slice();story.appAngle=c.angle;}}   // STORY: the citizen out in the fog, nearest the middle of your line
  story.done=!story.on;let storyStart=null,freeT0=t0,hintTimer=0;api.story=story;
  function showCap(k,text){if(k===story.cap)return;story.cap=k;if(k<0){cap.classList.remove('on');return;}cap.textContent=text;cap.classList.add('on');story.shown.push({k,at:+story.t.toFixed(2)});}
  function drawStory(p){
    const w=sc.clientWidth||innerWidth,h=sc.clientHeight||innerHeight;if(sc.width!==w||sc.height!==h){sc.width=w;sc.height=h;}
    sx.clearRect(0,0,w,h);if(p<=0.002){sc.hidden=true;return;}sc.hidden=false;
    const sb=Math.max(22,0.04*h),bandH=sb+(0.62*h-sb)*p,y=(h-sb)+((0.56*h-0.31*h)-(h-sb))*p;
    sx.fillStyle=`rgba(4,4,6,${p})`;sx.fillRect(0,0,w,h);
    sx.imageSmoothingEnabled=false;sx.drawImage(strip,0,0,strip.width,1,0,y,w,bandH);   // the same 1-pixel sight line the strip shows, made tall
    const g=sx.createLinearGradient(0,y,0,y+bandH);g.addColorStop(0,`rgba(4,4,6,${p})`);g.addColorStop(0.46,'rgba(4,4,6,0)');g.addColorStop(0.54,'rgba(4,4,6,0)');g.addColorStop(1,`rgba(4,4,6,${p})`);
    sx.fillStyle=g;sx.fillRect(0,y,w,bandH);
    const tc=story.touchCols;if(tc){const x0=tc[0]/tc[2]*w,x1=(tc[1]+1)/tc[2]*w;sx.fillStyle=`rgba(255,255,255,${0.85*tc[3]*p})`;sx.fillRect(x0,y+bandH*0.44,x1-x0,bandH*0.12);}   // the felt corner flashes white on your line
  }
  function endStory(how,now){
    if(story.done)return;story.done=true;story.how=how;story.endedAt=+story.t.toFixed(2);story.beat=4;
    document.body.classList.remove('story');observer=WORLD.observer.slice();story.nowhereOn=false;if(story.app>=0){const c=people[story.app];c.home=story.appHome.slice();c.angle=story.appAngle;}engine.setListener({x:observer[0]/4,y:observer[1]/4});drawStory(0);
    if(how==='skipped')eye.value='0.7';freeT0=now;   // free play starts the cube's own cycle from the top, so it comes down again
    showCap(5,STORY.hint);clearTimeout(hintTimer);hintTimer=setTimeout(()=>showCap(-1),STORY.hintFor*1000);
  }
  const skip=ev=>{if(story.done)return;if(ev.target?.closest?.('#listen'))return;endStory('skipped',performance.now());};   // the listen button turns sound on without skipping
  addEventListener('keydown',skip);addEventListener('pointerdown',skip);
  if(story.on){document.body.classList.add('story');eye.value='0';}
  function storyStep(now){
    if(story.done)return null;if(storyStart===null)storyStart=now;
    const T=(now-storyStart)/1000;story.t=T;
    if(T>=STORY.handover){endStory('played',now);return null;}
    story.beat=T<36?1:T<58?2:3;story.eye=storyLift(T);eye.value=String(story.eye);
    story.nowhereOn=T>=STORY.nowhere[0]&&T<STORY.nowhere[1];
    if(story.app>=0){const c=people[story.app],a=storyApproach(T,story.appHome,observer);c.home=a?a.pos:story.appHome.slice();c.angle=story.appAngle+(a?a.turn:0);
      if(story.touchAt===null&&T>=STORY.approach.touch){story.touchAt=+T.toFixed(2);const o=observer,dx=c.pos[0]-o[0],dz=c.pos[1]-o[1],L=Math.hypot(dx,dz)||1;   // the touch: your corner (a Square, 90 degrees) against theirs
        c.beatSides=sidesForAngle(90);c.beatRank=0.85;c.beatUntil=now/1000+0.7;c.flare=1;story.touchDist=+L.toFixed(2);const f=flares.find(x=>x.life<=0);if(f){f.position.set(o[0]+dx/L*0.8,0.06,o[1]+dz/L*0.8);f.life=1;}}}
    if(T<11.5){observer=storyObserver(T);engine.setListener({x:observer[0]/4,y:observer[1]/4});}
    const k=STORY.caps.findIndex(c=>T>=c[0]&&T<c[1]);showCap(k,k>=0?STORY.caps[k][2]:'');
    return storyGiftT(T);
  }

  function frame(now){
    try{
      const dt=Math.min(0.05,Math.max(0,(now-last)/1000));last=now;const st=storyStep(now),t=st??frozen??(now-freeT0)/1000,h=st!==null?giftHeight(t,half):lift?lift.giftHeight(giftHeight(t,half),half):giftHeight(t,half);
      gift.position.y=h;const op=0.35+0.65*clamp((h-half)/1.5,0,1);for(const m of giftMats){m.opacity=op;m.depthWrite=op>0.99;}
      if(h!==lastH){lastH=h;section=sliceTriangles(soup,-h);corners=section.loops.flatMap(l=>feltCorners(l));drawSlice(section,corners);}
      const segs=[...section.loops.flatMap(loopSegments),...section.openSegments];let cx=0,cz=0;for(const s of segs){cx+=s[0][0];cz+=s[0][1];}const center=segs.length?[cx/segs.length,cz/segs.length]:[0,0];
      for(const c of people)feel(c,section,segs,corners,center,dt,now/1000);
      if(lift)lift.afterFeel({corners,center,giftT:t});
      for(const f of flares){if(f.life>0){f.life=Math.max(0,f.life-dt*2);f.scale.setScalar(1+3*(1-f.life));f.material.opacity=f.life;}}
      const sliceSides=section.loops.length?(corners.length>=13||corners.length===0?32:corners.length):0;voiceStreet(sliceSides,section.stats.area,now/1000);if(lift)lift.logVoices(t,voices,ceiling);
      placeCamera();renderer.render(scene,camera);drawStrip(section);
      if(st!==null){story.giftCols=giftCols;story.corners=corners.length;
        if(story.app>=0){const c=people[story.app],o=observer,d=Math.hypot(c.pos[0]-o[0],c.pos[1]-o[1]);story.appDist=+d.toFixed(2);story.appMinD=Math.min(story.appMinD??d,d);story.appMaxD=Math.max(story.appMaxD??d,d);
          if(c.flare>0.01){const W=strip.width,r=sightStrip(o,[0,0],loopSegments(c.loop),W,Math.PI/2,WORLD.fog);let i0=-1,i1=-1;for(let i=0;i<W;i++)if(Number.isFinite(r.distances[i])){if(i0<0)i0=i;i1=i;}story.touchCols=i0>=0?[i0,i1,W,c.flare]:null;}else story.touchCols=null;}
        const p=1-story.eye;drawStory(p*p);}
      api.frames++;api.t=t;api.slice={height:h,half,corners:corners.length,angles:corners.map(k=>Math.round(k.angle)),sideCount:section.stats.sideCount,contours:section.stats.contourCount,open:section.openSegments.length,area:section.stats.area,touching:people.filter(c=>c.touching).length};
      if(api.frames===1){api.ready=true;document.body.dataset.ready='true';}
      requestAnimationFrame(frame);
    }catch(e){fail(e);}
  }
  requestAnimationFrame(frame);
}
function fail(e){api.errors.push(String(e?.message??e));const f=document.getElementById('fail');if(f){f.hidden=false;f.textContent='floor-0 stopped: '+(e?.message??e)+' Reload the page; nothing was saved or changed.';}document.body.dataset.ready='error';console.error(e);}
if(typeof window!=='undefined'&&typeof document!=='undefined')boot().catch(fail);
