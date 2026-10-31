// Primary native pose adapter. Geometry/contact core stays independently frozen.
import {clamp,lerp,smooth,rigPose as basePose,solveTwoBone} from './animal-motion-pose.mjs';
export function solveStairPose(state,config){
  const strength=state.moving?smooth(state.local/.12)*smooth(state.remaining/.12):0;
  let lean=strength*(state.face===1?.045:-.018);
  if(Number.isFinite(state.plinth?.entryBodyAngle)){const baseAngle=state.moving?.018+Math.sin(state.cadence*Math.PI)*.012:Math.sin(state.time*Math.PI*2*.32)*.003;lean=lerp(state.plinth.entryBodyAngle-baseAngle,lean,smooth(state.plinth.localProgress/.4));}
  const r=p=>({x:p.x*Math.cos(lean)-p.y*Math.sin(lean),y:p.x*Math.sin(lean)+p.y*Math.cos(lean)});
  const modified={...config,stairHipHeight:(state.baseHipHeight??config.stairHipHeight)+state.flightHeight*(config.targetHeight/45.94)};
  for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail'])modified[key]=r(config[key]);
  const input=state.kind==='rabbit'?{...state,load:null,intendedLoad:null}:state;
  let pose=basePose(input,modified);
  // Raised-edge aerial COM interpolates its two actual support endpoints. This
  // scoped path avoids toggling an impossible two-air-foot height intersection
  // during a moving yaw; planted soles are never changed to manufacture reach.
  if(state.plinth&&state.support==='none'&&state.flightBounds){
    const heightAt=(bound,hipHeight)=>{if(Number.isFinite(bound.comY))return bound.comY;const endpointFace=bound.face??state.face,endpoint=basePose({...input,face:endpointFace,turn:bound.turn??null},modified),hip=endpoint.sockets[`${bound.side}Hip`],off=config[`${bound.side}Ankle`]||{x:0,y:-config.ankleHeight},projection=endpoint.shoeProjection;
      const dx=(bound.foot.x-bound.root.x)*endpointFace+off.x*projection-hip.x,max=config.thighLength+config.shinLength-.12,min=Math.abs(config.thighLength-config.shinLength)+.2,ankleY=bound.foot.y+off.y;
      return clamp(bound.root.y-hipHeight,ankleY-hip.y-Math.sqrt(Math.max(.01,max*max-dx*dx)),ankleY-hip.y-Math.sqrt(Math.max(0,min*min-dx*dx)));};
    const bounds=state.flightBounds,fromY=heightAt(bounds.from,bounds.from.hipHeight??config.stairHipHeight),toY=heightAt(bounds.to,bounds.to.hipHeight??config.stairHipHeight),comY=lerp(fromY,toY,bounds.u)-state.flightHeight*(config.targetHeight/45.94);
    pose=basePose({...input,u:.5},{...modified,stairHipHeight:state.root.y-comY+.35});
  }
  pose.bodyAngle+=lean;
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
