import {plinthEdgeAt,groundDepartureAt} from './hotel-plinth-edges.mjs';
/** Family visual parenting only. The adult engine root/path is authoritative.
 * Mount and dismount use distance on real landings, never delayed world travel. */
import {clamp,smooth,lerp,solveTwoBone} from './animal-motion-pose.mjs';
const SIDES=['near','far'],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),mix=(a,b,q)=>({x:lerp(a.x,b.x,q),y:lerp(a.y,b.y,q)});
export const FAMILY_TRANSITION_DISTANCE=110;
function approachingFlight(actor,revision=2){const path=[actor,...(actor.path||[])];let travel=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=distance(a,b);const raised=plinthEdgeAt({x:(a.x+b.x)/2,y:(a.y+b.y)/2,path:[b]},revision);if(raised||Math.abs(Math.abs(b.x-a.x)-100)<.15&&Math.abs(Math.abs(b.y-a.y)-630)<.15)return {distance:travel,landing:a,direction:b.y<a.y?1:-1};travel+=d;if(travel>FAMILY_TRANSITION_DISTANCE+2)return null;}return null;}
export function familyCarryProgress(cache,actor,parent){
  const stair=parent.state.stair,plinth=parent.state.plinth,revision=parent.state.motionRouteRevision||2;
  if(plinth&&(plinth.id!=='landing-rest'||plinth.surface!=='ground')){cache.familyDepartureDistance=null;cache.familyWasCarried=true;cache.familyExit=plinth.toSurface==='ground'?(plinth.direction===-1?plinth.start:plinth.end):null;return 1;}
  if(stair){cache.familyExit={x:stair.direction===1?1110:1010,y:stair.direction===1?600-stair.upperFloor*700:530-stair.lowerFloor*700};cache.familyWasCarried=true;cache.familyDepartureDistance=null;return 1;}
  const departure=groundDepartureAt(actor,{revision});
  if(departure){cache.familyWasCarried=true;cache.familyExit=departure.exit;cache.familyDepartureDistance=Math.min(FAMILY_TRANSITION_DISTANCE,departure.length);}
  const upcoming=approachingFlight(actor,revision),approach=upcoming?clamp(1-upcoming.distance/FAMILY_TRANSITION_DISTANCE):0;
  let depart=0;if(cache.familyWasCarried&&cache.familyExit){depart=clamp(1-distance(actor,cache.familyExit)/(cache.familyDepartureDistance||FAMILY_TRANSITION_DISTANCE));if(depart===0&&!approach){cache.familyWasCarried=false;cache.familyExit=null;cache.familyDepartureDistance=null;}}
  return smooth(Math.max(approach,depart));
}
export function piggybackPose(state,config,walking,parent,childScale,progress){
  const walkingTurn=state.turn;
  const q=clamp(progress),parentPose=parent.pose,parentTurn=parent.state.turn,ratio=parent.scale/childScale,face=parentPose.face;
  const yaw=parentTurn?Math.cos(Math.PI*parentTurn.progress)*parentTurn.fromFace/face:1;
  const parentPoint=(point,frontX=0)=>{const p={x:point.x*yaw+(parentTurn?frontX*parentTurn.frontWeight*parentTurn.fromFace/face:0),y:point.y},a=parentPose.bodyAngle,w=parentPose.world({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});return{x:w.x*ratio,y:w.y*ratio};};
  const anchor=parentPoint({x:-12,y:-13});
  const root=mix(walking.root,anchor,q);root.y-=Math.sin(Math.PI*q)*4;root.x-=(parentTurn?Math.cos(Math.PI*parentTurn.progress)*parentTurn.fromFace:face)*Math.sin(Math.PI*q)*4;
  const bodyAngle=lerp(walking.bodyAngle,parentPose.bodyAngle*.65,q),rotate=p=>({x:p.x*Math.cos(bodyAngle)-p.y*Math.sin(bodyAngle),y:p.x*Math.sin(bodyAngle)+p.y*Math.cos(bodyAngle)}),sockets={};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail']){let p=config[key];if(parentTurn){const f=config.frontSockets?.[key]||p;p={x:lerp(p.x*Math.cos(Math.PI*parentTurn.progress),f.x,parentTurn.frontWeight)*parentTurn.fromFace/face,y:lerp(p.y,f.y,parentTurn.frontWeight)};}sockets[key]=mix(walking.sockets[key],rotate(p),q);}
  const local=p=>({x:(p.x-root.x)*face,y:p.y-root.y});
  const world=p=>({x:root.x+p.x*face,y:root.y+p.y});
  const legs={},arms={},grasp=smooth(clamp((q-.45)/.35)),reachable=(from,to,upper,lower)=>{const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),r=clamp(d,Math.abs(upper-lower)+.002,upper+lower-.002);return d>1e-8?{x:from.x+dx*r/d,y:from.y+dy*r/d}:{x:from.x+r,y:from.y};};
  for(const side of SIDES){const l=config.lengths[side],hip=sockets[`${side}Hip`],offset=config[`${side}Ankle`],fold={x:hip.x+2.5,y:hip.y+2.8},walkingAnkle=walking.world(walking.legs[side].end),rideAnkle={x:anchor.x+fold.x*face,y:anchor.y+fold.y},target=local(mix(walkingAnkle,rideAnkle,q));
    const leg=solveTwoBone(hip,reachable(hip,target,l.thigh,l.shin),l.thigh,l.shin,1);legs[side]={...leg,sole:{x:leg.end.x-offset.x,y:leg.end.y-offset.y},ankle:leg.end,planted:false};
    const shoulder=sockets[`${side}Shoulder`];let grip=parentPoint(side==='near'?{x:-13.5,y:-18}:{x:2,y:-18},side==='far'?(parentPose.config.frontSockets?.farShoulder.x||parentPose.config.farShoulder.x)*.65:0),attached=false;
    if(side==='far'){
      // One shared grip, chosen inside BOTH real arm reach intervals. A fixed
      // mirrored torso point can leave the cub's reach during the front turn.
      const pc=parent.config||parentPose.config,pl=pc.lengths.far,ps=parentPose.world(parentPose.sockets.farShoulder),adultShoulder={x:ps.x*ratio,y:ps.y*ratio},childShoulder=world(shoulder),rParent=(pl.upper+pl.fore-.01)*ratio,rChild=l.upper+l.fore-.01;
      const py=grip.y-adultShoulder.y,cy=grip.y-childShoulder.y;
      if(Math.abs(py)<=rParent&&Math.abs(cy)<=rChild){const pr=Math.sqrt(rParent*rParent-py*py),cr=Math.sqrt(rChild*rChild-cy*cy),lo=Math.max(adultShoulder.x-pr,childShoulder.x-cr),hi=Math.min(adultShoulder.x+pr,childShoulder.x+cr);
        if(lo<=hi){grip={x:clamp(grip.x,lo,hi),y:grip.y};attached=grasp===1;const localParent={x:(grip.x/ratio-parentPose.root.x)*parentPose.face,y:grip.y/ratio-parentPose.root.y},target=mix(parentPose.arms.far.paw,localParent,grasp),pa=solveTwoBone(parentPose.sockets.farShoulder,target,pl.upper,pl.fore,-1);parentPose.arms.far={...pa,paw:pa.end};}
      }
    }
    const paw=local(mix(walking.world(walking.arms[side].paw),grip,side==='far'?Math.max(q,grasp):q)),arm=solveTwoBone(shoulder,reachable(shoulder,paw,l.upper,l.fore),l.upper,l.fore,-1);arms[side]={...arm,paw:arm.end};
    if(side==='far')state.familyGrip={point:grip,attached,error:distance(world(arm.end),grip)};
  }
  // During mount/dismount neither foot is advertised as a floor contact.
  // The fully attached pose has hands on parent torso anchors and tucked legs.
  state.support='none';state.contactIds={near:null,far:null};state.face=face;if(q===1)state.turn=parentTurn||null;state.kind='bear-child';state.carried=q;state.feet=Object.fromEntries(SIDES.map(s=>[s,world(legs[s].sole)]));
  return {...walking,root,face,bodyAngle,sockets,legs,arms,props:[],shoeProjection:1,frontWeight:lerp(walking.frontWeight||0,parentTurn?.frontWeight||0,q),familyBodyBlend:lerp(walkingTurn&&walkingTurn.progress>.2&&walkingTurn.progress<.8?1:0,parentTurn&&parentTurn.progress>.2&&parentTurn.progress<.8?1:0,q),tailForeshorten:1,world,carried:q};
}
