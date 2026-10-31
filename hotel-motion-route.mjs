// Version-7 routing only. Physical landing gates avoid crossing painted treads.
import {floorRoute, floorOf, stairAt, stairFlight} from './rush-floors.mjs';
import {plinthFloorRoute} from './hotel-plinth-edges.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const landings=Array.from({length:4},(_,f)=>stairFlight(f)).flatMap(f=>[f.lower,f.upper]);
const isLanding=p=>landings.some(q=>dist(p,q)<.01);
function inOpen(p,f){const y=p.y+f*700,x=p.x;if(f>0)return x>=80&&x<=900&&y>=300&&y<=600;
 // Conservative static-art circulation zones. Keep clearance from cart, fountain, desk and rails.
 return x>=80&&x<=900&&y>=480&&y<=600 || x>=80&&x<=580&&y>=300&&y<=600 || x>=80&&x<=900&&y>=300&&y<=340;
}
function visible(a,b){const f=floorOf(a);if(floorOf(b)!==f)return false;const n=Math.ceil(dist(a,b)/12);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!inOpen({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},f))return false;}return true;}
// A redirected animal cannot turn around on a flight. Its existing path is the
// primary heading authority (also while paused); target and saved facing are
// fallbacks. Bare coordinate callers have no heading and retain normal routing.
function approachedLanding(origin){const flight=stairAt(origin);if(!flight)return null;
 const {lower,upper}=flight,dx=upper.x-lower.x,dy=upper.y-lower.y,length2=dx*dx+dy*dy;
 for(const p of [origin.path?.find(p=>dist(origin,p)>.01),origin.target]){if(!p)continue;
  const t=((p.x-lower.x)*dx+(p.y-lower.y)*dy)/length2;
  if(t<0||t>1||dist(p,{x:lower.x+t*dx,y:lower.y+t*dy})>.1||Math.abs(t-flight.progress)<1e-9)continue;
  return t>flight.progress?upper:lower;
 }
 return origin.facing===1?upper:origin.facing===-1?lower:null;
}
function routeWith(origin,destination,circulation){if(circulation&&dist(origin,destination)<=.01)return[];const landing=approachedLanding(origin);
 // Keep this landing outside shortcut/collinearity reduction: an opposite-floor
 // destination is a real landing U-turn, not a redundant point on one line.
 if(landing)return[landing,...(dist(landing,destination)>.01?routeWith(landing,destination,circulation):[])];
 // A task can also interrupt a horizontal landing approach/exit. First use its
 // actual corridor, never rebuild a vertical hall segment through the rails.
 const floor=floorOf(origin),localY=origin.y+floor*700,lower=Math.abs(localY-530)<1e-7,upper=Math.abs(localY-600)<1e-7;
 if(circulation&&!isLanding(origin)&&origin.x>850&&origin.x<(lower?1010:upper?1110:0)){
  if(destination.y===origin.y&&destination.x>=850&&destination.x<=(lower?1010:1110))return[{x:destination.x,y:destination.y}];
  const targetFloor=floorOf(destination),portal=lower&&targetFloor>floor?stairFlight(floor).lower:upper&&targetFloor<floor?stairFlight(floor-1).upper:{x:850,y:origin.y};
  return[portal,...routeWith(portal,destination,true)];
 }
 const original=floorRoute(origin,destination);
 if(!circulation)return shorten(origin,original);
 // Approach and leave each floor horizontally. Between flights, return via the
 // open-floor gates rather than cutting across the two flights' rails/posts.
 // Gates/landings are segment boundaries, not shortcut candidates.
 const nodes=[origin,...original];
 const inWell=p=>p.x>=1010&&p.y+floorOf(p)*700>=530&&p.y+floorOf(p)*700<=600;
 for(let i=1;i<nodes.length-1;i++){
  const p=nodes[i];if(p.y+floorOf(p)*700!==300)continue;
  if([nodes[i-1],nodes[i+1]].some(n=>isLanding(n)&&n.x===p.x&&floorOf(n)===floorOf(p)))nodes[i]={x:floorOf(p)===0?580:850,y:p.y};
 }
 const route=[],pending=[];let start=origin;
 const flush=p=>{pending.push(p);route.push(...shorten(start,pending));pending.length=0;start=p;};
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i],floorSegment=floorOf(a)===floorOf(b)&&!stairAt({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  if(floorSegment&&isLanding(a)&&isLanding(b)&&dist(a,b)>.01){flush({x:850,y:a.y});flush({x:850,y:b.y});flush(b);continue;}
  if(floorSegment&&isLanding(a)&&!inWell(b)){flush({x:850,y:a.y});if(floorOf(a)===0)pending.push({x:580,y:a.y});}
  if(floorSegment&&isLanding(b)&&!inWell(a)){if(floorOf(b)===0)pending.push({x:580,y:b.y});flush({x:850,y:b.y});}
  if(isLanding(b))flush(b);else pending.push(b);
 }
 if(pending.length)route.push(...shorten(start,pending));
 return route.filter((p,i,all)=>dist(p,i?all[i-1]:origin)>.01);
}
function shorten(origin,original){const samples=[origin];let prior=origin;
 for(const p of original){const stair=stairAt({x:(prior.x+p.x)/2,y:(prior.y+p.y)/2}),n=stair?1:Math.max(1,Math.ceil(dist(prior,p)/40));for(let i=1;i<=n;i++)samples.push({x:prior.x+(p.x-prior.x)*i/n,y:prior.y+(p.y-prior.y)*i/n});prior=p;}
 const path=[origin];for(let i=0;i<samples.length-1;){let next=i+1;for(let j=samples.length-1;j>i+1;j--)if(visible(samples[i],samples[j])){next=j;break;}path.push(samples[next]);i=next;}
 const compact=[];for(const p of path){while(compact.length>=2){const a=compact.at(-2),b=compact.at(-1),cross=(b.x-a.x)*(p.y-b.y)-(b.y-a.y)*(p.x-b.x);if(Math.abs(cross)>1e-5)break;compact.pop();}compact.push(p);}return compact.slice(1);
}
export const conservativeFloorRoute=(origin,destination,revision=1)=>revision===2||revision===3
 ?plinthFloorRoute(origin,destination,(a,b)=>routeWith(a,b,true),revision):routeWith(origin,destination,true);
// Restore-only compatibility for already-issued v7 shared spines. Never used
// for new engine commands; old saved roots and paths must not be silently moved.
export const previousMotionFloorRoute=(origin,destination)=>routeWith(origin,destination,false);
