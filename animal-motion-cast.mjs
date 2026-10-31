import {createPaintedRigPainter} from './animal-motion-painter.mjs';
/** Additional hotel cast. Every bone, socket and sole is measured from its own
 * authored part manifest. This file does not change simulation time or routes. */
import {clamp,lerp,smooth,solveTwoBone,TAU} from './animal-motion-pose.mjs';
const SIDES=['near','far'];
const point=a=>({x:a[0],y:a[1]});
const mix=(a,b,q)=>({x:lerp(a.x,b.x,q),y:lerp(a.y,b.y,q)});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function measuredCastConfig(manifest,scale=.217){
  const p=manifest.parts,s=p.body.sockets,origin=[(s.near_hip[0]+s.far_hip[0])/2,(s.near_hip[1]+s.far_hip[1])/2];
  const socket=key=>({x:(s[key][0]-origin[0])*scale,y:(s[key][1]-origin[1])*scale});
  const length=name=>distance(point(p[name].proximal),point(p[name].distal))*scale;
  const lengths=Object.fromEntries(SIDES.map(side=>[side,{thigh:length(`${side}_thigh`),shin:length(`${side}_shin`),upper:length(`${side}_upper_arm`),fore:length(`${side}_forearm`)}]));
  const ankle=side=>({x:(p[`${side}_shoe`].proximal[0]-p[`${side}_shoe`].sole_anchor[0])*scale,y:(p[`${side}_shoe`].proximal[1]-p[`${side}_shoe`].sole_anchor[1])*scale});
  const c={manifest,scale,origin,lengths,nearHip:socket('near_hip'),farHip:socket('far_hip'),nearShoulder:socket('near_shoulder'),farShoulder:socket('far_shoulder'),tail:socket('tail'),nearAnkle:ankle('near'),farAnkle:ankle('far')};
  c.hipHeight=Math.min(...SIDES.map(side=>((lengths[side].thigh+lengths[side].shin)*.91-c[`${side}Ankle`].y-c[`${side}Hip`].y)));
  c.stairHipHeight=c.hipHeight;
  c.legReach=Math.min(...SIDES.map(side=>lengths[side].thigh+lengths[side].shin));
  // Rest sole is under its own hip, accounting for that shoe's painted ankle.
  c.contacts=Object.fromEntries(SIDES.map(side=>[side,{x:c[`${side}Hip`].x-c[`${side}Ankle`].x,y:side==='near'?.55:-.55}]));
  for(const name of ['suitcase','saucepan','spoon','clipboard','pencil','guitar','microphone','wrench','broom'])if(p[name])c[name]=p[name];
  if(s.mouth)c.mouth=socket('mouth');
  return c;
}
// A descending flight starts in the opposite horizontal direction from its
// upper-landing approach. Finish the visual pivot on that real landing, without
// moving or pausing the authoritative actor. Only this measured cast opts in.
export function castLandingFacing(actor,fallback){
  const path=[actor,...(actor.path||[])];let distanceTo=0;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y;
    if(Math.abs(Math.abs(dx)-100)<.15&&Math.abs(Math.abs(dy)-630)<.15)return distanceTo<=130?Math.sign(dx):fallback;
    distanceTo+=distance(a,b);if(distanceTo>130)break;
  }return fallback;
}
export const castRestContact=(root,side,face=1,config)=>({x:root.x+config.contacts[side].x*face,y:root.y+config.contacts[side].y});

/** Foot contact history is in renderer scene space. A stance anchor never slides;
 * only a lifted foot follows the root. Authoritative actor movement is untouched. */
