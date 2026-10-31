import {withStairSupportBounds,withPlinthSupportBounds} from './animal-motion-support-bounds.mjs';
import {solveStairPose} from './animal-motion-stairs-primary.mjs';
import {plinthEdgeAt} from './hotel-plinth-edges.mjs';
import {samplePlinthEdge,samplePlinthRest,plinthRestAt} from './animal-motion-plinth.mjs';
import {productionLayout as legacyLayout,createStairProgressSampler as legacySampler,solveStairPose as legacyPose} from './animal-motion-stairs-legacy.mjs';
import {stairDepthItems,drawStairDepthItem} from './animal-motion-stair-depth.mjs';
import {stairAt} from './rush-floors.mjs';
import {productionLayout,scaleRigConfig,createStairProgressSampler} from './animal-motion-stairs-core.mjs';

const point=(p,scale)=>({x:p.x/scale,y:p.y/scale,...(Number.isFinite(p.z)?{z:p.z/scale}:{})});
const runtimeBound=(b,scale)=>({...b,...(b.foot?{foot:point(b.foot,scale)}:{}),root:point(b.root,scale),...(b.feet?{feet:Object.fromEntries(Object.entries(b.feet).map(([k,p])=>[k,point(p,scale)]))}:{}),...(Number.isFinite(b.baseHipHeight)?{baseHipHeight:b.baseHipHeight/scale}:{}),...(Number.isFinite(b.flightHeight)?{flightHeight:b.flightHeight/scale}:{}),...(Number.isFinite(b.hipHeight)?{hipHeight:b.hipHeight/scale}:{}),...(Number.isFinite(b.comY)?{comY:b.comY/scale}:{})});
const loadFor=a=>a.carrying==='meal'?'meal':['linen','dirty-linen'].includes(a.carrying)?'towel':null;
const rail=[[560,1317],[685,1330],[707,1205],[660,1110],[641,1020],[691,850],[761,670],[830,480],[910,276],[967,242],[982,101],[960,53],[930,45],[907,80],[882,133],[851,240],[820,345],[785,466],[746,590],[706,720],[661,843],[618,955],[572,973],[554,1030],[569,1120],[550,1230]];
export const TESTED_STAIR_SPECIES=Object.freeze(['pip','rabbit']);
function convertPose(native,scale,config){
  const limb=l=>Object.fromEntries(Object.entries(l).map(([key,value])=>[key,value&&typeof value==='object'&&Number.isFinite(value.x)&&Number.isFinite(value.y)?point(value,scale):['upper','lower','reachError'].includes(key)?value/scale:value]));
  const root=point(native.root,scale),pose={...native,root,config,hipHeight:Number.isFinite(native.hipHeight)?native.hipHeight/scale:config.hipHeight,
    legs:Object.fromEntries(Object.entries(native.legs).map(([k,v])=>[k,limb(v)])),arms:Object.fromEntries(Object.entries(native.arms).map(([k,v])=>[k,limb(v)])),
    sockets:Object.fromEntries(Object.entries(native.sockets).map(([k,v])=>[k,point(v,scale)]))};
  if(native.props)pose.props=native.props.map(p=>({...p,...(p.grip?{grip:point(p.grip,scale)}:{}),...(p.tip?{tip:point(p.tip,scale)}:{})}));
  pose.world=p=>({x:root.x+p.x*pose.face,y:root.y+p.y});return pose;
}
function directionFor(actor,flight,previous){
  const next=actor.path?.find(p=>Math.hypot(p.x-actor.x,p.y-actor.y)>.001);
  if(next&&Math.abs(next.y-actor.y)>.001)return next.y<actor.y?1:-1;
  if(previous?.state?.stair?.lowerFloor===flight.lowerFloor)return previous.state.stair.direction;
  return actor.facing<0?-1:1;
}
/** Opt-in v7 provider. No elapsed-time integration, actor writes, task completion
 * flags, or render-owned follower position. Current actor x/y is authoritative.
 * Native gate must approve the matching source before enabled:true is supplied. */
