/** Optional painted-tool grip adapter for Pip and Rue. Their existing body,
 * measured legs, gait and towel/meal poses are left completely unchanged. */
import {configFromManifest,solveTwoBone,clamp} from './animal-motion-pose.mjs';
import {createPaintedRigPainter} from './animal-motion-painter.mjs';
export const staffToolLoad=actor=>['wrench','broom'].includes(actor.carrying)?actor.carrying:null;
export function configureStaffTools(manifest){return {...configFromManifest(manifest),heldTools:{wrench:manifest.parts.wrench,broom:manifest.parts.broom}};}
const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
export function applyStaffToolPose(state,pose,config){
  const name=state.load,part=config.heldTools?.[name];if(!part)return pose;
  const sh=pose.sockets.nearShoulder,working=state.working&&!state.moving&&!state.turn,phase=state.time*(name==='broom'?4:7);
  let angle=0,target;
  if(name==='wrench'){
    angle=working?-.45+Math.sin(phase)*.18:-.45;
    target={x:sh.x-4.5+(working?Math.sin(phase)*2.2:0),y:sh.y+6+(working?Math.cos(phase)*2:0)};
  }else{
    angle=working?Math.sin(phase)*.10:0;
    const offset=rotate({x:(part.ground_contact[0]-part.handle_grip[0])*config.scale,y:(part.ground_contact[1]-part.handle_grip[1])*config.scale},angle);
    const tip={x:sh.x+2+(working?Math.sin(phase)*3.5:0),y:state.root.y-pose.root.y-(working?0:state.stairs?9:1.2)};
    target={x:tip.x-offset.x,y:tip.y-offset.y};
  }
  const dx=target.x-sh.x,dy=target.y-sh.y,d=Math.hypot(dx,dy),r=clamp(d,Math.abs(config.upperArmLength-config.forearmLength)+.002,config.upperArmLength+config.forearmLength-.002);
  if(d>1e-9&&r!==d)target={x:sh.x+dx*r/d,y:sh.y+dy*r/d};
  const arm=solveTwoBone(sh,target,config.upperArmLength,config.forearmLength,-1),grip=arm.end;
  const artScale=name==='wrench'?1.2:1,tipAnchor=part.ground_contact||part.working_tip||part.jaw_center,offset=rotate({x:(tipAnchor[0]-part.handle_grip[0])*config.scale*artScale,y:(tipAnchor[1]-part.handle_grip[1])*config.scale*artScale},angle);
  const prop={name,side:'near',grip,angle,artScale,tip:{x:grip.x+offset.x,y:grip.y+offset.y}};
  return {...pose,arms:{...pose.arms,near:{...arm,paw:grip}},props:[prop],heldTool:prop};
}
export function createStaffToolPainter(options){
  const {ctx,config,images}=options;
  const loadPainter=(type,p,prop)=>{
    const part=config.heldTools?.[type],im=images[type];if(!part||!im)return false;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(prop?.angle||0);ctx.scale(config.scale*(prop?.artScale||1),config.scale*(prop?.artScale||1));ctx.drawImage(im,-part.handle_grip[0],-part.handle_grip[1]);ctx.restore();return true;
  };
  return createPaintedRigPainter({...options,loadPainter});
}