export class CastContactPlanner {
  constructor(config){this.config=config;this.serial=0;this.last=null;this.legs=null;this.settle=null;}
  reset(root,time,face){this.last={root:{...root},time,face};this.feet=Object.fromEntries(SIDES.map(side=>[side,castRestContact(root,side,face,this.config)]));this.legs=null;this.settle=null;}
  resumeFromContacts(root,time,face,feet){this.reset(root,time,face);this.feet=structuredClone(feet);}
  releaseContact(side,time){const leg=this.legs?.[side];if(leg?.mode==='stance')leg.end=Math.min(leg.end,time);}
  parameters(speed){const reach=this.config.legReach,step=clamp(reach*2/Math.max(1,speed),reach<8?.12:.16,.34);return {step,stance:Math.min(step*.72,reach*.55/Math.max(1,speed)),lift:reach*.21};}
  sample({root,time,moving,face=1,speed=0,predict=()=>root,displayedFeet=null}){
    if(!this.last||time<this.last.time||time-this.last.time>.25||distance(root,this.last.root)>Math.max(100,speed*.3))this.reset(root,time,face);
    const previous=this.last,dt=time-previous.time,p=this.parameters(speed),rest=(r,s)=>castRestContact(r,s,face,this.config);
    const at=t=>t<time?mix(previous.root,root,dt?clamp((t-previous.time)/dt):1):predict(t-time);
    const startSwing=(side,leg,t,initial=false)=>{const start=at(t),end=t+(initial?p.step:2*p.step-p.stance),rootEnd=at(end),mid=at(end+p.stance/2);Object.assign(leg,{mode:'swing',start:t,end,from:sub(leg.anchor,start),to:sub(rest(mid,side),rootEnd)});};
    const swing=(leg,t,r)=>{const q=clamp((t-leg.start)/(leg.end-leg.start)),v=add(r,mix(leg.from,leg.to,smooth(q)));v.y-=Math.sin(Math.PI*q)*p.lift;return v;};
    let support='both',contactIds={near:null,far:null},u=0;
    if(moving){
      this.settle=null;
      if(!this.legs){this.legs=Object.fromEntries(SIDES.map(side=>[side,{mode:'stance',anchor:{...this.feet[side]},start:time,end:time+p.stance/2,serial:++this.serial}]));startSwing('far',this.legs.far,time,true);}
      for(const side of SIDES){const leg=this.legs[side];let guard=0;
        while(time>=leg.end&&++guard<12){const t=leg.end;if(leg.mode==='stance')startSwing(side,leg,t);else{leg.anchor=swing(leg,t,at(t));leg.mode='stance';leg.start=t;leg.end=t+p.stance;leg.serial=++this.serial;}}
        if(leg.mode==='stance'&&Math.abs(leg.anchor.x-rest(root,side).x)>this.config.legReach*.63)startSwing(side,leg,time);
        this.feet[side]=leg.mode==='stance'?{...leg.anchor}:swing(leg,time,root);contactIds[side]=leg.mode==='stance'?`${side}:${leg.serial}`:null;
      }
      support=contactIds.near&&contactIds.far?'both':contactIds.near?'near':contactIds.far?'far':'none';
      const leg=this.legs.near;u=clamp((time-leg.start)/(leg.end-leg.start));
    }else{
      if(this.legs){if(displayedFeet)this.feet=structuredClone(displayedFeet);const first=distance(this.feet.near,rest(root,'near'))>=distance(this.feet.far,rest(root,'far'))?'near':'far';this.settle={start:time,feet:structuredClone(this.feet),first};this.legs=null;}
      if(this.settle){const q=clamp((time-this.settle.start)/.24),side=q<.5?this.settle.first:this.settle.first==='near'?'far':'near',phase=q<.5?q*2:(q-.5)*2;
        for(const s of SIDES){this.feet[s]=mix(this.settle.feet[s],rest(root,s),s===side?smooth(phase):q<.5?0:1);if(s===side&&q<1)this.feet[s].y-=Math.sin(Math.PI*phase)*1.2;}
        support=q===1?'both':side==='near'?'far':'near';if(support!=='both'&&Math.abs(this.feet[support].x-rest(root,support).x)>this.config.legReach*.55)support='none';if(q===1)this.settle=null;
      }else this.feet=Object.fromEntries(SIDES.map(side=>[side,rest(root,side)]));
      for(const side of SIDES)if(support===side||support==='both')contactIds[side]=`rest:${side}`;
    }
    this.last={root:{...root},time,face};
    return {root:{...root},feet:structuredClone(this.feet),support,contactIds,moving,face,time,u,cadence:time/p.step,velocity:moving?speed:0,nominalSpeed:Math.max(speed,1),targetPhoneSpeed:speed<75?40:120,gait:speed<75?'walk':'run',flightHeight:0,stairs:false};
  }
}

/** Cast pivot: measured feet alternate, so the body never rotates over two
 * magically swapped sole anchors. The front core is supplied by the artist. */