export class AuthoritativeStairProvider {
  constructor({getRenderer,enabled=false,stairDefinitions={}}={}){this.getRenderer=getRenderer;this.enabled=enabled;this.stairDefinitions=stairDefinitions;this.cache=new Map();this.directions=new WeakMap();this.warnings=[];this.landingAnchors=new WeakMap();}
  reset(){this.cache.clear();this.directions=new WeakMap();}
  active(state){return this.enabled&&state?.version===7;}
  layout(renderer,state=renderer.animalMotion?.session){return([2,3].includes(state?.config?.motionRouteRevision)?productionLayout:legacyLayout)(renderer.width,renderer.height,renderer);}
  landingAt(actor,state=this.getRenderer?.()?.animalMotion?.session){return this.active(state)&&[2,3].includes(state?.config?.motionRouteRevision)?(plinthEdgeAt(actor,state.config.motionRouteRevision)||plinthRestAt(actor,state.config.motionRouteRevision)):null;}
  sample({actor,gameState,id,kind,config,project,scale,time,dt,previous}){
    if(!this.active(gameState))return null;
    const renderer=this.getRenderer?.(),flight=stairAt(actor);
    if(!renderer)return null;if(!flight)return this.sampleLanding({actor,gameState,id,kind,config,project,scale,time,dt,previous});
    const explicit=this.stairDefinitions[kind];
    if(!TESTED_STAIR_SPECIES.includes(kind)&&!(typeof explicit?.configureNative==='function'&&typeof explicit?.solvePose==='function'))return null;
    if(renderer.images&&!renderer.images['assets/stair-flight.webp'])return null;
    const direction=directionFor(actor,flight,previous),floorOffset=(renderer.floor||0)-flight.lowerFloor;
    if(floorOffset!==0&&floorOffset!==1)return null;
    // Reversal is intentionally not fabricated as a continuous gait. The engine
    // must finish the current flight before reversing, or add a reviewed turn.
    let prior=this.directions.get(actor);
    if(previous&&!previous.state?.stair)prior=null;
    if(!prior||prior.lowerFloor!==flight.lowerFloor){prior={lowerFloor:flight.lowerFloor,direction};this.directions.set(actor,prior);}
    if(prior.direction!==direction){
      if(this.warnings.length<8)this.warnings.push({id,code:'unreviewed-midflight-reversal'});return null;
    }
    const definition=this.stairDefinitions[kind];
    const revision=[2,3].includes(gameState?.config?.motionRouteRevision)?gameState.config.motionRouteRevision:1;
    const key=[revision,kind,renderer.width,renderer.height,renderer.top,renderer.sy,scale].join(':');
    let sampler=this.cache.get(key);
    if(!sampler){const nativeConfig=definition?.configureNative?definition.configureNative(config,scale,{routeRevision:revision,kind}):scaleRigConfig(config,scale,kind);sampler=(revision>=2?createStairProgressSampler:legacySampler)(this.layout(renderer,gameState),nativeConfig,kind);if(revision>=2)sampler=withStairSupportBounds(sampler);this.cache.set(key,sampler);}
    const load=typeof definition?.load==='function'?definition.load(actor):kind==='rabbit'?'suitcase':loadFor(actor);
    const native=sampler.sampleProgress(flight.progress,{direction,floorOffset,time,load});
    // Preserve the exact observed root in metadata, including the floor offset.
    native.authoritativeRoot={x:actor.x,y:actor.y};
    const nativePose=definition?.solvePose?definition.solvePose(native,sampler.config):(revision>=2?solveStairPose:legacyPose)(native,sampler.config);
    const state={...native,root:point(native.root,scale),feet:{near:point(native.feet.near,scale),far:point(native.feet.far,scale)},
      segment:{...native.segment,at:point(native.root,scale)},flightHeight:native.flightHeight/scale,
      flightBounds:native.flightBounds?{...native.flightBounds,from:runtimeBound(native.flightBounds.from,scale),to:runtimeBound(native.flightBounds.to,scale)}:null,
      supportBounds:native.supportBounds?{...native.supportBounds,from:runtimeBound(native.supportBounds.from,scale),to:runtimeBound(native.supportBounds.to,scale)}:null,
      stair:{lowerFloor:flight.lowerFloor,upperFloor:flight.upperFloor,progress:flight.progress,direction,matrix:native.matrix},kind};
    const pose=convertPose(nativePose,scale,config);
    return {state,pose};
  }

