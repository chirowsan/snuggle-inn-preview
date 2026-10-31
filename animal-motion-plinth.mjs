// Pure raised-plinth contact primitive. Current world root/progress owns timing.
import {clamp,lerp,smooth} from './animal-motion-pose.mjs';
import {TREAD_SURFACES} from './animal-motion-stairs-core.mjs';
const mix=(a,b,u)=>({x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u)});
const slopeFor=surface=>surface==='plinth'?TREAD_SURFACES[0].slope:surface==='landing'?TREAD_SURFACES.at(-1).slope:0;
export function samplePlinthEdge(edge,{layout,config,kind='pip',cameraFloor=0,time=0,load=null,moving=true,anchors=null}={}){
 const forward=edge.direction!==-1,from=forward?edge.start:edge.end,to=forward?edge.end:edge.start,
 fromSurface=forward?edge.fromSurface:edge.toSurface,toSurface=forward?edge.toSurface:edge.fromSurface,
 fromSlope=slopeFor(fromSurface),toSlope=slopeFor(toSurface),face=Math.sign(to.x-from.x)||1,fromFace=edge.id==='upper-entry'?1:face,toFace=edge.id==='upper-entry'?-1:face,
 u=clamp(forward?edge.progress:1-edge.progress),D=edge.length/350,t=u*D;
 const project=p=>({x:p.x*layout.sx,y:layout.top+(p.y+cameraFloor*700)*layout.sy}),a=project(from),b=project(to),root=mix(a,b,u);
 const contact=(p,side,slope,orientation=face)=>{const off=config.contacts?.[side]||{x:side==='near'?-2.8:2.8,y:side==='near'?.65:-.65};return{x:p.x+off.x*orientation,y:p.y+slope*off.x*orientation+off.y};};
 const leave={near:Math.min(.015,D*.06),far:Math.min(.035,D*clamp(config.plinthTrailReleaseFraction?.[edge.id]??.14,0,.14))},land={near:D-Math.min(edge.id==='upper-entry'?.012:.035,D*clamp(config.plinthLeadFraction?.[edge.id]??.14,0,.14)),far:D},feet={},planted={},contactIds={},footSurfaceIds={};
 for(const side of['near','far']){const A=anchors?.feet?.[side]||contact(a,side,fromSlope,fromFace),B=contact(b,side,toSlope,toFace);if(t<=leave[side]&&anchors?.planted?.[side]!==false){feet[side]=A;planted[side]=true;contactIds[side]=`${edge.id}:start:${side}`;footSurfaceIds[side]=fromSurface;}else if(t>=land[side]){feet[side]=B;planted[side]=true;contactIds[side]=`${edge.id}:end:${side}`;footSurfaceIds[side]=toSurface;}else{const release=anchors?.planted?.[side]===false?0:leave[side],q=clamp((t-release)/(land[side]-release)),ra=mix(a,b,release/D),rb=mix(a,b,land[side]/D),relative=mix({x:A.x-ra.x,y:A.y-ra.y},{x:B.x-rb.x,y:B.y-rb.y},smooth(q));feet[side]={x:root.x+relative.x,y:root.y+relative.y-3.2*Math.sin(Math.PI*q)};planted[side]=false;contactIds[side]=null;footSurfaceIds[side]=null;}}
 const initialSide=anchors?(['far','near'].find(side=>anchors.planted?.[side])||null):'far',releaseTime=initialSide?leave[initialSide]:0;
 const support=planted.near&&planted.far?'both':planted.near?'near':planted.far?'far':'none',flightU=clamp((t-releaseTime)/(land.near-releaseTime)),flightHeight=support==='none'?12*flightU*(1-flightU):0;
 const fromHipHeight=Number.isFinite(anchors?.bodyOffsetY)?-anchors.bodyOffsetY:fromSlope?config.stairHipHeight:config.hipHeight,toHipHeight=toSlope?config.stairHipHeight:config.hipHeight;
 const baseHipHeight=lerp(fromHipHeight,toHipHeight,smooth(u));
 const matrix={...layout.m0,y:layout.m0.y+(cameraFloor-edge.floor)*layout.stageHeight,k:layout.k,blend:cameraFloor-edge.floor};
 const hipAt=q=>lerp(fromHipHeight,toHipHeight,smooth(q));
 const orientationAt=t=>{if(edge.id!=='upper-entry')return{face,turn:null};const progress=clamp(forward?t/.18:(t-D+.18)/.18);return{face:progress<.5?1:-1,turn:progress<1?{progress,fromFace:1,toFace:-1,frontWeight:smooth(Math.sin(Math.PI*progress))}:null};};
 const flightBounds=support==='none'?{from:{...orientationAt(releaseTime),side:initialSide||'far',foot:anchors?.feet?.[initialSide||'far']||contact(a,initialSide||'far',fromSlope,fromFace),root:mix(a,b,releaseTime/D),hipHeight:hipAt(releaseTime/D),...(!initialSide&&Number.isFinite(anchors?.bodyOffsetY)?{comY:a.y+anchors.bodyOffsetY}:{})},to:{...orientationAt(land.near),side:'near',foot:contact(b,'near',toSlope,toFace),root:mix(a,b,land.near/D),hipHeight:hipAt(land.near/D)},u:flightU,duration:land.near-releaseTime}:null;
 const yawPlan=edge.id==='upper-entry'?{fromFace:1,toFace:-1,progress:clamp(forward?t/.18:(t-D+.18)/.18),duration:.18}:null;
 return{timing:{leave,land,releaseTime},root,feet,support,contactIds,footSurfaceIds,baseHipHeight,u:flightU,flightU,flightBounds,flightHeight,cadence:u,moving:moving&&u>0&&u<1,speed:350*layout.sx,authoritativeRoot:mix(from,to,u),stairs:true,time,local:t,remaining:D-t,arrived:u>=1,kind,face,load,intendedLoad:load,reach:0,progress:edge.progress,matrix,
  yawPlan,terrainSlope:lerp(fromSlope,toSlope,smooth(u)),plinth:{...edge,fromSurface,toSurface,localProgress:u,entryBodyAngle:anchors?.bodyAngle},segment:{type:'step',at:root,duration:D},sourceFeet:Object.fromEntries(Object.entries(feet).map(([key,p])=>[key,{x:(p.x-matrix.x)/matrix.k,y:(p.y-matrix.y)/matrix.k}]))};
}