export function castTurnState(cache,state,wantedFace,config){
  cache.facing??=wantedFace;
  if(cache.turn&&cache.turn.toFace!==wantedFace){const q=clamp((state.time-cache.turn.start)/cache.turn.duration);cache.turn={fromFace:cache.turn.toFace,toFace:cache.turn.fromFace,start:state.time-(1-q)*cache.turn.duration,duration:cache.turn.duration};}
  if(!cache.turn&&cache.facing!==wantedFace)cache.turn={fromFace:cache.facing,toFace:wantedFace,start:state.time,duration:state.moving?.23:.38,at:{...state.root}};
  if(cache.turn&&state.moving&&cache.turn.duration>.23){const q=clamp((state.time-cache.turn.start)/cache.turn.duration);cache.turn.duration=.23;cache.turn.start=state.time-q*.23;}
  if(cache.turn){const t=cache.turn,q=clamp((state.time-t.start)/t.duration);if(q===1){cache.facing=t.toFace;cache.turn=null;state.face=cache.facing;}else{
    state.face=q<.5?t.fromFace:t.toFace;state.turn={...t,progress:q,frontWeight:state.plinth?smooth(Math.sin(Math.PI*q)):Math.sin(Math.PI*q)};
    if(!state.moving){const first=q<.5,swing=first?'far':'near',phase=first?q*2:(q-.5)*2;state.support=first?'near':'far';state.contactIds={near:null,far:null};state.contactIds[state.support]=`pivot:${t.start}:${state.support}`;
      for(const side of SIDES){const a=castRestContact(state.root,side,t.fromFace,config),b=castRestContact(state.root,side,t.toFace,config);const v=side===swing?smooth(phase):first?0:1;state.feet[side]=mix(a,b,v);if(side===swing)state.feet[side].y-=Math.sin(Math.PI*phase)*2;}
    }
  }}else state.face=cache.facing;
  if(state.turn&&state.moving){
    const yaw=Math.cos(Math.PI*state.turn.progress),front=state.turn.frontWeight;
    for(const side of SIDES){if(!state.contactIds?.[side])continue;const hip=config[`${side}Hip`],forward=config.frontSockets?.[`${side}Hip`]||hip,worldHipX=state.root.x+lerp(hip.x*yaw,forward.x,front)*state.turn.fromFace,ankle=config[`${side}Ankle`],l=config.lengths[side];
      if(Math.abs(state.feet[side].x+ankle.x*state.face-worldHipX)>(l.thigh+l.shin)*.65){state.contactIds[side]=null;cache.planner?.releaseContact?.(side,state.time);}
    }
    state.support=state.contactIds.near&&state.contactIds.far?'both':state.contactIds.near?'near':state.contactIds.far?'far':'none';
  }
  return state;
}

