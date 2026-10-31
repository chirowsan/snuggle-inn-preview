import {createGardenNavigation} from './garden-navigation.mjs';
import {groundPoint} from './exterior-projection.mjs';

/** Cosmetic, view-local visits. This module never sees a hotel session, a save,
 * money, reputation, service guests or wall-clock time. */
export const GARDEN_VISIT_LIMITS=Object.freeze({actors:3,speed:38,step:.1,seatSeconds:7,visitSeconds:65});
const copy=p=>({x:p.x,y:p.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const signature=design=>JSON.stringify([design?.landscape||null,design?.props||[]]);
export class GardenVisitors {
 constructor(design,{species=['rabbit','cat'],maxActors=3}={}){
  this.species=species.filter(k=>['rabbit','cat'].includes(k));this.maxActors=Math.max(0,Math.min(GARDEN_VISIT_LIMITS.actors,maxActors));
  this.actors=[];this.reservations=new Map();this.time=0;this.serial=0;this.nextArrival=.3;this.destroyed=false;this.rebuilds=0;this.updateDesign(design);
 }
 updateDesign(design){
  if(this.destroyed)return false;const key=signature(design);if(key===this.designKey)return false;
  this.designKey=key;this.navigation=createGardenNavigation(design);this.rebuilds++;
  const seats=new Map(this.navigation.seats.map(s=>[s.id,s]));
  for(const a of this.actors){
   // A canceled visit stays canceled through subsequent edits. It must not
   // become opaque again or start a new route while fading out.
   if(a.phase==='fading')continue;
   const changedSeat=a.seat&&seats.get(a.seat.id)?.signature!==a.seat.signature;
   if(changedSeat){
    // A removed/moved seat cannot support a sitter waiting behind a traveler.
    // Fade that canceled visit in its current pose instead of leaving it
    // suspended for the entire serialized departure. The first clear stand-up
    // may proceed; subsequent simultaneous seat edits fade without relocation.
    const laneBusy=this.actors.some(other=>other!==a&&!['resting','fading'].includes(other.phase));
    if(a.seatProgress>0&&(laneBusy||!this.navigation.seatTransitionClear(a.seat))){this.fade(a);continue;}
    this.release(a);a.phase=a.seatProgress>0?'standing':'reroute';a.path=[];a.afterStand='return';
   }
   else if(['resting','sitting','settling'].includes(a.phase))continue;
   // While entering the apron, keep only a portal belonging to this exact gate.
   if(['entering','returning'].includes(a.phase)&&a.y<610){
    if(!this.navigation.entry||distance(this.navigation.portal,a.portal)>.01)this.fade(a);
    continue;
   }
   if(a.phase==='standing')continue;
   if(!this.navigation.isClear(a)){this.fade(a);continue;}
   this.planReturn(a);
  }
  return true;
 }
 release(a){if(a.seat&&this.reservations.get(a.seat.id)===a.id)this.reservations.delete(a.seat.id);}
 fade(a){if(a.phase==='fading')return;this.release(a);a.phase='fading';a.path=[];a.moving=false;a.fadeAlpha=a.alpha;a.fadeTime=0;}
 planReturn(a){
  this.release(a);a.path=this.navigation.entry&&this.navigation.route(a,this.navigation.entry)||[];
  if(!this.navigation.entry||!this.navigation.isClear(a)||(!a.path.length&&distance(a,this.navigation.entry)>.01)){this.fade(a);return;}
  a.phase='returning';a.seat=null;a.path.push(copy(this.navigation.portal));a.portal=copy(this.navigation.portal);
 }
 planVisit(a){
  const available=this.navigation.seats.filter(s=>!this.reservations.has(s.id));
  // Each supported, reachable bench is offered before an ordinary stroll.
  const seat=available[(a.serial-1)%Math.max(1,available.length)];
  if(seat){const path=this.navigation.route(a,seat.approach);if(path){a.seat={...seat,seat:copy(seat.seat),approach:copy(seat.approach)};this.reservations.set(seat.id,a.id);a.path=path;a.phase='to-seat';return;}}
  const targets=this.navigation.destinations.filter(p=>distance(a,p)>70);
  if(targets.length){const target=targets[(a.serial*7)%targets.length],path=this.navigation.route(a,target);if(path){a.path=path;a.phase='strolling';return;}}
  this.planReturn(a);
 }
 spawn(){
  const nav=this.navigation;if(!nav.entry||!nav.portal||!this.species.length||this.actors.length>=this.maxActors)return;
  if(!nav.destinations.length&&!nav.seats.some(s=>!this.reservations.has(s.id)))return;
  // Keep the first outdoor slice relaxed: one visitor travels at a time.
  // Others may rest on separate reserved benches, never pass head-on.
  if(this.actors.some(a=>a.phase!=='resting'||distance(a,nav.entry)<45))return;
  const serial=++this.serial,a={id:'garden-visitor-'+serial,serial,kind:this.species[(serial-1)%this.species.length],...copy(nav.portal),portal:copy(nav.portal),phase:'entering',path:[copy(nav.entry)],seat:null,seatProgress:0,moving:true,facing:1,speed:GARDEN_VISIT_LIMITS.speed,alpha:0,age:0,wait:0};
  this.actors.push(a);
 }
 advance(a,dt){
  let budget=a.speed*dt;a.moving=false;
  while(budget>0&&a.path.length){const target=a.path[0],d=distance(a,target);if(d<.001){a.path.shift();continue;}
   const from=groundPoint(a.x,a.y),to=groundPoint(target.x,target.y);if(Math.abs(to.x-from.x)>.01)a.facing=to.x<from.x?-1:1;
   const step=Math.min(d,budget);a.x+=(target.x-a.x)*step/d;a.y+=(target.y-a.y)*step/d;budget-=step;a.moving=true;if(step===d)a.path.shift();
  }
 }
 step(seconds,{paused=false}={}){
  if(this.destroyed||paused||!Number.isFinite(seconds)||seconds<=0)return;
  // No offline catch-up. A slow frame advances at most a tenth of a second.
  const dt=Math.min(GARDEN_VISIT_LIMITS.step,seconds);this.time+=dt;
  // Edits can cancel several visits together. Preserve their visible positions
  // and resolve one traveler/stand-up transition at a time in arrival order.
  const mobile=this.actors.find(a=>!['resting','fading'].includes(a.phase));
  for(const a of this.actors){a.age+=dt;a.alpha=Math.min(1,a.alpha+dt*2);a.moving=false;
   if(a.phase==='fading'){a.fadeTime+=dt;a.alpha=Math.max(0,a.fadeAlpha-a.fadeTime*2);continue;}
   if(a.phase==='resting'){
    a.wait=Math.max(0,a.wait-dt);
    if(a.wait<=0&&!this.actors.some(other=>other!==a&&other.phase!=='resting')){a.phase='standing';a.afterStand='return';}
    continue;
   }
   if(a!==mobile)continue;
   if(a.phase==='sitting'){a.seatProgress=Math.min(1,a.seatProgress+dt/.7);if(a.seatProgress===1){a.phase='resting';a.wait=GARDEN_VISIT_LIMITS.seatSeconds+(a.serial%3);}continue;}
   if(a.phase==='settling'){a.wait-=dt;if(a.wait<=0)a.phase='sitting';continue;}
   if(a.phase==='standing'){a.seatProgress=Math.max(0,a.seatProgress-dt/.65);if(!a.seatProgress)this.planReturn(a);continue;}
   if(a.phase==='looking'){a.wait-=dt;if(a.wait<=0)this.planReturn(a);continue;}
   if(a.phase==='reroute'){this.planReturn(a);continue;}
   this.advance(a,dt);
   if(!a.path.length){
    if(a.phase==='entering')this.planVisit(a);
    else if(a.phase==='to-seat'){const valid=this.navigation.seats.find(s=>s.id===a.seat?.id&&s.signature===a.seat.signature);if(valid&&this.reservations.get(valid.id)===a.id){a.phase='settling';a.wait=.4;a.facing=valid.facing;}else this.planReturn(a);}
    else if(a.phase==='strolling'){a.phase='looking';a.wait=2.5;}
    else if(a.phase==='returning')this.fade(a);
   }
   if(a.age>GARDEN_VISIT_LIMITS.visitSeconds&&!['returning','fading'].includes(a.phase)){if(a.seatProgress){a.phase='standing';this.release(a);}else this.planReturn(a);}
  }
  this.actors=this.actors.filter(a=>a.phase!=='fading'||a.alpha>0);
  if(this.time>=this.nextArrival){this.spawn();this.nextArrival=this.time+7;}
 }
 destroy(){this.destroyed=true;this.actors=[];this.reservations.clear();}
 snapshot(){return {time:this.time,count:this.actors.length,reservations:[...this.reservations],rebuilds:this.rebuilds,actors:this.actors.map(a=>({id:a.id,kind:a.kind,x:a.x,y:a.y,phase:a.phase,seat:a.seat?.id||null,seatProgress:a.seatProgress,alpha:a.alpha,path:a.path.map(copy)}))};}
}
