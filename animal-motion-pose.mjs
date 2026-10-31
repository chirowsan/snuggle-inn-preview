// Connected painted-part kinematics adapted from the isolated Pip/rabbit proof.
// No scripted timelines, engine writes, or simulation clocks. Units are isotropic rig space.
export const TAU = Math.PI * 2;
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const CONTACT_OFFSET = { near: { x: -2.8, y: .65 }, far: { x: 2.8, y: -.65 } };
const contact = (p, leg,face=1) => ({ x: p.x + CONTACT_OFFSET[leg].x*face, y: p.y + CONTACT_OFFSET[leg].y });
export function pivotFeet(at,u,fromFace,toFace){
  let swing,support,phase,stage;
  if(u<.5){swing='far';support='near';phase=u/.5;stage=0;}
  else if(u<.82){swing='near';support='far';phase=(u-.5)/.32;stage=1;}
  else{swing='far';support='near';phase=(u-.82)/.18;stage=2;}
  const feet={};
  for(const leg of ['near','far']){
    const startFace=stage===2&&leg==='near'?toFace:fromFace;
    const endFace=stage===0?fromFace:toFace;
    const q=leg===swing?smooth(phase):stage===2?1:0;
    feet[leg]=mix(contact(at,leg,startFace),contact(at,leg,endFace),q);
    if(leg===swing)feet[leg].y-=Math.sin(Math.PI*phase)*(stage===0?1.2:2.4);
  }
  return {feet,swing,support,stage};
}

// Full two-link solve. Segments never disconnect or silently stretch.
export function solveTwoBone(root, end, upper, lower, bend = 1) {
  const dx = end.x-root.x, dy=end.y-root.y, requestedDistance=Math.hypot(dx,dy);
  const distance = clamp(requestedDistance, Math.abs(upper-lower)+.001, upper+lower-.001);
  const angle=Math.atan2(dy,dx), along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const across=Math.sqrt(Math.max(0,upper*upper-along*along));
  const ux=Math.cos(angle), uy=Math.sin(angle);
  const joint={x:root.x+ux*along+uy*across*bend,y:root.y+uy*along-ux*across*bend};
  // During a front-facing pivot the knee/elbow bend plane rotates into depth.
  // Its projected segment can shorten, but its true 3D bone length is constant.
  joint.z=across*Math.sqrt(Math.max(0,1-bend*bend));
  const reached={x:root.x+ux*distance,y:root.y+uy*distance};
  return {root,joint,end:reached,requested:end,reachError:Math.abs(requestedDistance-distance),upper,lower};
}