export function castPose(state,config){
  const face=state.face,turn=state.turn,front=turn?.frontWeight||0;let bodyAngle=(state.moving?.025+Math.sin(state.cadence*Math.PI)*.013:Math.sin(state.time*1.8)*.006)+(state.reach||0)*.045+(state.familyAssist||0)*.055;if(turn)bodyAngle*=Math.cos(Math.PI*turn.progress)*turn.fromFace/face;if(Number.isFinite(state.bodyAngle))bodyAngle=state.bodyAngle;
  const sockets={};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail']){
    let p=config[key];
    if(turn){const f=config.frontSockets?.[key]||p,yaw=Math.cos(Math.PI*turn.progress);p={x:lerp(p.x*yaw,f.x,front)*turn.fromFace/face,y:lerp(p.y,f.y,front)};}
    sockets[key]=rotate(p,bodyAngle);
  }
  const root={x:state.root.x,y:state.root.y-config.hipHeight-(state.stairs?state.flightHeight||0:0)+(state.moving?Math.sin(state.u*Math.PI)*.28:Math.sin(state.time*1.8)*.12)+(state.familyAssist||0)*2.2};
  if(Number.isFinite(state.bodyRootY))root.y=state.bodyRootY;
  const shoeProjection=turn?(state.plinth?Math.abs(Math.cos(Math.PI*turn.progress)):.55+.45*Math.abs(Math.cos(Math.PI*turn.progress))):1;
  const ankleOffset=s=>({x:config[`${s}Ankle`].x*shoeProjection,y:config[`${s}Ankle`].y});
  // COM adapts to the union of reach intervals. Neither a planted sole nor any
  // individual bone length is adjusted to hide a bad reach.
  let lower=-Infinity,upper=Infinity,bothLower=-Infinity,bothUpper=Infinity;
  for(const side of SIDES){const hip=sockets[`${side}Hip`],offset=ankleOffset(side),l=config.lengths[side],dx=(state.feet[side].x-root.x)*face+offset.x-hip.x,max=l.thigh+l.shin-.02,min=Math.abs(l.thigh-l.shin)+.02;
    const low=state.feet[side].y+offset.y-hip.y-Math.sqrt(Math.max(.001,max*max-dx*dx)),high=state.feet[side].y+offset.y-hip.y-Math.sqrt(Math.max(0,min*min-dx*dx));
    bothLower=Math.max(bothLower,low);bothUpper=Math.min(bothUpper,high);
    if(state.support===side||state.support==='both'){lower=Math.max(lower,low);upper=Math.min(upper,high);}
  }
  root.y=clamp(root.y,lower,upper);
  // Airborne feet tuck inside their own reachable shells. Do not lower the
  // pelvis for an unplanted opposite foot, then snap it up at touchdown.
  const local=p=>({x:(p.x-root.x)*face,y:p.y-root.y});
  const legs={};
  for(const side of SIDES){const hip=sockets[`${side}Hip`],offset=ankleOffset(side),l=config.lengths[side],planted=state.support===side||state.support==='both';let sole=local(state.feet[side]),ankle=add(sole,offset);
    if(!planted){const delta=sub(ankle,hip),d=Math.hypot(delta.x,delta.y),max=l.thigh+l.shin-.02,min=Math.abs(l.thigh-l.shin)+.1;const r=clamp(d,min,max);if(d>1e-5&&r!==d){ankle=add(hip,{x:delta.x*r/d,y:delta.y*r/d});sole=sub(ankle,offset);}}
    legs[side]={...solveTwoBone(hip,ankle,l.thigh,l.shin,turn?Math.abs(Math.cos(Math.PI*turn.progress)):1),sole,ankle,planted};
  }
  const arms={},props=[],propDirection=Math.sign(sockets.farShoulder.x-sockets.nearShoulder.x)||1,performing=state.working&&!state.moving&&!state.turn;
  const solveArm=(side,paw)=>{const l=config.lengths[side],sh=sockets[`${side}Shoulder`],dx=paw.x-sh.x,dy=paw.y-sh.y,d=Math.hypot(dx,dy),min=Math.abs(l.upper-l.fore)+.05;if(d<min)paw={x:sh.x+(d>1e-8?dx/d:1)*min,y:sh.y+(d>1e-8?dy/d:0)*min};const result=solveTwoBone(sockets[`${side}Shoulder`],paw,l.upper,l.fore,-1);arms[side]={...result,paw:result.end};return result.end;};
  for(const side of SIDES){const shoulder=sockets[`${side}Shoulder`],l=config.lengths[side],other=legs[side==='near'?'far':'near'];const swing=state.moving?clamp((other.sole.x-config.contacts[side==='near'?'far':'near'].x)*.5,-l.upper*.68,l.upper*.68):Math.sin(state.time*1.5+(side==='far'?1:0))*.4;
    solveArm(side,{x:shoulder.x+swing,y:shoulder.y+(l.upper+l.fore)*.94-Math.abs(swing)*.18});}
  const prop=(name,side,target,angle=0,scaleX=1)=>{const paw=solveArm(side,target);props.push({name,side,grip:paw,angle,scaleX});return paw;};
  if(state.load==='suitcase'&&config.suitcase){const part=config.suitcase,grip=part.handle_grip,drop=(part.lower_edge?.[1]??part.size[1])-grip[1],shoulder=sockets.nearShoulder;
    prop('suitcase','near',{x:shoulder.x-(state.kind==='cat'?3.6:1.2),y:Math.min(shoulder.y+(config.lengths.near.upper+config.lengths.near.fore)*.8,state.root.y-root.y-drop*config.scale-(state.stairs?7:2))});}
  else if(state.load==='wrench'&&config.wrench){
    const sh=sockets.nearShoulder,work=state.working&&!state.moving,phase=state.time*7;
    prop('wrench','near',{x:sh.x-4.5+(work?Math.sin(phase)*2.2:0),y:sh.y+6+(work?Math.cos(phase)*2:0)},work?-.45+Math.sin(phase)*.18:-.45);props.at(-1).artScale=1.2;
  }else if(state.load==='broom'&&config.broom){
    const sh=sockets.nearShoulder,b=config.broom,work=state.working&&!state.moving,phase=state.time*4,angle=work?Math.sin(phase)*.10:0;
    const delta=rotate({x:(b.ground_contact[0]-b.handle_grip[0])*config.scale,y:(b.ground_contact[1]-b.handle_grip[1])*config.scale},angle);
    const tip={x:sh.x+2+(work?Math.sin(phase)*3.5:0),y:state.root.y-root.y-(work?0:state.stairs?9:1.2)};
    prop('broom','near',sub(tip,delta),angle);
    // The opposite paw counterbalances. Its measured short arm cannot reach
    // the lower secondary grip without stretching across this broad torso.
  }else if(state.load||state.intendedLoad){const shoulder=sockets.nearShoulder,l=config.lengths.near;
    prop(state.load||state.intendedLoad,'near',{x:shoulder.x+l.upper*.85+(state.reach||0)*1.3,y:shoulder.y+l.fore*.48-(state.reach||0)*1.5});}
  if(state.kind==='chef'&&config.saucepan){
    const sh=sockets.nearShoulder,panLift=performing?1+Math.sin(state.time*2.2):0,paw=prop('saucepan','near',{x:sh.x+(3+(performing?Math.sin(state.time*2.2)*.7:0))*propDirection,y:sh.y+config.lengths.near.upper*.95-panLift},0,propDirection);
    const p=config.saucepan,center=add(paw,{x:(p.bowl_center[0]-p.handle_grip[0])*config.scale*propDirection,y:(p.bowl_center[1]-p.handle_grip[1])*config.scale}),phase=performing?state.time*5:0;
    const spoon=config.spoon,tip={x:center.x+Math.cos(phase)*2.8,y:center.y+Math.sin(phase)*1.2},angle=(.10+Math.sin(phase)*.12)*propDirection;
    const sourceTip={x:(spoon.stirring_tip[0]-spoon.handle_grip[0])*config.scale*propDirection,y:(spoon.stirring_tip[1]-spoon.handle_grip[1])*config.scale};
    const grip=performing?sub(tip,rotate(sourceTip,angle)):{x:sockets.farShoulder.x+propDirection,y:sockets.farShoulder.y+config.lengths.far.fore},actual=prop('spoon','far',grip,angle,propDirection);props.at(-1).tip=add(actual,rotate(sourceTip,angle));
  }
  if(state.kind==='owl'&&config.clipboard){
    const shoulder=sockets.nearShoulder,paw=prop('clipboard','near',{x:shoulder.x+4*propDirection,y:shoulder.y+6},0,propDirection);const p=config.clipboard,center=p.writing_surface_center||p.distal;
    const target=add(paw,{x:(center[0]-p.handle_grip[0])*config.scale*propDirection,y:(center[1]-p.handle_grip[1])*config.scale});
    const pen=config.pencil,tip=pen.writing_tip||pen.distal,delta={x:(tip[0]-pen.handle_grip[0])*config.scale*propDirection,y:(tip[1]-pen.handle_grip[1])*config.scale},stroke=performing?Math.sin(state.time*7)*1.9:0;
    prop('pencil','far',performing?sub({x:target.x+stroke,y:target.y+Math.cos(state.time*7)*.65},delta):{x:sockets.farShoulder.x+propDirection,y:sockets.farShoulder.y+config.lengths.far.fore},0,propDirection);
  }
  if(state.kind==='hedgehog'&&config.guitar){
    const guitar=config.guitar,anchor={x:-4*propDirection,y:(sockets.nearShoulder.y+sockets.farShoulder.y)/2+6};
    const localPoint=p=>add(anchor,{x:(p[0]-guitar.body_anchor[0])*config.scale*propDirection,y:(p[1]-guitar.body_anchor[1])*config.scale});
    // Overlay readiness adjusts a paw on the strings without claiming a song.
    const q=performing?-.4+1.85*(Math.sin(state.time*9)+1)/2:state.action==='tuning'?.05+.9*(Math.sin(state.time*4.5)+1)/2:state.action==='preparing'?.45+Math.sin(state.time*1.9)*.28:.5;
    solveArm('far',localPoint(guitar.far_hand_grip));solveArm('near',localPoint([lerp(guitar.strum_start[0],guitar.strum_end[0],q),lerp(guitar.strum_start[1],guitar.strum_end[1],q)]));
    props.push({name:'guitar',grip:anchor,origin:guitar.body_anchor,angle:0,scaleX:propDirection});
  }
  if(state.kind==='deer'&&config.microphone){
    const microphone=config.microphone,mouth=rotate(config.mouth,bodyAngle),delta={x:(microphone.capsule_center[0]-microphone.handle_grip[0])*config.scale,y:(microphone.capsule_center[1]-microphone.handle_grip[1])*config.scale};
    const phrase=(Math.sin(state.time*2.2)+1)/2,angle=performing?.7+.1*(1-phrase):0,shoulder=sockets.nearShoulder,target=performing?sub({x:mouth.x+1.6,y:mouth.y+1.1+4*(1-phrase)},rotate(delta,angle)):{x:shoulder.x+3+(state.action==='preparing'?Math.sin(state.time*1.8)*.7:0),y:shoulder.y+8+(state.action==='preparing'?Math.cos(state.time*1.8)*.5:0)};
    prop('microphone','near',target,angle);const far=sockets.farShoulder,l=config.lengths.far,phase=performing?Math.sin(state.time*2.2):state.action==='preparing'?Math.sin(state.time*1.6)*.28:0;
    solveArm('far',{x:far.x+5+phase*2.5,y:far.y+(l.upper+l.fore)*(.6-.2*phase)});
  }
  if(state.kind==='bear-parent'&&state.familyCarryProgress>0){
    const q=smooth(clamp(state.familyCarryProgress/.45)),yaw=turn?Math.cos(Math.PI*turn.progress)*turn.fromFace/face:1,frontGrip=(config.frontSockets?.farShoulder.x||config.farShoulder.x)+1.8,target=rotate({x:2*yaw+(turn?frontGrip*turn.frontWeight*turn.fromFace/face:0),y:-18},bodyAngle),prior=arms.far.paw;
    solveArm('far',mix(prior,target,q));
  }
  if(state.action==='stealing')for(const side of SIDES){const shoulder=sockets[`${side}Shoulder`],l=config.lengths[side],q=Math.sin(state.time*5+(side==='far'?Math.PI:0));solveArm(side,{x:shoulder.x+l.upper*.85+q*1.1,y:shoulder.y+l.fore*.55});}
  if(['guiding','reviewing'].includes(state.action)){const sh=sockets.farShoulder,l=config.lengths.far;solveArm('far',{x:sh.x+l.upper*.6,y:sh.y+l.fore*(.3+Math.sin(state.time*8)*.22)});}
  // Reactions involve both arms, with planted feet and a breathing torso.
  if(state.reaction&&!state.load){const q=Math.sin(clamp(state.reaction)*Math.PI);for(const side of SIDES){const s=sockets[`${side}Shoulder`],l=config.lengths[side];solveArm(side,{x:s.x+(side==='near'?-1:1)*l.upper*q,y:s.y+(l.upper+l.fore)*(.9-.75*q)});}}
  return {root,legs,arms,props,face,hipHeight:config.hipHeight,sockets,bodyAngle,shoeProjection,frontWeight:front,tailAngle:Math.sin(state.time*(state.moving?5:1.5))*(state.moving?.07:.035),tailForeshorten:turn?Math.max(.15,Math.abs(Math.cos(Math.PI*turn.progress))):1,config,world:p=>({x:root.x+p.x*face,y:root.y+p.y})};
}

