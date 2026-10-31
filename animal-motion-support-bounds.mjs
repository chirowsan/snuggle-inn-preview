// Additive native endpoint anatomy for species-owned COM bridges. No gait/root
// values are altered. Endpoints are sampled from the same pure progress function.
import {clamp,smooth} from './animal-motion-pose.mjs';
import {samplePlinthEdge} from './animal-motion-plinth.mjs';
const full=(state,config,forceSupport)=>{
 const yaw=state.yawPlan,turn=yaw&&yaw.progress<1?{...yaw,frontWeight:smooth(Math.sin(Math.PI*yaw.progress))}:state.turn||null,face=yaw?(yaw.progress<.5?yaw.fromFace:yaw.toFace):state.face;
 return{root:state.root,feet:state.feet,support:forceSupport||state.support,face,turn,hipHeight:state.baseHipHeight??config.stairHipHeight,baseHipHeight:state.baseHipHeight??config.stairHipHeight,cadence:state.cadence,u:state.u,moving:state.moving,local:state.local,remaining:state.remaining,time:state.time,flightHeight:state.flightHeight,terrainSlope:state.terrainSlope,plinth:state.plinth||null,stairs:state.stairs};
};
const unique=values=>[...new Set(values)].sort((a,b)=>a-b);
const EVENT_EPS=1e-9;
const supportOf=flags=>flags.near&&flags.far?'both':flags.near?'near':flags.far?'far':'none';
const single=s=>s==='near'||s==='far';
function intervalAt(times,t,support,sample){
 if(!single(support))return null;
 for(let i=1;i<times.length;i++){const a=times[i-1],b=times[i];if(t<a-1e-10||t>b+1e-10)continue;if(sample((a+b)/2).support===support)return{a,b};}return null;
}
export function withStairSupportBounds(sampler){
 const original=sampler.sampleProgress,D=2.6;
 return{...sampler,sampleProgress(progress,options={}){
  const direction=options.direction===-1?-1:1,state=original(progress,options),t=(direction===1?progress:1-progress)*D,key=direction===1?'up':'down',events=sampler.events[key],stance=sampler.stance[key],sample=local=>original(direction===1?clamp(local/D):1-clamp(local/D),options);
  const semantic=local=>supportOf(Object.fromEntries(['near','far'].map(side=>{const own=events.filter(e=>e.leg===side),previous=own.filter(e=>e.time<=local+EVENT_EPS).at(-1),next=own.find(e=>e.time>local+EVENT_EPS);return[side,!!(previous&&local<=previous.time+stance+EVENT_EPS||!next)];})));
  const descriptor=(local,force)=>{const raw=sample(local),support=force||semantic(local);return{...full(raw,sampler.config,support),local,remaining:D-local,...(support!=='none'?{u:0,cadence:events.filter(e=>e.time<=local+EVENT_EPS).length-1,flightHeight:0}:{})};};
  if(state.flightBounds){const next=events.find(e=>e.time>t),a=next.time-state.flightBounds.duration,b=next.time;state.flightBounds={...state.flightBounds,from:{...descriptor(a),...state.flightBounds.from},to:{...descriptor(b),...state.flightBounds.to}};}
  const times=unique([0,D,...events.flatMap(e=>[e.time,e.time+stance]).filter(v=>v>0&&v<D)]),interval=intervalAt(times,t,state.support,sample);
  state.supportBounds=interval?{from:descriptor(interval.a,interval.a===0?'both':undefined),to:descriptor(interval.b),u:clamp((t-interval.a)/(interval.b-interval.a)),duration:interval.b-interval.a}:null;
  return state;
 }};
}
export function withPlinthSupportBounds(state,edge,options){
 const D=edge.length/350,forward=edge.direction!==-1,t=(forward?edge.progress:1-edge.progress)*D,sample=local=>samplePlinthEdge({...edge,progress:forward?clamp(local/D):1-clamp(local/D)},options),timing=state.timing;
 const semantic=local=>supportOf(Object.fromEntries(['near','far'].map(side=>[side,(local<=timing.leave[side]+EVENT_EPS&&options.anchors?.planted?.[side]!==false)||local>=timing.land[side]-EVENT_EPS])));
 const descriptor=local=>{const raw=sample(local),support=semantic(local),u=local<=timing.releaseTime+EVENT_EPS?0:local>=timing.land.near-EVENT_EPS?1:raw.u;return{...full(raw,options.config,support),local,remaining:D-local,cadence:local/D,u,...(support!=='none'?{flightHeight:0}:{})};};
 if(state.flightBounds){const a=timing.releaseTime,b=timing.land.near;state.flightBounds={...state.flightBounds,from:{...descriptor(a),...state.flightBounds.from},to:{...descriptor(b),...state.flightBounds.to}};}
 const times=unique([0,D,...Object.values(timing.leave),...Object.values(timing.land)]),interval=intervalAt(times,t,state.support,sample);
 state.supportBounds=interval?{from:descriptor(interval.a),to:descriptor(interval.b),u:clamp((t-interval.a)/(interval.b-interval.a)),duration:interval.b-interval.a}:null;
 return state;
}
