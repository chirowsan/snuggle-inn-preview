/** Provisional route revision 2: measured ground/plinth contact transitions.
 * World roots and fixed-step engine motion remain the sole progress authority.
 * Native visual acceptance is separate from these geometry/route assertions.
 */
import {floorOf} from './rush-floors.mjs';
// Revision2 is frozen for issued local checkpoints. Revision3 clears the
// painted upper-floor fascia; its endpoint is an authoritative world waypoint.
function geometry(upperExitX){
const EPS=1e-7,point=p=>({x:p.x,y:p.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lower=[[850,590],[930,590],[1010,530]],upper=[[1110,600],[1020,545],[upperExitX,600],[850,600]];
const chain=(kind,floor)=>(kind==='lower'?lower:upper).map(([x,y])=>({x,y:y-700*floor}));
const same=(a,b)=>distance(a,b)<EPS;
const edgeInfo=(kind,index)=>kind==='lower'&&index===1?{id:'lower-step',from:'ground',to:'plinth'}:
 kind==='upper'&&index===0?{id:'upper-entry',from:'landing',to:'plinth'}:
 kind==='upper'&&index===1?{id:'upper-exit',from:'plinth',to:'ground'}:null;
function locate(actor,includeGround=false){
 for(const kind of ['lower','upper'])for(let floor=kind==='lower'?0:1;floor<=(kind==='lower'?3:4);floor++){
  const points=chain(kind,floor);
  for(let index=0;index<points.length-1;index++){
   const start=points[index],end=points[index+1],dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),progress=((actor.x-start.x)*dx+(actor.y-start.y)*dy)/(length*length);
   if(progress<-EPS||progress>1+EPS||distance(actor,{x:start.x+progress*dx,y:start.y+progress*dy})>EPS)continue;
   const next=actor.path?.find(p=>distance(p,actor)>EPS)||actor.target;
   let direction=0;
   if(next){const along=((next.x-actor.x)*dx+(next.y-actor.y)*dy)/(length*length),cross=(next.x-actor.x)*dy-(next.y-actor.y)*dx;
    if(Math.abs(cross)<EPS*length&&Math.abs(along)>EPS)direction=along>0?1:-1;
   }
   const info=edgeInfo(kind,index);if(!includeGround&&!info)continue;
   if(!includeGround&&!direction)continue;
   if(progress<=EPS&&direction<0||progress>=1-EPS&&direction>0)continue;
   return{kind,index,floor,points,start,end,length,progress:Math.max(0,Math.min(1,progress)),direction,...info};
  }
 }
 return null;
}
/** Read-only provider classification. No render clock, writes, or arrival hold.
 * Direction comes from the saved authoritative path; progress from x/y only.
 */
function plinthEdgeAt(actor){
 const segment=locate(actor);if(!segment||!segment.direction)return null;
 const {id,floor,start,end,length,progress,direction,from,to}=segment;
 return{id,floor,start:point(start),end:point(end),length,progress,direction,
  fromSurface:from,toSurface:to,
  remainingDistance:length*(direction>0?1-progress:progress)};
}
/** Read-only outgoing ground classification for cold visual parenting.
 * Uses the same route chains as circulation. It does not infer travel from a
 * render clock or mutate an actor. A stationary exact gate is recognizable;
 * an approaching actor with an opposite saved heading is not a departure.
 */
function groundDepartureAt(actor,{maxDistance=110}={}){
 const next=actor.path?.find(p=>distance(p,actor)>EPS)||actor.target;
 for(const kind of ['lower','upper'])for(let floor=kind==='lower'?0:1;floor<=(kind==='lower'?3:4);floor++){
  const points=chain(kind,floor),exit=kind==='lower'?points[1]:points.at(-2),gate=kind==='lower'?points[0]:points.at(-1),dx=gate.x-exit.x,dy=gate.y-exit.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,travel=(actor.x-exit.x)*ux+(actor.y-exit.y)*uy,cross=(actor.x-exit.x)*uy-(actor.y-exit.y)*ux;
  if(Math.abs(cross)>EPS||travel<-EPS||travel>maxDistance+EPS)continue;
  const heading=next?(next.x-actor.x)*ux+(next.y-actor.y)*uy:actor.facing*ux;
  if(!(heading>EPS))continue;
  return{kind,floor,exit:point(exit),gate:point(gate),distance:Math.max(0,travel),length,progress:Math.max(0,Math.min(1,travel/length))};
 }
 return null;
}
const append=(route,p)=>{if(!route.length||!same(route.at(-1),p))route.push(point(p));};
function viaChain(origin,destination,groundRoute){
 const segment=locate(origin,true);if(!segment)return null;
 const {kind,points,index,progress,direction,floor}=segment;
 // A bounded raised-edge transition must finish the already approached edge.
 // Ground-only links can choose a new direction immediately.
 if(progress>EPS&&progress<1-EPS&&direction&&edgeInfo(kind,index)){
  const end=direction>0?points[index+1]:points[index];
  return[end,...plinthFloorRoute(end,destination,groundRoute)];
 }
 // Exact flight endpoints are handled by the existing flight/landing policy.
 if(same(origin,kind==='lower'?points.at(-1):points[0]))return null;
 if(same(origin,kind==='lower'?points[0]:points.at(-1)))return null;
 const sameChainDestination=points.findIndex(p=>same(p,destination));
 const targetFloor=floorOf(destination),towardEnd=sameChainDestination>=0?sameChainDestination>index+(progress>=1-EPS?1:0):kind==='lower'?targetFloor>floor:targetFloor>=floor;
 const route=[];
 if(towardEnd){for(let i=index+1;i<points.length;i++){if(!same(points[i],origin))append(route,points[i]);if(i===sameChainDestination)return route;}}
 else{for(let i=progress>=1-EPS?index+1:index;i>=0;i--){if(!same(points[i],origin))append(route,points[i]);if(i===sameChainDestination)return route;}}
 const end=route.at(-1);return end?[...route,...plinthFloorRoute(end,destination,groundRoute)]:null;
}
function plinthFloorRoute(origin,destination,groundRoute){
 if(same(origin,destination))return[];
 // An interrupted lower exit may begin exactly at the new ground gate. Keep
 // its lobby path out of the fountain/cart band, as a complete stair exit does.
 if(same(origin,{x:850,y:590})&&floorOf(destination)===0&&destination.y<480){
  const clear={x:580,y:590};return[...groundRoute(origin,clear),...groundRoute(clear,destination)];
 }
 const continuation=viaChain(origin,destination,groundRoute);if(continuation)return continuation;
 const raw=[origin,...groundRoute(origin,destination)],route=[];
 const movedGate=p=>p.x===850&&p.y+floorOf(p)*700===530?{x:850,y:p.y+60}:p;
 for(let i=1;i<raw.length;i++){
  const a=raw[i-1],b=raw[i],floor=floorOf(a),localA=a.y+700*floor,localB=b.y+700*floor;
  if(floorOf(b)===floor&&localA===530&&localB===530&&[a.x,b.x].includes(1010)&&[a.x,b.x].includes(850)){
   const points=chain('lower',floor);if(a.x===1010)points.reverse();
   for(const p of points)if(!same(p,origin)||route.length)append(route,p);
  }else if(floorOf(b)===floor&&localA===600&&localB===600&&[a.x,b.x].includes(1110)&&[a.x,b.x].includes(850)){
   const points=chain('upper',floor);if(a.x===850)points.reverse();
   for(const p of points)if(!same(p,origin)||route.length)append(route,p);
  }else append(route,movedGate(b));
  if(same(b,destination))break;
 }
 if(!route.length||!same(route.at(-1),destination))append(route,destination);
 return route.filter((p,i,all)=>!same(p,i?all[i-1]:origin));
}

return {plinthEdgeAt,groundDepartureAt,plinthFloorRoute};
}
const revisions={2:geometry(960),3:geometry(920)};
const forRevision=revision=>revisions[revision]||revisions[2];
export const plinthEdgeAt=(actor,revision=2)=>forRevision(revision).plinthEdgeAt(actor);
export const groundDepartureAt=(actor,{revision=2,...options}={})=>forRevision(revision).groundDepartureAt(actor,options);
export const plinthFloorRoute=(origin,destination,groundRoute,revision=2)=>forRevision(revision).plinthFloorRoute(origin,destination,groundRoute);