export function composeCastCore({body,variants,images,types,canvasFactory}){
  if(!types.length)return body;
  const layer=canvasFactory?.(body.width,body.height);if(!layer)return body;
  layer.width=body.width;layer.height=body.height;const c=layer.getContext('2d');c.drawImage(body,0,0);
  c.globalCompositeOperation='source-atop';
  for(const type of types)for(const [index,p] of (variants.overlays?.[type]||[]).entries()){const im=images[`${type}:${index}`];if(im)c.drawImage(im,p.origin[0],p.origin[1],p.size[0],p.size[1]);}
  c.globalCompositeOperation='source-over';return layer;
}
/** Family-only side/front crossfade in an isolated premultiplied layer.
 * Additive weighted alpha keeps overlapping opaque pixels opaque, unlike two
 * source-over half-alpha draws. Authored assets and their origins stay intact. */
export function composeFamilyBodyBlend({body,front,origin,frontOrigin,weight,face,canvasFactory,layer}){
  const fx=face<0?frontOrigin[0]-front.width:-frontOrigin[0],fy=-frontOrigin[1];
  const x=Math.floor(Math.min(-origin[0],fx)),y=Math.floor(Math.min(-origin[1],fy));
  const width=Math.ceil(Math.max(body.width-origin[0],fx+front.width)-x),height=Math.ceil(Math.max(body.height-origin[1],fy+front.height)-y);
  layer??=canvasFactory?.(width,height);if(!layer)return null;
  layer.width=width;layer.height=height;const c=layer.getContext('2d');
  c.globalAlpha=1-weight;c.drawImage(body,-origin[0]-x,-origin[1]-y);
  c.globalCompositeOperation='lighter';c.globalAlpha=weight;c.translate(-x,-y);c.scale(face,1);c.drawImage(front,-frontOrigin[0],-frontOrigin[1]);
  return {layer,x,y};
}
export function createCastPainter({ctx,manifest,variants,images,config,kind}){
  let familyBlendLayer;
  const bodyCache=new Map(),canvasFactory=(w,h)=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):globalThis.document?.createElement('canvas');
  const bodyImage=types=>{const key=types.join('+');if(!key)return images.body;if(!bodyCache.has(key))bodyCache.set(key,composeCastCore({body:images.body,variants,images,types,canvasFactory}));return bodyCache.get(key);};
  const service=createPaintedRigPainter({ctx,manifest,variants,images,config,kind});
  const segment=(name,a,b)=>{const p=manifest.parts[name],im=images[name],source=sub(point(p.distal),point(p.proximal)),desired=sub(b,a),ratio=Math.hypot(desired.x,desired.y)/Math.hypot(source.x,source.y);ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(desired.y,desired.x)-Math.atan2(source.y,source.x));ctx.scale(ratio,ratio);ctx.drawImage(im,-p.proximal[0],-p.proximal[1]);ctx.restore();};
  const arm=(side,p)=>{segment(`${side}_upper_arm`,p.root,p.joint);segment(`${side}_forearm`,p.joint,p.end);};
  const leg=(side,p,projection)=>{segment(`${side}_thigh`,p.root,p.joint);segment(`${side}_shin`,p.joint,p.end);const part=manifest.parts[`${side}_shoe`];ctx.save();ctx.translate(p.sole.x,p.sole.y);ctx.scale(config.scale*projection,config.scale);ctx.drawImage(images[`${side}_shoe`],-part.sole_anchor[0],-part.sole_anchor[1]);ctx.restore();};
  const drawProp=p=>{const part=manifest.parts[p.name],im=images[p.name];if(!part||!im){if(['towel','meal'].includes(p.name))service.drawLoad(p.name,p.grip);return;}const grip=p.origin||part.handle_grip||part.proximal;ctx.save();ctx.translate(p.grip.x,p.grip.y);ctx.rotate(p.angle||0);ctx.scale(config.scale*(p.artScale||1)*(p.scaleX||1),config.scale*(p.artScale||1));ctx.drawImage(im,-grip[0],-grip[1]);ctx.restore();};
  return {draw(state,pose,debug=false){
    ctx.save();ctx.translate(pose.root.x,pose.root.y);ctx.scale(pose.face,1);
    const tail=manifest.parts.tail;if(tail){ctx.save();ctx.translate(pose.sockets.tail.x,pose.sockets.tail.y);ctx.rotate(pose.bodyAngle+pose.tailAngle);ctx.scale(config.scale*pose.tailForeshorten,config.scale);ctx.drawImage(images.tail,-tail.proximal[0],-tail.proximal[1]);ctx.restore();}
    arm('far',pose.arms.far);leg('far',pose.legs.far,pose.shoeProjection);leg('near',pose.legs.near,pose.shoeProjection);
    ctx.save();ctx.rotate(pose.bodyAngle);const front=state.turn&&state.turn.progress>.2&&state.turn.progress<.8,blink=!state.reducedMotion&&!state.turn&&((state.time+(state.idlePhase||0))%4.9)<.11,body=manifest.parts.body;
    const blend=kind==='bear-child'&&Number.isFinite(pose.familyBodyBlend)?pose.familyBodyBlend:null;
    const mixed=blend>0&&blend<1&&images.bodyFront?composeFamilyBodyBlend({body:images.body,front:images.bodyFront,origin:config.origin,frontOrigin:config.frontOrigin,weight:blend,face:pose.face,canvasFactory,layer:familyBlendLayer}):null;
    if(mixed){familyBlendLayer=mixed.layer;ctx.drawImage(mixed.layer,mixed.x*config.scale,mixed.y*config.scale,mixed.layer.width*config.scale,mixed.layer.height*config.scale);}
    else if((blend===null?front:blend===1)&&images.bodyFront){ctx.scale(pose.face,1);const f=variants.variants.front;ctx.drawImage(images.bodyFront,-config.frontOrigin[0]*config.scale,-config.frontOrigin[1]*config.scale,f.size[0]*config.scale,f.size[1]*config.scale);}else{
      const overlays=[];if(blink)overlays.push('blink');if(state.working&&['deer','hedgehog'].includes(kind)&&Math.sin(state.time*10)>.05)overlays.push('singing');
      ctx.drawImage(bodyImage(overlays),-config.origin[0]*config.scale,-config.origin[1]*config.scale,body.size[0]*config.scale,body.size[1]*config.scale);
    }ctx.restore();
    for(const p of pose.props)drawProp(p);arm('near',pose.arms.near);
    // Stirring/writing far paw must remain visible over the held foreground prop.
    if((['chef','owl','hedgehog','deer'].includes(kind)||kind==='bear-parent'&&state.familyCarryProgress>0)&&pose.props.length)arm('far',pose.arms.far);
    if(debug){ctx.lineWidth=.45;for(const p of [...Object.values(pose.legs),...Object.values(pose.arms)]){ctx.strokeStyle='#00e6ac';ctx.beginPath();ctx.moveTo(p.root.x,p.root.y);ctx.lineTo(p.joint.x,p.joint.y);ctx.lineTo(p.end.x,p.end.y);ctx.stroke();}for(const p of pose.props){ctx.fillStyle='#e12bd4';ctx.fillRect(p.grip.x-.6,p.grip.y-.6,1.2,1.2);}}
    ctx.restore();
  },drawLoad:service.drawLoad};
}

