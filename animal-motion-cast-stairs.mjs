/** Measured cast stair solver candidate. No species is enabled by this module.
 * Parent must opt in only after numerical and native-motion inspection. */
import {clamp,smooth} from './animal-motion-pose.mjs';
import {castPose} from './animal-motion-cast.mjs';
const scalePoint=(p,f)=>({x:p.x*f,y:p.y*f,...(Number.isFinite(p.z)?{z:p.z*f}:{})});
const mapPose=(pose,f,config)=>{const limb=l=>Object.fromEntries(Object.entries(l).map(([k,v])=>[k,v&&typeof v==='object'&&Number.isFinite(v.x)&&Number.isFinite(v.y)?scalePoint(v,f):['upper','lower','reachError'].includes(k)?v*f:v]));const root=scalePoint(pose.root,f);return{...pose,root,config,hipHeight:pose.hipHeight*f,legs:Object.fromEntries(Object.entries(pose.legs).map(([k,v])=>[k,limb(v)])),arms:Object.fromEntries(Object.entries(pose.arms).map(([k,v])=>[k,limb(v)])),sockets:Object.fromEntries(Object.entries(pose.sockets).map(([k,v])=>[k,scalePoint(v,f)])),props:pose.props.map(p=>({...p,grip:scalePoint(p.grip,f),...(p.tip?{tip:scalePoint(p.tip,f)}:{})})),world:p=>({x:root.x+p.x*pose.face,y:root.y+p.y})};};
export function configureCastStairs(base,factor,{routeRevision=2,kind}={}){
  const config={...base,scale:base.scale*factor,hipHeight:base.hipHeight*factor,stairHipHeight:base.stairHipHeight*factor,legReach:base.legReach*factor,targetHeight:(base.origin[1]*base.scale+base.hipHeight)*factor,factor,canonicalConfig:base};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail','nearAnkle','farAnkle','mouth'])if(base[key])config[key]=scalePoint(base[key],factor);
  config.frontSockets=Object.fromEntries(Object.entries(base.frontSockets||{}).map(([k,v])=>[k,scalePoint(v,factor)]));
  // Narrow only the two broad species' stair stance, using each own measured
  // sole offset. Flat stance/bones stay exact; neighboring plinths use the same
  // narrower contacts so the sole never teleports at a terrain boundary.
  config.contacts=Object.fromEntries(Object.entries(base.contacts).map(([k,v])=>[k,scalePoint({...v,x:v.x*(base.stairContactFactors?.[k]??1)},factor)]));
  config.lengths=Object.fromEntries(Object.entries(base.lengths).map(([side,lengths])=>[side,Object.fromEntries(Object.entries(lengths).map(([k,v])=>[k,v*factor]))]));
  // Only the longer revision3 exit delays the broad cast landing contact.
  // Existing route2 anatomy, timing and primary-species defaults remain exact.
  if(routeRevision===3&&['bear-parent','owl'].includes(kind))config.plinthLeadFraction={...config.plinthLeadFraction,'upper-exit':.05};
  if(routeRevision===3&&kind==='bear-parent')config.plinthTrailReleaseFraction={...config.plinthTrailReleaseFraction,'upper-exit':.10};
  return config;
}
export function solveCastStairs(native,config){
  const factor=config.factor,planned=native.yawPlan,turn=native.turn||(planned&&planned.progress<1?{...planned,frontWeight:smooth(Math.sin(Math.PI*planned.progress))}:null),face=turn?(turn.progress<.5?turn.fromFace:turn.toFace):planned?planned.toFace:native.face,state={...native,turn,face,root:scalePoint(native.root,1/factor),feet:Object.fromEntries(Object.entries(native.feet).map(([k,v])=>[k,scalePoint(v,1/factor)])),flightHeight:native.flightHeight/factor,
    load:['cat','bear-parent'].includes(native.kind)?'suitcase':native.load,working:false,familyCarryProgress:native.kind==='bear-parent'?1:0,familyAssist:0};
  if(native.plinth&&Number.isFinite(native.baseHipHeight))state.bodyRootY=state.root.y-native.baseHipHeight/factor;
  const bounds=native.flightBounds||native.supportBounds;
  if(bounds){
    // Endpoint anatomy comes from the shared progress sampler, including both
    // actual soles and yaw. Bridge only pelvis height; never move planted soles
    // or alter a measured bone to hide reach errors.
    const endpoint=b=>{
      const endpointFace=b.face??state.face,root=scalePoint(b.root,1/factor),feet=b.feet?Object.fromEntries(Object.entries(b.feet).map(([side,p])=>[side,scalePoint(p,1/factor)])):Object.fromEntries(Object.entries(config.canonicalConfig.contacts).map(([side,p])=>[side,{x:root.x+p.x*endpointFace,y:root.y+p.y}]));
      if(b.side&&b.foot)feet[b.side]=scalePoint(b.foot,1/factor);
      const at={...state,...b,root,feet,face:endpointFace,turn:b.turn??null,support:b.support??b.side,u:b.u??0,cadence:b.cadence??0,flightHeight:0,bodyRootY:Number.isFinite(b.hipHeight)?root.y-b.hipHeight/factor:undefined,load:null,intendedLoad:null};
      const p=castPose(at,config.canonicalConfig);return{y:Number.isFinite(b.comY)?b.comY/factor:p.root.y,angle:p.bodyAngle*endpointFace};};
    const a=endpoint(bounds.from),b=endpoint(bounds.to);state.bodyRootY=a.y+(b.y-a.y)*bounds.u-state.flightHeight;
    state.bodyAngle=(a.angle+(b.angle-a.angle)*bounds.u)/state.face;
  }
  return mapPose(castPose(state,config.canonicalConfig),factor,config);
}
export const CANDIDATE_CAST_STAIR_DEFINITION=Object.freeze({configureNative:configureCastStairs,solvePose:solveCastStairs,load:actor=>['cat','family'].includes(actor.spriteKind)?'suitcase':['wrench','broom'].includes(actor.carrying)?actor.carrying:actor.carrying==='meal'?'meal':['linen','dirty-linen'].includes(actor.carrying)?'towel':null});
export const CAST_STAIR_DEFINITIONS=Object.freeze({});
