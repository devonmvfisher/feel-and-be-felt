import {clamp} from './geometry.mjs';
export const PLANE_Y=0;
export const THICKNESS=0.055;
export const INSIDE={position:[0,PLANE_Y,12],lookAt:[0,PLANE_Y,0]};
export const ABOVE={position:[0,22,15],lookAt:[0,PLANE_Y,4]};
export const BEATS=[
  {title:'A world seen edge-on',text:'At the height of a Flatlander, every neighbour is a line. Near edges shine; distance dissolves into fog.',view:'inside',model:'sphere',height:-2.7},
  {title:'The shape of a society',text:'Lift above the plane: triangles, squares, five through twelve sides, and an almost-circle. All citizens share one height.',view:'above',model:'sphere',height:-2.7},
  {title:'Something enters',text:'A visitor crosses the plane. Flatland receives only a section of it: a small circle, arriving from nowhere.',view:'inside',model:'sphere',height:-1.65},
  {title:'The impossible circle',text:'At the equator, the section is widest. The Flatlander sees its bright edge, never the sphere responsible.',view:'inside',model:'sphere',height:0},
  {title:'One more dimension',text:'Rise out of Flatland. The pale body and the solid cut are one object, seen in two dimensions at once.',view:'above',model:'sphere',height:0},
  {title:'A visitor departs',text:'As the sphere rises, its circle shrinks, then vanishes. Move the height control to pass through the plane yourself.',view:'inside',model:'sphere',height:1.7},
  {title:'A different visitor',text:'The cube leaves a square section. Its size stays constant until it leaves the plane. Other models tell other stories.',view:'above',model:'cube',height:0},
  {title:'Bring your own dimension',text:'Choose a model from models/, or open a self-contained GLB. Move it through the plane; every slice is calculated from its triangles.',view:'inside',model:'cube',height:0}
];
export const ease=t=>{const u=clamp(t,0,1);return u*u*(3-2*u);};
export function blendPose(a,b,t) {const u=ease(t);return {position:a.position.map((v,i)=>v+(b.position[i]-v)*u),lookAt:a.lookAt.map((v,i)=>v+(b.lookAt[i]-v)*u)};}
export function viewPose(view) {return structuredClone(view==='above'?ABOVE:INSIDE);}
export function railIndex(current,delta,count=BEATS.length) {if(!Number.isInteger(delta)||!Number.isInteger(current)) throw new Error('Rail indices must be integers.');return clamp(current+delta,0,count-1);}
export function stillFrame(frame,{fps=30,secondsPerBeat=4,transitionSeconds=1.4}={}) {
  if(!Number.isInteger(frame)||frame<0) throw new Error('Still frame must be a nonnegative integer.');
  const maxFrame=BEATS.length*secondsPerBeat*fps-1,n=clamp(frame,0,maxFrame),time=n/fps,index=Math.floor(time/secondsPerBeat),local=time-index*secondsPerBeat;
  const beat=BEATS[index],next=BEATS[Math.min(index+1,BEATS.length-1)],t=clamp((local-(secondsPerBeat-transitionSeconds))/transitionSeconds,0,1);
  // A different object switches only at the next beat boundary, never halfway.
  const height=beat.model===next.model?beat.height+(next.height-beat.height)*ease(t):beat.height;
  return {frame:n,maxFrame,index,model:beat.model,height,pose:blendPose(viewPose(beat.view),viewPose(next.view),t),view:beat.view};
}
export function queryOptions(search) {
  const p=new URLSearchParams(search),raw=p.get('still');
  if(raw!==null&&!/^\d+$/.test(raw)) throw new Error('Use ?still=N with a nonnegative frame number.');
  const model=p.get('model');if(model && !/^models\/[A-Za-z0-9_./ -]+\.glb$/i.test(model)) throw new Error('model must be a relative models/name.glb path.');
  if(model?.split('/').some(s=>s==='..')) throw new Error('Model path cannot leave models/.');
  return {still:raw===null?null:Number(raw),full:p.get('quality')==='full',clean:p.get('clean')==='1',model};
}
// Ported from WORLD-SHELL v1: sustained frame-time pressure reduces resolution.
export function qualityStep(state,milliseconds) {
  const s={...state};if(!Number.isFinite(milliseconds)||milliseconds<=0||milliseconds>250)return s;
  s.average=(s.average??16.7)*.9+milliseconds*.1;s.cooldown=Math.max(0,(s.cooldown??0)-1);s.slow=s.average>24?(s.slow??0)+1:0;
  if(s.slow>=30&&s.cooldown===0&&s.level<3){s.level++;s.slow=0;s.cooldown=120;}return s;
}