const base={supportsReaction:true,landingFacing:castLandingFacing,syncStairFacing:true,configure:measuredCastConfig,pose:castPose,painter:createCastPainter,createPlanner:c=>new CastContactPlanner(c),restContact:castRestContact,turnState:castTurnState};
export const CAST_RIG_DEFINITIONS=Object.freeze({
  badger:{...base,matches:(id,a)=>a.spriteKind==='badger'||id==='mechanic',opaqueHeight:270,load:a=>['wrench','broom'].includes(a.carrying)?a.carrying:null},
  cat:{...base,matches:(id,a)=>a.spriteKind==='cat',opaqueHeight:270,load:()=> 'suitcase'},
  raccoon:{...base,matches:(id,a)=>a.spriteKind==='raccoon'||id==='thief',opaqueHeight:270},
  'bear-parent':{...base,configure:m=>({...measuredCastConfig(m),stairContactFactors:{near:.37,far:.69},plinthLeadFraction:{'lower-step':.10}}),matches:(id,a)=>a.spriteKind==='family',opaqueHeight:280,load:()=> 'suitcase'},
  'bear-child':{...base,matches:(id,a)=>a.spriteKind==='bear-child',opaqueHeight:162},
  chef:{...base,matches:id=>id==='chef',opaqueHeight:300},
  owl:{...base,configure:m=>({...measuredCastConfig(m),stairContactFactors:{near:.68,far:.96}}),matches:id=>id==='inspector',opaqueHeight:260},
  hedgehog:{...base,matches:(id,a)=>id.startsWith('performer-')&&a.performer==='hedgehog',opaqueHeight:260},
  deer:{...base,matches:(id,a)=>id.startsWith('performer-')&&a.performer==='deer',opaqueHeight:280},
});