export const DEFAULT_RIG={
  hipHeight:18,stairHipHeight:15.6,nearHip:{x:-2.4,y:0},farHip:{x:2.4,y:-.8},
  nearShoulder:{x:-5.4,y:-20.4},farShoulder:{x:8.3,y:-21.6},
  thighLength:10.8,shinLength:10.3,ankleHeight:3.2,upperArmLength:7.8,forearmLength:8.3
};
export function configFromManifest(manifest,scale=.217) {
  const p=manifest.parts,b=p.body,s=b.sockets;
  const origin=[(s.near_hip[0]+s.far_hip[0])/2,(s.near_hip[1]+s.far_hip[1])/2];
  const socket=key=>({x:(s[key][0]-origin[0])*scale,y:(s[key][1]-origin[1])*scale});
  const ankle=side=>({x:(p[`${side}_shoe`].proximal[0]-p[`${side}_shoe`].sole_anchor[0])*scale,
    y:(p[`${side}_shoe`].proximal[1]-p[`${side}_shoe`].sole_anchor[1])*scale});
  return {...DEFAULT_RIG,scale,origin,hipHeight:14.8,stairHipHeight:13.8,
    nearHip:socket('near_hip'),farHip:socket('far_hip'),nearShoulder:socket('near_shoulder'),farShoulder:socket('far_shoulder'),
    tail:socket('tail'),thighLength:42*scale,shinLength:32*scale,upperArmLength:38*scale,forearmLength:34*scale,
    nearAnkle:ankle('near'),farAnkle:ankle('far')};
}
export function addCoreVariants(config,variants) {
  const front=variants.variants.front,s=front.sockets;
  const origin=[(s.near_hip[0]+s.far_hip[0])/2,(s.near_hip[1]+s.far_hip[1])/2];
  const keyMap={nearHip:'near_hip',farHip:'far_hip',nearShoulder:'near_shoulder',farShoulder:'far_shoulder',tail:'tail'};
  return {...config,frontOrigin:origin,frontSockets:Object.fromEntries(Object.entries(keyMap).map(([key,name])=>[key,{x:(s[name][0]-origin[0])*config.scale,y:(s[name][1]-origin[1])*config.scale}]))};
}
export function rigPose(state,config=DEFAULT_RIG) {
  const {face}=state;
  const shoeProjection=state.turn?(state.plinth?Math.abs(Math.cos(Math.PI*state.turn.progress)):.25+.75*Math.abs(Math.cos(Math.PI*state.turn.progress))):1;
  const ankleOffset=leg=>{const p=config[`${leg}Ankle`]||{x:0,y:-config.ankleHeight};return{x:p.x*shoeProjection,y:p.y};};
  // The torso inclines with weight transfer; all anatomical sockets transform
  // with it. This is not a picture-wide rock: feet stay fixed and limbs re-solve.
  const bodyAngle=(state.moving?.018+Math.sin(state.cadence*Math.PI)*.012:Math.sin(state.time*TAU*.32)*.003)+state.reach*.06;
  const rotate=p=>({x:p.x*Math.cos(bodyAngle)-p.y*Math.sin(bodyAngle),y:p.x*Math.sin(bodyAngle)+p.y*Math.cos(bodyAngle)});
  const sockets={};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail']){
    let p=config[key]||{x:-5,y:-2};
    if(state.turn){
      const yaw=Math.cos(Math.PI*state.turn.progress),front=Math.sin(Math.PI*state.turn.progress);
      const fallback=key.includes('Shoulder')?{x:p.x,y:(config.nearShoulder.y+config.farShoulder.y)/2}:key.includes('Hip')?{x:p.x,y:0}:{x:0,y:p.y};
      const forward=config.frontSockets?.[key]||fallback;
      p={x:lerp(p.x*yaw,forward.x,front)*state.turn.fromFace/face,y:lerp(p.y,forward.y,front)};
    }
    sockets[key]=rotate(p);
  }
  const hipHeight=state.stairs?config.stairHipHeight:config.hipHeight;
  const breath=state.moving?0:Math.sin(state.time*TAU*.32)*.16;
  const compression=state.moving?Math.sin(state.u*Math.PI)*.35:0;
  const root={x:state.root.x+face*state.reach*2.8,y:state.root.y-hipHeight+compression+breath};
  // Solve COM height from the planted limb's reachable interval. Foot contacts remain
  // scene-space constants; the torso accommodates a high/low stair, never vice versa.
  const maxLength=config.thighLength+config.shinLength-.12;
  const minLength=Math.abs(config.thighLength-config.shinLength)+.2;
  let minY=-Infinity,maxY=Infinity,bothMin=-Infinity,bothMax=Infinity;
  for(const leg of ['near','far']) {
    const hip=sockets[`${leg}Hip`],offset=ankleOffset(leg);
    const dx=(state.feet[leg].x-root.x)*face+offset.x-hip.x;
    const ankleY=state.feet[leg].y+offset.y;
    const low=ankleY-hip.y-Math.sqrt(Math.max(.01,maxLength**2-dx**2));
    const high=ankleY-hip.y-Math.sqrt(Math.max(0,minLength**2-dx**2));
    bothMin=Math.max(bothMin,low);bothMax=Math.min(bothMax,high);
    if(state.support!==leg&&state.support!=='both')continue;
    minY=Math.max(minY,low);maxY=Math.min(maxY,high);
  }
  root.y=clamp(root.y,minY,maxY);
  if(state.moving&&bothMin<=bothMax){
    const contactBlend=smooth((Math.abs(state.u-.5)-.3)/.2);
    root.y=lerp(root.y,clamp(root.y,bothMin,bothMax),contactBlend);
  }
  const local=p=>({x:(p.x-root.x)*face,y:p.y-root.y});
  const legs={};
  for(const leg of ['near','far']) {
    let foot=local(state.feet[leg]);
    const offset=ankleOffset(leg);
    let ankle={x:foot.x+offset.x,y:foot.y+offset.y};
    const hip=sockets[`${leg}Hip`];
    const planted=state.support===leg||state.support==='both';
    // During the airborne pass, tuck the ankle slightly forward of the pelvis.
    // Unequal anatomical bone lengths cannot fold to a zero-length hip/ankle vector.
    if(!planted){
      let dx=ankle.x-hip.x,dy=ankle.y-hip.y,d=Math.hypot(dx,dy);
      const passRadius=minLength+.7*(state.moving?Math.sin(Math.PI*state.u):0);
      if(d<passRadius){ankle.x=hip.x+Math.sqrt(Math.max(0,passRadius**2-dy**2));}
      dx=ankle.x-hip.x;dy=ankle.y-hip.y;d=Math.hypot(dx,dy);
      if(d>maxLength){ankle={x:hip.x+dx/d*maxLength,y:hip.y+dy/d*maxLength};}
      foot={x:ankle.x-offset.x,y:ankle.y-offset.y};
    }
    const bendProjection=state.turn?Math.abs(Math.cos(Math.PI*state.turn.progress)):1;
    const bones=solveTwoBone(hip,ankle,config.thighLength,config.shinLength,bendProjection);
    legs[leg]={...bones,sole:foot,ankle,planted};
  }
  const arms={};
  for(const arm of ['near','far']) {
    const shoulder=sockets[`${arm}Shoulder`];
    const side=arm==='near'?1:-1;
    let paw;
    // Arm phase comes from the opposite leg, not a disconnected clock.
    const opposite=legs[arm==='near'?'far':'near'];
    const swing=clamp(opposite.sole.x*.65,-7,7);
    if(arm==='near'&&(state.load||state.intendedLoad)) {
      const forward=lerp(4.6,7.1,state.reach),height=lerp(-5.2,-9.1,state.reach);
      paw={x:forward,y:height};
      if(state.turn){
        const progress=state.turn.progress;
        const worldPaw={x:state.segment.at.x+state.turn.fromFace*4.6*Math.cos(Math.PI*progress),
          y:state.segment.at.y-hipHeight-5.2-Math.sin(Math.PI*progress)*3};
        paw=local(worldPaw);
      }
    }else{
      const restSwing=(1+Math.sin(state.time*1.5+side)*.3)*(state.turn?state.turn.fromFace*Math.cos(Math.PI*state.turn.progress)/face:1);
      paw={x:shoulder.x+(state.moving?swing:restSwing),
        y:shoulder.y+(config.upperArmLength+config.forearmLength)*.94-Math.abs(state.moving?swing:0)*.2};
    }
    const bendProjection=state.turn?Math.abs(Math.cos(Math.PI*state.turn.progress)):1;
    arms[arm]={...solveTwoBone(shoulder,paw,config.upperArmLength,config.forearmLength,-bendProjection),paw};
    // Render/attach to the actual solved paw, including the tiny reach limit.
    arms[arm].paw=arms[arm].end;
  }
  return {root,legs,arms,face,hipHeight,sockets,bodyAngle,shoeProjection,frontWeight:state.turn?.frontWeight||0,
    tailForeshorten:state.turn?Math.max(.12,Math.abs(Math.cos(Math.PI*state.turn.progress))):1,
    tailAngle:(state.moving?Math.sin(state.cadence*Math.PI)*.075:Math.sin(state.time*1.65)*.035),
    world:p=>({x:root.x+p.x*face,y:root.y+p.y}),config};
}

