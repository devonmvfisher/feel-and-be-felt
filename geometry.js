// Pure Euclidean geometry. Coordinates are x,y,z; Flatland is the x/z plane.
export const EPS = 1e-6;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const area2 = loop => loop.reduce((sum,p,i) => {const q=loop[(i+1)%loop.length]; return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
export function regularPolygon(sides, radius=1, center=[0,0], angle=0) {
  if (!Number.isInteger(sides) || sides<3 || sides>4096 || !(radius>0) || !Number.isFinite(radius)) throw new Error('Polygon needs 3..4096 sides and a positive radius.');
  return Array.from({length:sides},(_,i)=>[center[0]+radius*Math.cos(angle+2*Math.PI*i/sides),center[1]+radius*Math.sin(angle+2*Math.PI*i/sides)]);
}
export function prismMesh(loop,height=0,thickness=0.055) {
  if (loop.length<3 || !(thickness>0)) throw new Error('Prism needs a polygon and positive thickness.');
  const positions=[],indices=[],n=loop.length;
  for (const y of [height-thickness/2,height+thickness/2]) for (const [x,z] of loop) positions.push(x,y,z);
  for (let i=0;i<n;i++) {const j=(i+1)%n; indices.push(i,j,j+n,i,j+n,i+n);}
  for(let i=1;i<n-1;i++) indices.push(0,i+1,i,n,n+i,n+i+1);
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}
export function cubeMesh(size=4) {
  const r=size/2;
  return {positions:new Float32Array([-r,-r,-r,r,-r,-r,r,-r,r,-r,-r,r,-r,r,-r,r,r,-r,r,r,r,-r,r,r]),
    indices:new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7])};
}
export function sphereMesh(radius=2,longitudes=96,latitudes=48) {
  const p=[],idx=[];
  for(let j=0;j<=latitudes;j++) {
    const phi=Math.PI*j/latitudes;
    for(let i=0;i<longitudes;i++) {const theta=2*Math.PI*i/longitudes; p.push(radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.sin(theta));}
  }
  for(let j=0;j<latitudes;j++) for(let i=0;i<longitudes;i++) {
    const a=j*longitudes+i,b=j*longitudes+(i+1)%longitudes,c=a+longitudes,d=b+longitudes;
    if(j>0) idx.push(a,b,c);
    if(j<latitudes-1) idx.push(b,d,c);
  }
  return {positions:new Float32Array(p),indices:new Uint32Array(idx)};
}
export function triangleSoup(mesh,matrix=null) {
  const p=mesh.positions,idx=mesh.indices ?? Array.from({length:p.length/3},(_,i)=>i),out=new Float64Array(idx.length*3);
  for(let j=0;j<idx.length;j++) {
    const k=idx[j]*3,x=p[k],y=p[k+1],z=p[k+2];
    if(matrix) {
      const w=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];
      out[j*3]=(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w;
      out[j*3+1]=(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w;
      out[j*3+2]=(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14])/w;
    } else {out[j*3]=x;out[j*3+1]=y;out[j*3+2]=z;}
  }
  return out;
}
function simplify(loop,epsilon) {
  let points=loop;
  let changed=true;
  while(changed && points.length>3) {
    changed=false; const next=[];
    for(let i=0;i<points.length;i++) {
      const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
      const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const length=Math.hypot(c[0]-a[0],c[1]-a[1]);
      const between=(b[0]-a[0])*(b[0]-c[0])+(b[1]-a[1])*(b[1]-c[1])<=epsilon*epsilon;
      if(Math.abs(cross)<=epsilon*length && between) changed=true; else next.push(b);
    }
    if(next.length<3) break;
    points=next;
  }
  return points;
}
export function pointInside(point,loop) {
  let inside=false;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++) {
    const a=loop[i],b=loop[j];
    if((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function groupContours(loops) {
  const rows=loops.map(loop=>({loop,area:Math.abs(area2(loop)),depth:0,parent:null}));
  for(const row of rows) {
    const containers=rows.filter(other=>other!==row && other.area>row.area && pointInside(row.loop[0],other.loop));
    row.depth=containers.length; row.parent=containers.sort((a,b)=>a.area-b.area)[0] ?? null;
  }
  return rows.filter(r=>r.depth%2===0).map(r=>({outer:area2(r.loop)>0?r.loop:[...r.loop].reverse(),holes:rows.filter(h=>h.depth%2===1 && h.parent===r).map(h=>area2(h.loop)<0?h.loop:[...h.loop].reverse())}));
}
// Triangle-plane intersections -> welded edge graph -> closed contours. Coplanar
// triangulation edges cancel by parity. Ambiguous/open components are not capped.
export function sliceTriangles(soup,planeY=0,epsilon=EPS) {
  if(soup.length%9 || !Number.isFinite(planeY) || !(epsilon>0)) throw new Error('Invalid triangle soup, plane or tolerance.');
  const vertices=new Map(),segments=new Map();
  const key=p=>Math.round(p[0]/epsilon)+','+Math.round(p[1]/epsilon);
  function edge(a,b,coplanar=false) {
    const ka=key(a),kb=key(b); if(ka===kb) return;
    if(!vertices.has(ka)) vertices.set(ka,a); if(!vertices.has(kb)) vertices.set(kb,b);
    const id=ka<kb?ka+'|'+kb:kb+'|'+ka;
    const row=segments.get(id) ?? {a:ka,b:kb,coplanar:0,ordinary:false};
    if(coplanar) row.coplanar++; else row.ordinary=true;
    segments.set(id,row);
  }
  for(let t=0;t<soup.length;t+=9) {
    const tri=[[soup[t],soup[t+1],soup[t+2]],[soup[t+3],soup[t+4],soup[t+5]],[soup[t+6],soup[t+7],soup[t+8]]];
    if(tri.some(p=>p.some(v=>!Number.isFinite(v)))) throw new Error('Non-finite model coordinate.');
    const d=tri.map(p=>p[1]-planeY),on=d.map(n=>Math.abs(n)<=epsilon);
    if(on.every(Boolean)) {for(let i=0;i<3;i++) {const a=tri[i],b=tri[(i+1)%3];edge([a[0],a[2]],[b[0],b[2]],true);} continue;}
    if(d.every(n=>n>epsilon)||d.every(n=>n < -epsilon)) continue;
    const points=[];
    const add=p=>{if(!points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<=epsilon)) points.push(p);};
    for(let i=0;i<3;i++) {
      const j=(i+1)%3,a=tri[i],b=tri[j];
      if(on[i]) add([a[0],a[2]]);
      if((d[i]>epsilon&&d[j]<-epsilon)||(d[i]<-epsilon&&d[j]>epsilon)) {const u=d[i]/(d[i]-d[j]);add([a[0]+u*(b[0]-a[0]),a[2]+u*(b[2]-a[2])]);}
    }
    if(points.length===2) edge(points[0],points[1]);
  }
  const edges=[...segments.values()].filter(e=>e.ordinary||e.coplanar%2===1),adj=new Map();
  for(let i=0;i<edges.length;i++) for(const v of [edges[i].a,edges[i].b]) {if(!adj.has(v)) adj.set(v,[]);adj.get(v).push(i);}
  const visited=new Set(),loops=[],openSegments=[],warnings=[];
  for(let seed=0;seed<edges.length;seed++) {
    if(visited.has(seed)) continue;
    const component=[],queue=[seed],seen=new Set([seed]);
    while(queue.length) {const i=queue.pop();component.push(i);for(const v of [edges[i].a,edges[i].b]) for(const j of adj.get(v)) if(!seen.has(j)){seen.add(j);queue.push(j);}}
    component.forEach(i=>visited.add(i));
    if(component.some(i=>[edges[i].a,edges[i].b].some(v=>adj.get(v).length!==2))) {
      openSegments.push(...component.map(i=>[vertices.get(edges[i].a),vertices.get(edges[i].b)]));continue;
    }
    const start=edges[seed].a; let current=start,previous=-1;const loop=[];
    do {loop.push(vertices.get(current));const next=adj.get(current).find(i=>i!==previous);const e=edges[next]; current=e.a===current?e.b:e.a;previous=next;} while(current!==start && loop.length<=component.length);
    const clean=simplify(loop,epsilon*3);
    if(clean.length>=3 && Math.abs(area2(clean))>epsilon*epsilon) loops.push(clean);
  }
  if(openSegments.length) warnings.push('Open or non-manifold cut: unclosed edges shown, no guessed fill.');
  const regions=groupContours(loops),all=loops.flat();
  const area=regions.reduce((s,r)=>s+Math.abs(area2(r.outer))-r.holes.reduce((a,h)=>a+Math.abs(area2(h)),0),0);
  let perimeter=0;for(const loop of loops) for(let i=0;i<loop.length;i++) perimeter+=Math.hypot(loop[i][0]-loop[(i+1)%loop.length][0],loop[i][1]-loop[(i+1)%loop.length][1]);
  const bounds=all.length?{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity}:{minX:0,maxX:0,minZ:0,maxZ:0};
  for(const [x,z] of all){bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minZ=Math.min(bounds.minZ,z);bounds.maxZ=Math.max(bounds.maxZ,z);}
  return {regions,loops,openSegments,warnings,stats:{sideCount:loops.reduce((n,l)=>n+l.length,0),sideCounts:loops.map(l=>l.length),contourCount:loops.length,holeCount:regions.reduce((n,r)=>n+r.holes.length,0),area,perimeter,width:bounds.maxX-bounds.minX,depth:bounds.maxZ-bounds.minZ,equivalentRadius:Math.sqrt(Math.max(0,area)/Math.PI),bounds}};
}
export const loopSegments=loop=>loop.map((p,i)=>[p,loop[(i+1)%loop.length]]);
export function rayDistance(origin,direction,segments,maxDistance=80) {
  let nearest=maxDistance;
  for(const [a,b] of segments) {
    const sx=b[0]-a[0],sz=b[1]-a[1],qx=a[0]-origin[0],qz=a[1]-origin[1];
    const cross=direction[0]*sz-direction[1]*sx;if(Math.abs(cross)<1e-10) continue;
    const t=(qx*sz-qz*sx)/cross,u=(qx*direction[1]-qz*direction[0])/cross;
    if(t>=0.01 && u>=-EPS && u<=1+EPS && t<nearest) nearest=t;
  }
  return nearest;
}
export function sightStrip(origin,lookAt,segments,columns=480,horizontalFov=Math.PI/2,fogDensity=0.08) {
  const dx=lookAt[0]-origin[0],dz=lookAt[1]-origin[1],length=Math.hypot(dx,dz)||1,fx=dx/length,fz=dz/length;
  const distances=new Float64Array(columns),brightness=new Float64Array(columns);
  for(let i=0;i<columns;i++) {
    const u=(2*(i+.5)/columns-1)*Math.tan(horizontalFov/2),x=fx-fz*u,z=fz+fx*u,mag=Math.hypot(x,z);
    const distance=rayDistance(origin,[x/mag,z/mag],segments);
    distances[i]=distance;brightness[i]=distance>=80?0:Math.exp(-Math.pow(fogDensity*distance,2));
  }
  return {distances,brightness};
}