/** Separate cub follows distance along observed authoritative adult path, not an
 * independent timer or one frozen family picture. No actor/session writes. */
export function castFamilyFollower(cache,actor,time,id){
  const trail=cache.familyTrail??=[{x:actor.x-32*(actor.facing<0?-1:1),y:actor.y},{x:actor.x,y:actor.y}];
  const last=trail.at(-1),delta=distance(last,actor);
  if(delta>160){trail.splice(0,trail.length,{x:actor.x-32*(actor.facing<0?-1:1),y:actor.y},{x:actor.x,y:actor.y});}
  else if(delta>.01)trail.push({x:actor.x,y:actor.y});
  let remaining=32,child={...trail[0]},index=0;
  for(let i=trail.length-1;i>0;i--){const a=trail[i],b=trail[i-1],d=distance(a,b);if(d>=remaining){child=mix(a,b,remaining/d);index=i;break;}remaining-=d;}
  if(index>1)trail.splice(0,index-1);
  const route=trail.slice(1).map(p=>({x:p.x,y:p.y+8}));
  for(const p of actor.path||[])route.push({x:p.x,y:p.y+8});
  return {...actor,x:child.x,y:child.y+8,spriteKind:'bear-child',motionParentId:id,carrying:null,path:actor.moving?route:[],facing:actor.facing,working:false};
}