export function rabbitConfig(manifest,scale=.217){
  const c=configFromManifest(manifest,scale),parts=manifest.parts;
  const avg=(a,b)=>(parts[a].reference_length+parts[b].reference_length)/2*scale;
  return {...c,hipHeight:12.9,stairHipHeight:11.5,thighLength:avg('near_thigh','far_thigh'),shinLength:avg('near_shin','far_shin'),
    upperArmLength:avg('near_upper_arm','far_upper_arm'),forearmLength:avg('near_forearm','far_forearm'),
    bagDrop:(parts.suitcase.lower_edge[1]-parts.suitcase.handle_grip[1])*scale};
}


export function pipPose(state,config){
  if(state.gait!=='run'||(!state.moving&&state.flightHeight===0))return rigPose(state,config);
  const ratio=clamp(state.velocity/state.nominalSpeed),lean=(state.targetPhoneSpeed===200?.115:.075)*ratio;
  const rotate=p=>({x:p.x*Math.cos(lean)-p.y*Math.sin(lean),y:p.x*Math.sin(lean)+p.y*Math.cos(lean)});
  const modified={...config,hipHeight:config.hipHeight+state.flightHeight};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail'])modified[key]=rotate(config[key]);
  const pose=rigPose(state,modified);pose.bodyAngle+=lean;
  for(const arm of ['near','far']){
    if(arm==='near'&&(state.load||state.intendedLoad))continue;
    const shoulder=pose.sockets[`${arm}Shoulder`],opposite=pose.legs[arm==='near'?'far':'near'];
    const paw={x:shoulder.x+lerp(1,clamp(opposite.sole.x*.9,-9,9),ratio),y:shoulder.y+lerp(14.6,8.4,ratio)};
    pose.arms[arm]={...solveTwoBone(shoulder,paw,config.upperArmLength,config.forearmLength,-1),paw};pose.arms[arm].paw=pose.arms[arm].end;
  }
  return pose;
}

