/** Cosmetic garden navigation. No timers, storage, economy or service actors.
 * The landscape owns cell/fence semantics; this layer adds a small visitor's
 * continuous clearance and the existing catalogue's physical prop footprints. */
import {GRID,emptyLandscape,landscapeGrid,cellToWorld,worldToCell} from './landscape-model.mjs';
import {PROP_TYPES} from './exterior-catalog.mjs';

export const GARDEN_RADIUS=10;
const key=(c,r)=>c+','+r;
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=p=>({x:p.x,y:p.y});
const same=(a,b)=>distance(a,b)<1e-7;
const hardFinish=new Set(['stone','brick','gravel']);
const hardProp=new Set(['square-paving','stepping-stones','brick-path','gravel-bed']);
const seatSignature=p=>JSON.stringify([p.id,p.kind,p.x,p.y,p.rotation||0]);
const pad=(r,n)=>({x:r.x-n,y:r.y-n,width:r.width+2*n,height:r.height+2*n,id:r.id});
const contains=(r,p)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;

/** Closed segment/AABB intersection, including touching an obstacle corner. */
function intersects(a,b,r){
 let lo=0,hi=1;
 for(const axis of ['x','y']){const extent=axis==='x'?'width':'height',delta=b[axis]-a[axis];
  if(Math.abs(delta)<1e-9){if(a[axis]<r[axis]||a[axis]>r[axis]+r[extent])return false;continue;}
  let t0=(r[axis]-a[axis])/delta,t1=(r[axis]+r[extent]-a[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;
 }
 return true;
}
class MinHeap{
 constructor(){this.items=[];}
 push(item){const a=this.items;let i=a.length;a.push(item);while(i){const p=(i-1)>>1;if(a[p].cost<=item.cost)break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].cost<a[c].cost)c++;if(a[c].cost>=last.cost)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
 get size(){return this.items.length;}
}

/** Navigation is rebuilt only when design geometry changes, never per frame.
 * route(from,to) returns ordered world waypoints (without a duplicate source),
 * ending at the exact requested point; null means cancel/repath, never teleport.
 * seats end their walk at approach. seat is only for the short seated pose; it
 * deliberately is NOT a normal walkable point inside the bench footprint. */
export function createGardenNavigation(design={}, {radius=GARDEN_RADIUS}={}){
 radius=Number.isFinite(radius)?Math.max(1,Math.min(16,radius)):GARDEN_RADIUS;
 const layout=design.landscape||emptyLandscape(),grid=landscapeGrid(layout);
 const metrics={nodes:0,links:0,obstacles:0,searches:0,lastSearchVisited:0,maxSearchVisited:0};
 const obstacles=[],ground=[];
 const bounds={x:GRID.x+radius,y:GRID.y+radius,width:GRID.cols*GRID.cell-radius*2,height:GRID.rows*GRID.cell-radius*2};
 const props=(Array.isArray(design.props)?design.props:[]).slice(0,60).filter(p=>finite(p)&&PROP_TYPES[p.kind]);
 if(grid.ok){
  for(const [col,row,finish]of layout.cells)if(finish==='flowerbed'){const p=cellToWorld(col,row);obstacles.push(pad({...p,width:GRID.cell,height:GRID.cell},radius));}
  for(const [axis,col,row,kind]of layout.edges)if(kind!=='gate'){const p=cellToWorld(col,row);obstacles.push(pad({...p,width:axis==='h'?GRID.cell:0,height:axis==='v'?GRID.cell:0},radius));}
  for(const p of props){const art=PROP_TYPES[p.kind];
   if(art.ground){const quarter=Math.abs((p.rotation||0)%180)===90,width=quarter?art.height:art.width,height=quarter?art.width:art.height;ground.push({x:p.x-width/2,y:p.y-height,width,height,hard:hardProp.has(p.kind)});}
   else {const [width,height]=art.footprint;obstacles.push(pad({id:p.id,x:p.x-width/2,y:p.y-height/2,width,height},radius));}
  }
 }
 metrics.obstacles=obstacles.length;
 const clear=(p,ignoreId)=>grid.ok&&finite(p)&&contains(bounds,p)&&!obstacles.some(r=>(ignoreId===undefined||r.id!==ignoreId)&&contains(r,p));
 const segment=(a,b,ignoreId)=>clear(a,ignoreId)&&clear(b,ignoreId)&&!obstacles.some(r=>(ignoreId===undefined||r.id!==ignoreId)&&intersects(a,b,r));
 const isClear=p=>clear(p),segmentClear=(a,b)=>segment(a,b);
 const nodes=[],byId=new Map();
 if(grid.ok)for(let row=0;row<GRID.rows;row++)for(let col=0;col<GRID.cols;col++){
  const p=cellToWorld(col,row,true);if(!grid.passable(col,row)||!isClear(p))continue;
  const finish=grid.surfaces.get(key(col,row)),legacy=ground.some(r=>r.hard&&contains(r,p)),paved=hardFinish.has(finish)||legacy;
  const approach=col>=20&&col<=23;
  const n={id:key(col,row),col,row,...p,finish:finish||null,paved,cost:paved?1:approach?1.15:2.8,neighbors:[]};nodes.push(n);byId.set(n.id,n);
 }
 for(const n of nodes)for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]]){const next=byId.get(key(n.col+dc,n.row+dr));if(next&&grid.connected(n,next)&&segmentClear(n,next))n.neighbors.push(next.id);}
 metrics.nodes=nodes.length;metrics.links=nodes.reduce((sum,n)=>sum+n.neighbors.length,0);
 const entryNode=[21,22,20,23].map(c=>byId.get(key(c,0))).find(n=>n&&grid.edgeOpen('h',n.col,0)&&!obstacles.some(r=>intersects({x:n.x,y:552},n,r)));
 const entry=entryNode?point(entryNode):null,exit=entry?point(entry):null,portal=entry?{x:entry.x,y:552}:null;
 const reachable=new Set(),queue=entryNode?[entryNode]:[];
 if(entryNode)reachable.add(entryNode.id);
 for(let i=0;i<queue.length;i++)for(const id of queue[i].neighbors)if(!reachable.has(id)){reachable.add(id);queue.push(byId.get(id));}
 for(const n of nodes)n.reachable=reachable.has(n.id);
 function attachments(p){
  if(!isClear(p))return [];
  const cell=worldToCell(p),own=byId.get(key(cell.col,cell.row));
  // Prefer the owning cell. Fallback links are verified continuous segments;
  // this is not a nearest-cell relocation when an edit blocks the old position.
  if(own&&segmentClear(p,own))return [own];
  const found=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const n=byId.get(key(cell.col+dc,cell.row+dr));if(n&&segmentClear(p,n))found.push(n);}
  return found.sort((a,b)=>distance(p,a)-distance(p,b)||a.id.localeCompare(b.id));
 }
 function route(from,to){
  metrics.searches++;metrics.lastSearchVisited=0;
  const starts=attachments(from),goals=attachments(to);if(!starts.length||!goals.length)return null;if(same(from,to))return [];
  const goalCosts=new Map(goals.map(n=>[n.id,distance(n,to)*n.cost])),heap=new MinHeap(),costs=new Map(),previous=new Map(),settled=new Set();
  for(const n of starts){const cost=distance(from,n)*n.cost;costs.set(n.id,cost);heap.push({id:n.id,cost});}
  let best=null,bestCost=Infinity;
  while(heap.size){const current=heap.pop();if(settled.has(current.id)||current.cost!==costs.get(current.id))continue;if(current.cost>=bestCost)break;settled.add(current.id);
   if(goalCosts.has(current.id)){const total=current.cost+goalCosts.get(current.id);if(total<bestCost){best=current.id;bestCost=total;}}
   const n=byId.get(current.id);for(const id of n.neighbors){if(settled.has(id))continue;const next=byId.get(id),cost=current.cost+GRID.cell*(n.cost+next.cost)/2;if(cost<(costs.get(id)??Infinity)){costs.set(id,cost);previous.set(id,current.id);heap.push({id,cost});}}
  }
  metrics.lastSearchVisited=settled.size;metrics.maxSearchVisited=Math.max(metrics.maxSearchVisited,settled.size);if(!best)return null;
  const ids=[];for(let id=best;id;id=previous.get(id))ids.push(id);ids.reverse();
  const result=[];let last=from;for(const id of ids){const p=byId.get(id);if(!same(last,p)){result.push(point(p));last=p;}}if(!same(last,to))result.push(point(to));
  return result;
 }
 const seats=[];
 if(entry)for(const prop of props){
  // Upright props cannot rotate in the editor. Reject a foreign rotated bench
  // rather than seating an animal against an unrepresented orientation.
  if(prop.kind!=='garden-bench'||(prop.rotation||0)%360!==0)continue;
  const seat=point(prop),approach={x:prop.x,y:prop.y+32};
  if(!isClear(approach)||!segment(approach,seat,prop.id)||!attachments(approach).some(n=>reachable.has(n.id)))continue;
  seats.push({id:prop.id,signature:seatSignature(prop),approach,seat,facing:1});
 }
 const destinations=nodes.filter(n=>n.paved&&reachable.has(n.id)).map(n=>({...point(n),id:n.id,finish:n.finish||'legacy-paving'}));
 // A removed bench leaves ordinary free ground. Ignore its footprint only if
 // that same bench still occupies the exact old geometry; a moved same-id prop
 // may itself obstruct the visitor's previous stand-up transition.
 const seatTransitionClear=oldSeat=>{
  if(!oldSeat||!finite(oldSeat.approach)||!finite(oldSeat.seat))return false;
  const current=props.find(p=>p.id===oldSeat.id&&p.kind==='garden-bench');
  const ignore=current&&seatSignature(current)===oldSeat.signature?current.id:undefined;
  return segment(oldSeat.approach,oldSeat.seat,ignore);
 };
 return {valid:grid.ok,reason:grid.reason||'',radius,entry,exit,portal,nodes,seats,destinations,metrics,route,isClear,segmentClear,seatTransitionClear};
}
