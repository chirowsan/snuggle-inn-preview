import {clamp,lerp,smooth,pivotFeet} from './animal-motion-pose.mjs';

const SIDES=['near','far'];
const mix=(a,b,q)=>({x:lerp(a.x,b.x,q),y:lerp(a.y,b.y,q)});
const offset={near:{x:-2.8,y:.65},far:{x:2.8,y:-.65}};
export const restContact=(root,side,face=1)=>({x:root.x+offset[side].x*face,y:root.y+offset[side].y});
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});

/** Predict only future contact locations from the current authoritative route.
 * The returned pose root is NEVER obtained from this forecast. Route points and
 * actor state are read-only. Projection is applied after world-speed travel. */
export function routeForecast(actor,project,speed=actor.speed){
  const origin={x:actor.x,y:actor.y};
  const path=(actor.path||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  return seconds=>{
    let p=origin,budget=Math.max(0,seconds)*Math.max(0,speed||0);
    for(const target of path){const d=Math.hypot(target.x-p.x,target.y-p.y);if(d<1e-8){p=target;continue;}
      if(budget<=d)return project(lerp(p.x,target.x,budget/d),lerp(p.y,target.y,budget/d));
      budget-=d;p=target;
    }
    return project(p.x,p.y);
  };
}

/** Online planted-contact planner. There is no fixture timeline and no delayed
 * world root. Stance anchors are scene-space constants. Swing offsets follow
 * the current simulation root, which also makes reroutes/short legs bounded. */
export class FlatContactPlanner {
  constructor(kind='pip'){this.kind=kind;this.serial=0;this.last=null;this.legs=null;this.settle=null;}
  reset(root,time,face){
    this.last={root:{...root},time,face,moving:false};
    this.feet=Object.fromEntries(SIDES.map(side=>[side,restContact(root,side,face)]));
    this.legs=null;this.settle=null;
  }
  // Explicit terrain exit only. Existing ordinary flat gait remains unchanged.
  resumeFromContacts(root,time,face,feet){
    this.reset(root,time,face);
    if(SIDES.every(side=>feet?.[side]&&Number.isFinite(feet[side].x)&&Number.isFinite(feet[side].y)))this.feet=Object.fromEntries(SIDES.map(side=>[side,{...feet[side]}]));
  }
  parameters(speed){
    const walk=speed<75,step=walk?.30:speed<210?.28:.24;
    const maxTravel=this.kind==='rabbit'?8:14;
    return{walk,step,stance:walk?Math.min(step,maxTravel/Math.max(1,speed)):Math.min(this.kind==='rabbit'?.10:.125,maxTravel/Math.max(1,speed)),
      lift:walk?2.2:this.kind==='rabbit'?3.2:5.3};
  }
  sample({root,time,moving,face=1,speed=0,predict=()=>root}){
    if(!this.last||time<this.last.time||time-this.last.time>.25||Math.hypot(root.x-this.last.root.x,root.y-this.last.root.y)>Math.max(100,speed*.3))this.reset(root,time,face);
    const previous=this.last,dt=Math.max(0,time-previous.time),params=this.parameters(speed);
    const eventRoot=t=>dt?mix(previous.root,root,clamp((t-previous.time)/dt)):{...root};
    const at=t=>t<time?eventRoot(t):predict(t-time);
    const newSwing=(side,leg,t,initial=false)=>{
      const start=at(t),strike=t+(initial?params.step:2*params.step-params.stance),end=at(strike),mid=at(strike+params.stance/2);
      Object.assign(leg,{mode:'swing',start:t,end:strike,from:subtract(leg.anchor,start),to:subtract(restContact(mid,side,face),end),lift:params.lift});
    };
    const swingFoot=(leg,t,r)=>{const u=clamp((t-leg.start)/(leg.end-leg.start)),p=add(r,mix(leg.from,leg.to,smooth(u)));p.y-=Math.sin(Math.PI*u)**.85*leg.lift;return p;};
    let support='both',contactIds={near:null,far:null},u=0,cadence=0,flightHeight=0;
    if(moving){
      this.settle=null;
      if(!this.legs){
        this.legs=Object.fromEntries(SIDES.map(side=>[side,{mode:'stance',anchor:{...this.feet[side]},start:time,end:time+params.stance*.5,serial:++this.serial}]));
        newSwing('far',this.legs.far,time,true);
      }
      for(const side of SIDES){const leg=this.legs[side];let safety=0;
        while(time>=leg.end&&++safety<12){const t=leg.end;
          if(leg.mode==='stance')newSwing(side,leg,t);
          else{leg.anchor=swingFoot(leg,t,at(t));leg.mode='stance';leg.start=t;leg.end=t+params.stance;leg.serial=++this.serial;}
        }
        // A reroute can reverse the root while a foot is planted. Release that
        // contact before its horizontal reach is exhausted, never drag its anchor.
        if(leg.mode==='stance'&&Math.abs(leg.anchor.x-root.x)>(this.kind==='rabbit'?7:10))newSwing(side,leg,time);
        this.feet[side]=leg.mode==='stance'?{...leg.anchor}:swingFoot(leg,time,root);
        contactIds[side]=leg.mode==='stance'?`${side}:${leg.serial}`:null;
      }
      const near=!!contactIds.near,far=!!contactIds.far;
      support=near&&far?'both':near?'near':far?'far':'none';
      const leg=this.legs.near;u=leg.mode==='swing'?clamp((time-leg.start)/(leg.end-leg.start)):clamp((time-leg.start)/params.stance);
      cadence=time/params.step;
      if(support==='none'&&!params.walk){
        const since=Math.min(...SIDES.map(side=>time-this.legs[side].start));
        flightHeight=(this.kind==='rabbit'?3.5:4.2)*Math.sin(Math.PI*clamp(since/Math.max(.01,params.step-params.stance)));
      }
    }else{
      if(this.legs){this.settle={start:time,feet:Object.fromEntries(SIDES.map(side=>[side,{...this.feet[side]}])),face};this.legs=null;}
      if(this.settle){
        const q=clamp((time-this.settle.start)/.22),first='near',swing=q<.5?first:'far',phase=q<.5?q*2:(q-.5)*2;
        for(const side of SIDES){const progress=side===swing?smooth(phase):q<.5?0:1;this.feet[side]=mix(this.settle.feet[side],restContact(root,side,face),progress);if(side===swing&&q<1)this.feet[side].y-=Math.sin(Math.PI*phase)*1.3;}
        support=q>=1?'both':swing==='near'?'far':'near';u=phase;
        if(support!=='both'&&Math.abs(this.feet[support].x-root.x)>(this.kind==='rabbit'?7:10))support='none';
        if(q>=1)this.settle=null;
      }else this.feet=Object.fromEntries(SIDES.map(side=>[side,restContact(root,side,face)]));
      for(const side of SIDES)if(support==='both'||support===side)contactIds[side]=`rest:${side}`;
    }
    this.last={root:{...root},time,face,moving};
    return{root:{...root},feet:Object.fromEntries(SIDES.map(side=>[side,{...this.feet[side]}])),support,contactIds,
      moving,u,cadence,flightHeight,velocity:moving?speed:0,nominalSpeed:Math.max(speed,1),targetPhoneSpeed:params.walk?40:speed<210?120:200,gait:params.walk?'walk':'run',face,time,
      swing:support==='near'?'far':support==='far'?'near':support==='none'?'both':null,stairs:false};
  }
}

/** Facing changes use an authored front core and depth-projected joint planes.
 * Stationary pivots plant the support foot; moving reversals retain the contact
 * planner and never hold the root while the turn catches up. */
export function turnState(cache,state,wantedFace){
  if(cache.facing===undefined)cache.facing=wantedFace;
  if(cache.turn&&cache.turn.toFace!==wantedFace){
    // Reverse the same pivot continuously, rather than spawning stacked turns.
    const progress=clamp((state.time-cache.turn.start)/cache.turn.duration);
    cache.turn={fromFace:cache.turn.toFace,toFace:cache.turn.fromFace,start:state.time-(1-progress)*cache.turn.duration,duration:cache.turn.duration};
  }
  if(!cache.turn&&cache.facing!==wantedFace)cache.turn={fromFace:cache.facing,toFace:wantedFace,start:state.time,duration:state.moving?.18:.36,at:{...state.root}};
  if(cache.turn){const t=cache.turn,progress=clamp((state.time-t.start)/t.duration);
    if(progress>=1){cache.facing=t.toFace;cache.turn=null;state.face=cache.facing;}
    else{
      state.face=progress<.5?t.fromFace:t.toFace;state.turn={progress,fromFace:t.fromFace,toFace:t.toFace,frontWeight:smooth(Math.sin(Math.PI*progress))};
      if(!state.moving){const pivot=pivotFeet(state.root,progress,t.fromFace,t.toFace);Object.assign(state,pivot);state.contactIds=Object.fromEntries(SIDES.map(side=>[side,pivot.support===side?`pivot:${t.start}:${pivot.stage}:${side}`:null]));}
    }
  }else state.face=cache.facing;
  return state;
}