export function plinthRestAt(actor,revision=2){
 for(let floor=0;floor<=4;floor++)for(const [x,y,surface]of[[1010,530,'plinth'],[930,590,'ground'],...(floor>0?[[1110,600,'landing'],[1020,545,'plinth'],[revision===3?920:960,600,'ground']]:[])])if(Math.hypot(actor.x-x,actor.y-(y-700*floor))<1e-6)return{floor,point:{x,y:y-700*floor},surface};return null;
}
export function samplePlinthRest(rest,{layout,config,kind='pip',cameraFloor=0,time=0,load=null,face=1}={}){
 const root={x:rest.point.x*layout.sx,y:layout.top+(rest.point.y+cameraFloor*700)*layout.sy},slope=slopeFor(rest.surface),feet={};
 for(const side of['near','far']){const off=config.contacts?.[side]||{x:side==='near'?-2.8:2.8,y:side==='near'?.65:-.65};feet[side]={x:root.x+off.x*face,y:root.y+off.x*face*slope+off.y};}
 return{root,feet,face,time,kind,load,intendedLoad:load,reach:0,stairs:true,moving:false,support:'both',contactIds:{near:'rest-near',far:'rest-far'},footSurfaceIds:{near:rest.surface,far:rest.surface},baseHipHeight:slope?config.stairHipHeight:config.hipHeight,terrainSlope:slope,u:0,cadence:0,flightHeight:0,flightBounds:null,remaining:0,arrived:true,authoritativeRoot:{...rest.point},segment:{type:'landing-rest',at:root,duration:0},plinth:{...rest,id:'landing-rest'},matrix:{...layout.m0,y:layout.m0.y+(cameraFloor-rest.floor)*layout.stageHeight,k:layout.k}};
}