  sampleLanding({actor,gameState,id,kind,config,scale,time,previous}){
    const location=this.landingAt(actor,gameState),renderer=this.getRenderer?.();if(!location||!renderer)return null;
    const definition=this.stairDefinitions[kind];if(!TESTED_STAIR_SPECIES.includes(kind)&&!(typeof definition?.configureNative==='function'&&typeof definition?.solvePose==='function'))return null;
    if(renderer.images&&!renderer.images['assets/stair-flight.webp'])return null;
    const revision=gameState?.config?.motionRouteRevision||2;
    const key=['plinth',revision,kind,renderer.width,renderer.height,renderer.top,renderer.sy,scale].join(':');let entry=this.cache.get(key);
    if(!entry){entry={layout:this.layout(renderer,gameState),config:definition?.configureNative?definition.configureNative(config,scale,{routeRevision:revision,kind}):scaleRigConfig(config,scale,kind)};this.cache.set(key,entry);}
    const load=typeof definition?.load==='function'?definition.load(actor):kind==='rabbit'?'suitcase':loadFor(actor),next=actor.path?.find(p=>Math.hypot(p.x-actor.x,p.y-actor.y)>.001),face=next&&Math.abs(next.x-actor.x)>.001?Math.sign(next.x-actor.x):actor.facing<0?-1:1;
    let anchors=null;
    if(location.id){
      const token=`${location.floor}:${location.id}:${location.direction}`,travelProgress=location.direction===1?location.progress:1-location.progress,from=location.direction===1?location.start:location.end,
        origin={x:from.x*entry.layout.sx,y:entry.layout.top+(from.y+(renderer.floor||0)*700)*entry.layout.sy};
      let saved=this.landingAnchors.get(actor);
      if(!saved||saved.session!==gameState||saved.token!==token||time<saved.time||travelProgress<saved.progress-1e-6||previous&&!previous.state?.plinth){
        saved={session:gameState,token};
        if(previous&&!previous.state?.stair&&!previous.state?.plinth)saved.normalized={
          bodyOffsetY:previous.pose.root.y-previous.state.root.y,bodyAngle:previous.pose.bodyAngle,
          offsets:Object.fromEntries(Object.entries(previous.pose.legs).map(([side,leg])=>{const f=previous.pose.world(leg.sole);return[side,{x:f.x-origin.x/scale,y:f.y-origin.y/scale}];})),
          planted:Object.fromEntries(Object.entries(previous.pose.legs).map(([side,leg])=>[side,leg.planted]))};
        this.landingAnchors.set(actor,saved);
      }
      saved.progress=travelProgress;saved.time=time;
      if(saved.normalized)anchors={bodyOffsetY:saved.normalized.bodyOffsetY*scale,bodyAngle:saved.normalized.bodyAngle,planted:saved.normalized.planted,
        feet:Object.fromEntries(Object.entries(saved.normalized.offsets).map(([side,p])=>[side,{x:origin.x+p.x*scale,y:origin.y+p.y*scale}]))};
    }
    const options={anchors,layout:entry.layout,config:entry.config,kind,cameraFloor:renderer.floor||0,time,load,moving:!!actor.moving,face};
    const native=location.id?withPlinthSupportBounds(samplePlinthEdge(location,options),location,options):samplePlinthRest(location,options);native.authoritativeRoot={x:actor.x,y:actor.y};
    const build=n=>{const solved=definition?.solvePose?definition.solvePose(n,entry.config):solveStairPose(n,entry.config),state={...n,root:point(n.root,scale),feet:{near:point(n.feet.near,scale),far:point(n.feet.far,scale)},baseHipHeight:n.baseHipHeight/scale,flightHeight:n.flightHeight/scale,supportBounds:n.supportBounds?{...n.supportBounds,from:runtimeBound(n.supportBounds.from,scale),to:runtimeBound(n.supportBounds.to,scale)}:null,segment:{...n.segment,at:point(n.root,scale)},flightBounds:n.flightBounds?{...n.flightBounds,from:runtimeBound(n.flightBounds.from,scale),to:runtimeBound(n.flightBounds.to,scale)}:null};return{state,pose:convertPose(solved,scale,config)};};
    const result=build(native);
    result.repose=state=>{const updated={...native,face:state.face,turn:state.turn};if(state.turn&&!native.moving){updated.feet=Object.fromEntries(Object.entries(state.feet).map(([side,p])=>[side,{x:p.x*scale,y:p.y*scale+native.terrainSlope*(p.x*scale-native.root.x)}]));updated.support=state.support;updated.contactIds=state.contactIds;}return build(updated);};
    return result;
  }
  /** null means retain the exact legacy culling rule. V7 stair actors use the
   * real clipped stage, not a root-only y cutoff that can hide a visible head. */
  visibleOnFloor(renderer,actor,state=renderer.animalMotion?.session){
    if(!this.active(state))return null;
    const flight=stairAt(actor);
    if(flight)return (renderer.floor||0)===flight.lowerFloor||(renderer.floor||0)===flight.upperFloor;
    // Conservative bound also covers tall ears, carried loads and landing exits.
    // The existing canvas stage clip supplies the exact visible edge.
    this.directions.delete(actor);
    const p=renderer.point(actor.x,actor.y),height=256*renderer.spriteScale+12;
    return p.y+8>=renderer.top&&p.y-height<=renderer.top+renderer.stageHeight;
  }
  matrices(renderer,state){
    const l=this.layout(renderer,state),last=state.version>=6&&state.config?.leisure?.lounge?3:2,rows=[];
    for(let f=last;f>=0;f--)rows.push({x:l.m0.x,y:l.m0.y+((renderer.floor||0)-f)*l.stageHeight,k:l.k,lowerFloor:f});
    return rows;
  }
  /** Replace, do not overlay, the old stretched-background stair loop. */
  drawBackground(renderer,state){
    if(!this.active(state))return false;const im=renderer.images?.['assets/stair-flight.webp'];if(!im)return false;
    for(const m of this.matrices(renderer,state))renderer.ctx.drawImage(im,m.x,m.y,1024*m.k,1536*m.k);return true;
  }
  /** Physical painted rail/post objects participate in the same depth list
   * as complete actors (including their carried props and attached child). */
  occluderItems(renderer,state){
    if(!this.active(state)||!renderer.images?.['assets/stair-flight.webp'])return [];
    const last=state.version>=6&&state.config?.leisure?.lounge?3:2;
    return stairDepthItems(this.layout(renderer,state),renderer.floor||0,last);
  }
  drawOccluder(renderer,item){
    const image=renderer.images?.['assets/stair-flight.webp'];if(image)drawStairDepthItem(renderer.ctx,image,item);
  }
  // Compatibility no-op. Blanket final foreground would incorrectly cover
  // actors standing IN FRONT of the outgoing post's ground base.
  drawForeground(){return false;}

}
export const createAuthoritativeStairProvider=options=>new AuthoritativeStairProvider(options);
