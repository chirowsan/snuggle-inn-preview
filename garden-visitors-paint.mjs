import {addCoreVariants,rabbitConfig,rigPose,clamp,smooth,solveTwoBone} from './animal-motion-pose.mjs';
import {FlatContactPlanner,routeForecast,turnState} from './animal-motion-flat.mjs';
import {measuredCastConfig,CastContactPlanner,castTurnState,castPose,createCastPainter} from './animal-motion-cast.mjs';
import {createPaintedRigPainter} from './animal-motion-painter.mjs';
import {groundPoint} from './exterior-projection.mjs';

export const GARDEN_DRAW=Object.freeze({width:144,height:160,feetX:72,feetY:142,animalHeight:73,seatHeight:31});
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const sides=['near','far'];

/** Bend the existing painted anatomical parts into a supported bench pose.
 * No new art, silhouette compression, bag, or root-anchored sliding sprite. */
export function gardenSeatPose(state,config,standing,visitor,scale){
 const amount=smooth(visitor.seatProgress||0);if(!amount||!visitor.seat)return standing;
 const seat=groundPoint(visitor.seat.seat.x,visitor.seat.seat.y),root={x:seat.x/scale,y:(seat.y-GARDEN_DRAW.seatHeight)/scale};
 const pose={...standing,root:mix(standing.root,root,amount),legs:{},arms:{},props:[],sockets:{},bodyAngle:standing.bodyAngle*(1-amount),face:1,shoeProjection:1,tailForeshorten:1,frontWeight:amount};
 // The bench faces the viewer; use the authored front body and measured front sockets.
 for(const key of ['nearHip','farHip','nearShoulder','farShoulder','tail'])pose.sockets[key]=mix(standing.sockets[key],config.frontSockets?.[key]||config[key],amount);
 for(const side of sides){
  const leg=standing.legs[side],hip=pose.sockets[`${side}Hip`],lengths=config.lengths?.[side]||{thigh:config.thighLength,shin:config.shinLength,upper:config.upperArmLength,fore:config.forearmLength},ankleOffset=config[`${side}Ankle`];
  // Forward knees, then hanging lower legs: both segments retain measured length.
  const dir=side==='near'?-1:1,target={x:hip.x+dir*lengths.thigh*.58,y:hip.y+lengths.thigh*.38+lengths.shin*.89};
  const ankle=mix(leg.end,target,amount),solved=solveTwoBone(hip,ankle,lengths.thigh,lengths.shin,dir);
  pose.legs[side]={...solved,ankle:solved.end,sole:{x:solved.end.x-ankleOffset.x,y:solved.end.y-ankleOffset.y},planted:false};
  const shoulder=pose.sockets[`${side}Shoulder`],arm=standing.arms[side],paw=mix(arm.paw,{x:hip.x+dir*lengths.thigh*.25,y:hip.y-2},amount),arms=solveTwoBone(shoulder,paw,lengths.upper,lengths.fore,-dir);
  pose.arms[side]={...arms,paw:arms.end};
 }
 pose.world=p=>({x:pose.root.x+p.x*pose.face,y:pose.root.y+p.y});
 return pose;
}

export class GardenVisitorPainter{
 constructor(ctx,rig,kind){
  this.ctx=ctx;this.kind=kind;this.rig=rig;
  this.config=addCoreVariants(kind==='cat'?measuredCastConfig(rig.manifest):rabbitConfig(rig.manifest),rig.variants);
  const c=this.config;this.scale=GARDEN_DRAW.animalHeight/(c.origin[1]*c.scale+c.hipHeight);
  this.planner=kind==='cat'?new CastContactPlanner(c):new FlatContactPlanner('rabbit');this.cache={planner:this.planner};
  this.painter=(kind==='cat'?createCastPainter:createPaintedRigPainter)({ctx,...rig,config:c,kind});
 }
 draw(visitor,time){
  const c=this.ctx,config=this.config,scale=this.scale,point=groundPoint(visitor.x,visitor.y),project=(x,y)=>{const p=groundPoint(x,y);return {x:p.x/scale,y:p.y/scale};},root=project(visitor.x,visitor.y);
  const predict=routeForecast(visitor,project),future=predict(.02),speed=Math.hypot(future.x-root.x,future.y-root.y)/.02;
  const state=this.planner.sample({root,time,moving:visitor.moving&&speed>.01,face:visitor.facing,speed,predict});
  (this.kind==='cat'?castTurnState:turnState)(this.cache,state,visitor.seatProgress?1:visitor.facing,config);
  Object.assign(state,{kind:this.kind,load:false,intendedLoad:false,reach:0,working:false,action:'garden',idlePhase:visitor.serial*.7,segment:{at:root}});
  let pose=(this.kind==='cat'?castPose:rigPose)(state,config);
  if(visitor.seatProgress){pose=gardenSeatPose(state,config,pose,visitor,scale);state.turn={progress:.5*smooth(visitor.seatProgress),fromFace:1,toFace:1,frontWeight:smooth(visitor.seatProgress)};}
  const d=GARDEN_DRAW;c.save();c.clearRect(0,0,d.width,d.height);c.translate(d.feetX-point.x,d.feetY-point.y);
  const sitting=smooth(visitor.seatProgress||0),seatGround=visitor.seat?groundPoint(visitor.seat.seat.x,visitor.seat.seat.y):point,shadow=mix(point,seatGround,sitting);
  // The bench already owns the seated contact shadow. Do not leave the walking
  // oval at the approach point, disconnected in front of a resting visitor.
  c.globalAlpha=visitor.alpha*.22*(1-sitting);c.fillStyle='#263c2c';c.beginPath();c.ellipse(shadow.x,shadow.y,15,5,0,0,Math.PI*2);c.fill();
  c.globalAlpha=visitor.alpha;c.scale(scale,scale);this.painter.draw(state,pose);c.restore();
  this.last={state,pose,scale};return this.last;
 }
}