export function rabbitPose(state,config){
  const ratio=clamp((state.velocity||0)/(state.nominalSpeed||1)),running=state.targetPhoneSpeed>40&&state.moving;
  const lean=running?(state.targetPhoneSpeed===200?.095:.065)*ratio:0;
  const rotate=p=>({x:p.x*Math.cos(lean)-p.y*Math.sin(lean),y:p.x*Math.sin(lean)+p.y*Math.cos(lean)});
  const modified={...config,hipHeight:config.hipHeight+(state.flightHeight||0)};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail'])modified[key]=rotate(config[key]);
  const pose=rigPose({...state,load:null,intendedLoad:null},modified);pose.bodyAngle+=lean;
  if(running){
    const shoulder=pose.sockets.farShoulder,opposite=pose.legs.near;
    const total=config.upperArmLength+config.forearmLength;
    const paw={x:shoulder.x+lerp(1,clamp(opposite.sole.x*.9,-7.5,7.5),ratio),y:shoulder.y+lerp(total*.94,total*.52,ratio)};
    pose.arms.far={...solveTwoBone(shoulder,paw,config.upperArmLength,config.forearmLength,-1),paw};pose.arms.far.paw=pose.arms.far.end;
  }
  let paw={x:-9.2,y:Math.min(-3.5,state.root.y-pose.root.y-config.bagDrop-3)};
  if(state.turn){
    const u=state.turn.progress;
    const yaw=Math.cos(Math.PI*u),front=Math.sin(Math.PI*u);
    const shoulderX=state.root.x+state.turn.fromFace*lerp(config.nearShoulder.x*yaw,config.frontSockets.nearShoulder.x,front);
    const worldPaw={x:shoulderX-state.turn.fromFace*.7*yaw,
      y:state.segment.at.y-config.bagDrop-3.5-Math.sin(Math.PI*u)*2};
    paw={x:(worldPaw.x-pose.root.x)*pose.face,y:worldPaw.y-pose.root.y};
  }
  const bend=state.turn?Math.abs(Math.cos(Math.PI*state.turn.progress)):1;
  pose.arms.near={...solveTwoBone(pose.sockets.nearShoulder,paw,config.upperArmLength,config.forearmLength,-bend),paw};
  pose.arms.near.paw=pose.arms.near.end;
  return pose;
}
