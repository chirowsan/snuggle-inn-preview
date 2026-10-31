// Authoritative stair kinematics extracted from frozen stair-v3, no fixture timeline.
import {clamp,lerp,smooth,rigPose as basePose,solveTwoBone} from './animal-motion-pose.mjs';
export const TREADS_SOURCE=[[415,1250],[420,1165],[450,1075],[484,985],[517,902],[551,822],[584,744],[615,668],[646,598],[672,533],[698,471],[724,411],[750,352],[776,294],[800,240],[817,184]];
const points=TREADS_SOURCE.map(([x,y])=>({x,y})),lengths=[0];
for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
const total=lengths.at(-1),fractions=lengths.map(d=>d/total);
export const FLIGHT_SECONDS=2.6;

const mix=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
export function treadRoute(p,layout){const pts=layout?.points||points,ls=layout?.lengths||lengths,full=ls.at(-1),d=clamp(p)*full;let i=1;while(i<ls.length-1&&ls[i]<d)i++;return mix(pts[i-1],pts[i],(d-ls[i-1])/(ls[i]-ls[i-1]));}
export function productionLayout(width,height,metrics={}){
  const top=metrics.top??46,bottom=84,stageHeight=metrics.stageHeight??Math.max(190,height-top-bottom),sx=metrics.sx??width/1200,sy=metrics.sy??stageHeight/700;
  const spriteScale=metrics.spriteScale??Math.max(.4,Math.min(width/1450,stageHeight/600));
  // One uniform transform reaches BOTH ordinary-projection endpoints.
  const k=630*sy/(points[0].y-points.at(-1).y);
  // Shift only the contact centerline within the painted treads, not art pixels.
  const correction=((points.at(-1).x-points[0].x)-100*sx/k)/2;
  const route=points.map((p,i)=>({x:p.x+correction*(1-2*fractions[i]),y:p.y})),ls=[0];
  for(let i=1;i<route.length;i++)ls.push(ls.at(-1)+Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y));
  const lower={x:1010*sx,y:top+530*sy},upper={x:1110*sx,y:top+600*sy};
  return {width,height,top,bottom,stageHeight,sx,sy,spriteScale,k,points:route,lengths:ls,fractions:ls.map(d=>d/ls.at(-1)),correction,
    imageSize:{width:1024*k,height:1536*k},lower,upper,
    m0:{x:lower.x-route[0].x*k,y:lower.y-route[0].y*k},
    m1:{x:upper.x-route.at(-1).x*k,y:upper.y-route.at(-1).y*k}};
}
export function scaleRigConfig(base,factor,kind){
  const targetHeight=(base.origin[1]*base.scale+base.hipHeight)*factor;
  const c={...base,scale:base.scale*factor,targetHeight,factor};
  for(const key of ['hipHeight','stairHipHeight','thighLength','shinLength','upperArmLength','forearmLength','ankleHeight','bagDrop'])if(Number.isFinite(c[key]))c[key]*=factor;
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail','nearAnkle','farAnkle'])if(base[key])c[key]={x:base[key].x*factor,y:base[key].y*factor};
  c.stairHipHeight=c.hipHeight+(kind==='rabbit'?1.5:0);
  c.frontSockets=Object.fromEntries(Object.entries(base.frontSockets||{}).map(([k,p])=>[k,{x:p.x*factor,y:p.y*factor}]));return c;
}
function matrix(layout,q,view){const blend=view==='lower'?0:view==='upper'?1:q;return {...mix(layout.m0,layout.m1,blend),k:layout.k,blend};}
const project=(p,m)=>({x:m.x+p.x*m.k,y:m.y+p.y*m.k});
const unproject=(p,m)=>({x:(p.x-m.x)/m.k,y:(p.y-m.y)/m.k});
function buildBound(direction,layout,config={}){
  const points=layout.points,fractions=layout.fractions;
  const ids=direction===1?[0,2,4,6,8,10,12,14,15]:[15,13,11,9,7,5,3,1,0];
  const stance=.09,D=FLIGHT_SECONDS;
  const sourceRoot=t=>treadRoute(direction===1?clamp(t/D):1-clamp(t/D),layout);
  const initial=points[ids[0]],face=direction;
  const foot=(p,leg)=>{const offset=config.contacts?.[leg]||{x:leg==='near'?-2.8:2.8,y:leg==='near'?.65:-.65};return{x:p.x+offset.x*face/layout.k,y:p.y+offset.y/layout.k};};
  const events=ids.map((index,i)=>({leg:i%2===0?'near':'far',index,time:(direction===1?fractions[index]:1-fractions[index])*D-stance/2,point:foot(points[index],i%2===0?'near':'far')}));
  // The last short catch-up is complete BEFORE authoritative arrival, not after it.
  const last=events.at(-1),closingLeg=last.leg==='near'?'far':'near';
  events.push({leg:closingLeg,index:ids.at(-1),time:D-.005,point:foot(points[ids.at(-1)],closingLeg)});
  function leg(t,side,airLift){
    const own=events.filter(e=>e.leg===side),previous=own.filter(e=>e.time<=t).at(-1),next=own.find(e=>e.time>t);
    if(previous&&t<=previous.time+stance)return{point:previous.point,planted:true,event:previous};
    if(!next)return{point:previous?.point||foot(initial,side),planted:true,event:previous};
    const start=previous?Math.max(0,previous.time+stance):0,from=previous?.point||foot(initial,side),q=clamp((t-start)/(next.time-start));
    const root=sourceRoot(t),a=sourceRoot(start),b=sourceRoot(next.time);
    const relative=mix({x:from.x-a.x,y:from.y-a.y},{x:next.point.x-b.x,y:next.point.y-b.y},smooth(q));
    let y=root.y+relative.y-airLift/layout.k*Math.sin(Math.PI*q);
    if(direction===1){
      const window=Math.min(.08,(next.time-start)*.8),r=clamp((t-next.time+window)/window);
      const endVelocity=(sourceRoot(next.time).y-sourceRoot(next.time-.001).y)/.001+airLift/layout.k*Math.PI/(next.time-start);
      const lift=Math.max(0,-endVelocity+55/layout.k)*window;
      y-=lift*r*r*(1-r);
    }
    return{point:{x:root.x+relative.x,y},planted:false,event:next};
  }
  return {events,stance,sourceRoot,at(t,kind){
    t=clamp(t,0,D);const near=leg(t,'near',kind==='rabbit'?1.1:1.9),far=leg(t,'far',kind==='rabbit'?1.1:1.9);
    const support=near.planted&&far.planted?'both':near.planted?'near':far.planted?'far':'none';
    const preceding=events.filter(e=>e.time+stance<=t).at(-1),following=events.find(e=>e.time>t);
    const flightU=support==='none'&&preceding&&following?clamp((t-preceding.time-stance)/(following.time-preceding.time-stance)):0;
    const phase=(events.filter(e=>e.time<=t).length-1)+flightU;
    const aerialDuration=support==='none'&&preceding&&following?following.time-preceding.time-stance:0;
    // Fixed bounded gravity: a short last-step flight cannot have the same apex
    // as a long two-tread bound. No new clock or delayed endpoint is introduced.
    const aerialApex=Math.min(4.2,140*aerialDuration*aerialDuration);
    return{sourceRoot:sourceRoot(t),sourceFeet:{near:near.point,far:far.point},support,
      contactIds:{near:near.planted?`near:${near.event?.time}`:null,far:far.planted?`far:${far.event?.time}`:null},
      sourceFlightBounds:support==='none'&&preceding&&following?{from:{side:preceding.leg,foot:preceding.point,root:sourceRoot(preceding.time+stance)},to:{side:following.leg,foot:following.point,root:sourceRoot(following.time)},u:flightU,duration:following.time-preceding.time-stance}:null,
      flightU,flightHeight:support==='none'?4*aerialApex*flightU*(1-flightU):0,cadence:phase,u:flightU};
  }};
}
// Pure authoritative-progress sampler. There is no fixture timeline or clock.
export function createStairProgressSampler(layout,config,kind='pip'){
  const up=buildBound(1,layout,config),down=buildBound(-1,layout,config);
  function sampleProgress(progress,{direction=1,floorOffset=0,time=0,load=null}={}){
    const p=clamp(progress),local=(direction===1?p:1-p)*FLIGHT_SECONDS,b=(direction===1?up:down).at(local,kind);
    const m={x:layout.m0.x,y:layout.m0.y+floorOffset*layout.stageHeight,k:layout.k,blend:floorOffset};
    const root=project(b.sourceRoot,m),feet={near:project(b.sourceFeet.near,m),far:project(b.sourceFeet.far,m)},moving=local<FLIGHT_SECONDS;
    const bounds=b.sourceFlightBounds,flightBounds=bounds?{...bounds,from:{...bounds.from,foot:project(bounds.from.foot,m),root:project(bounds.from.root,m)},to:{...bounds.to,foot:project(bounds.to.foot,m),root:project(bounds.to.root,m)}}:null;
    return {...b,root,feet,flightBounds,sourceFeet:b.sourceFeet,face:direction,time,local,load,intendedLoad:load,reach:0,kind,stairs:true,moving,
      segment:{at:root,duration:FLIGHT_SECONDS,type:moving?'bound':'hold'},progress:p,matrix:m,
      authoritativeRoot:{x:1010+100*p,y:530-630*p},arrived:!moving,remaining:Math.max(0,FLIGHT_SECONDS-local)};
  }
  return {layout,config,sampleProgress,events:{up:up.events,down:down.events}};
}
export function solveStairPose(state,config){
  const strength=state.moving?smooth(state.local/.12)*smooth(state.remaining/.12):0;
  const lean=strength*(state.face===1?.045:-.018);
  const r=p=>({x:p.x*Math.cos(lean)-p.y*Math.sin(lean),y:p.x*Math.sin(lean)+p.y*Math.cos(lean)});
  const modified={...config,stairHipHeight:config.stairHipHeight+state.flightHeight*(config.targetHeight/45.94)};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail'])modified[key]=r(config[key]);
  const input=state.kind==='rabbit'?{...state,load:null,intendedLoad:null}:state;
  const pose=basePose(input,modified);pose.bodyAngle+=lean;
  if(state.kind==='rabbit'){
    const clearance=7*config.factor,shoulder=pose.sockets.nearShoulder;
    let paw={x:shoulder.x-.7*config.factor,y:Math.min(-3.5*config.factor,state.root.y-pose.root.y-config.bagDrop-clearance)};
    if(state.turn){const u=state.turn.progress,yaw=Math.cos(Math.PI*u),front=Math.sin(Math.PI*u);
      const shoulderX=state.root.x+state.turn.fromFace*lerp(config.nearShoulder.x*yaw,config.frontSockets.nearShoulder.x,front);
      const world={x:shoulderX-state.turn.fromFace*.7*config.factor*yaw,y:state.segment.at.y-config.bagDrop-clearance-Math.sin(Math.PI*u)*1.5};
      paw={x:(world.x-pose.root.x)*pose.face,y:world.y-pose.root.y};}
    pose.arms.near={...solveTwoBone(shoulder,paw,config.upperArmLength,config.forearmLength,-(state.turn?Math.abs(Math.cos(Math.PI*state.turn.progress)):1)),paw};pose.arms.near.paw=pose.arms.near.end;
  }
  return pose;
}
