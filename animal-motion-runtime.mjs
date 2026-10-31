import {staffToolLoad,configureStaffTools,applyStaffToolPose,createStaffToolPainter} from './animal-motion-staff-tools.mjs';
import {familyCarryProgress,piggybackPose} from './animal-motion-family.mjs';
import {CAST_RIG_DEFINITIONS,castFamilyFollower} from './animal-motion-cast.mjs';
import {stairAt} from './rush-floors.mjs';
import {addCoreVariants,configFromManifest,rabbitConfig,pipPose,rabbitPose,clamp,smooth} from './animal-motion-pose.mjs';
import {createPaintedRigPainter} from './animal-motion-painter.mjs';
import {FlatContactPlanner,routeForecast,restContact,turnState} from './animal-motion-flat.mjs';

export const MOTION_BUNDLE_URL=new URL('./assets/motion/manifest.json',import.meta.url).href;
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const loadFor=a=>a.carrying==='meal'?'meal':['linen','dirty-linen'].includes(a.carrying)?'towel':null;
// Species are opt-in, each with its OWN measured anatomy/solver. Sharing the
// approved courier-art role also covers Rue, not an unreviewed animal species.
export const RIG_DEFINITIONS=Object.freeze({
  ...CAST_RIG_DEFINITIONS,
  pip:{matches:(id,a)=>id==='courier'||id==='helper'&&a.spriteKind==='courier',configure:configureStaffTools,pose:pipPose,opaqueHeight:270,load:staffToolLoad,finalizePose:applyStaffToolPose,painter:createStaffToolPainter},
  rabbit:{matches:(id,a)=>a.spriteKind==='guest'&&(!a.species||a.species==='rabbit'),configure:rabbitConfig,pose:rabbitPose,opaqueHeight:265},
});
export const animalKind=(id,a,definitions=RIG_DEFINITIONS)=>Object.keys(definitions).find(kind=>definitions[kind].matches(id,a))||null;

/** Boot API: an individual failed species leaves its original sprite available.
 * No asset fetch escapes this local bundle. Call once, then renderer.setAnimalMotion.
 * Timeout/network/decode errors are returned, not thrown through the game boot. */
export async function loadAnimalMotionBundle({manifestURL=MOTION_BUNDLE_URL,fetcher=globalThis.fetch,ImageClass=globalThis.Image,timeoutMs=8000,cart=null,onProgress=()=>{}}={}){
  const result={rigs:{},errors:[],manifest:null};
  manifestURL=new URL(manifestURL,import.meta.url).href;
  const release=new URL(manifestURL).searchParams.get('v')||new URL(import.meta.url).searchParams.get('v');
  const pinned=url=>{const result=new URL(url,manifestURL);if(release)result.searchParams.set('v',release);return result.href;};
  const bounded=operation=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Motion asset load timed out')),timeoutMs);Promise.resolve(operation).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
  const json=async url=>{const r=await bounded(fetcher(pinned(url)));if(!r.ok)throw new Error(`Motion asset HTTP ${r.status}: ${url}`);return bounded(r.json());};
  const image=async url=>{const im=new ImageClass();im.src=pinned(url);if(im.decode)await bounded(im.decode());else await bounded(new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;}));return im;};
  try{
    result.manifest=await json(manifestURL);
    const root=new URL('../../',manifestURL);
    let completed=0;const total=Object.keys(result.manifest.rigs).length;
    const report=()=>{try{onProgress(completed,total);}catch{ /* Observation must not break game boot. */ }};report();
    await Promise.all(Object.entries(result.manifest.rigs).map(async([kind,meta])=>{
      try{
        const [manifest,variants]=await Promise.all([json(new URL(meta.manifest,root)),json(new URL(meta.variants,root))]);
        const base=new URL(`${meta.base}/`,root),images={};
        await Promise.all([...Object.entries(manifest.parts).map(async([key,p])=>{images[key]=await image(new URL(p.file,base));}),
          ...(['pip','rabbit'].includes(kind)?[['bodyFront','front'],['bodyBlink','blink']]:[['bodyFront','front']]).map(async([key,id])=>{images[key]=await image(new URL(`core-variants/${variants.variants[id].file}`,base));}),
          ...Object.entries(variants.overlays||{}).flatMap(([type,parts])=>parts.map(async(part,index)=>{images[`${type}:${index}`]=await image(new URL(`core-variants/${part.file}`,base));}))]);
        if(kind==='pip'||kind==='badger')images.cart=cart||await image(new URL('assets/props/cart.webp',root));
        result.rigs[kind]={manifest,variants,images};
      }catch(error){result.errors.push({kind,message:String(error?.message||error)});}finally{completed++;report();}
    }));
  }catch(error){result.errors.push({kind:'bundle',message:String(error?.message||error)});}
  return result;
}

/** Stair seam (not supplied by this flat-route candidate):
 * sample({actor,gameState,id,kind,config,project,scale,time,dt,previous}) returns
 * null for unavailable, or {state,pose?,drawForeground?}. project(x,y) is actual
 * renderer projection divided by scale; all returned rig geometry is in those
 * isotropic units. The provider owns authoritative stair progress/contact mapping,
 * and may supply a separate root only if tied to that same exact engine progress.
 * Foreground receives {ctx,renderer,state,pose,scale} and must restore canvas state.
 * The stair image and contacts MUST share its tested projection; do not plug a
 * fixture clock in here. No provider means original sprite, never flat gait stairs.
 */
export class AnimalMotionRuntime {
  constructor(bundle,{stairAdapter=null,maxActors=64,definitions=RIG_DEFINITIONS,qaAllowLegacyMotion=false}={}){
    this.bundle=bundle||{rigs:{}};this.qaAllowLegacyMotion=qaAllowLegacyMotion===true;this.definitions=definitions;this.stairAdapter=stairAdapter;this.maxActors=Math.max(1,Math.min(128,maxActors));this.cache=new Map();this.configs={};this.failures=[];
    for(const [kind,rig]of Object.entries(this.bundle.rigs||{}))if(definitions[kind]){try{this.configs[kind]=addCoreVariants(definitions[kind].configure(rig.manifest),rig.variants);}catch(error){this.failures.push({kind,message:String(error?.message||error)});}}
  }
  reset(){this.familyMemory=new Map();this.cache.clear();this.session=null;this.lastTime=null;this.projection=null;this.stairAdapter?.reset?.();}
  beginFrame(renderer,state,{visualActors=[]}={}){
    const projection=[renderer.width,renderer.height,renderer.sx,renderer.sy,renderer.top,renderer.spriteScale,renderer.floor||0,renderer.motionProjectionKey||''].join(':');
    if(this.session!==state||this.projection!==projection||state.time<this.lastTime){
      const keep=this.session===state&&state.time>=this.lastTime?new Map([...this.cache].filter(([,c])=>c.output?.kind==='bear-parent').map(([id,c])=>[id,{familyTrail:c.familyTrail,familyExit:c.familyExit,familyWasCarried:c.familyWasCarried,familyDepartureDistance:c.familyDepartureDistance,facing:c.facing,turn:c.turn?{...c.turn}:null}])):null;
      this.reset();if(keep)this.familyMemory=keep;
    }
    this.session=state;this.projection=projection;this.time=Number.isFinite(state.time)?state.time:0;
    this.dt=this.lastTime===null?0:Math.max(0,this.time-this.lastTime);this.lastTime=this.time;
    const ids=new Set([...Object.entries(state.actors||{}).filter(([,a])=>a.visible).map(([id])=>id),...visualActors.filter(a=>a.visible).map(a=>a.id)]);
    for(const id of this.familyMemory?.keys()||[])if(!ids.has(id))this.familyMemory.delete(id);
    for(const [id,cached] of this.cache)if(!ids.has(cached.parentId||id)&&!cached.auxiliary)this.cache.delete(id);
  }
  sampleActor(renderer,id,actor){
    // Old active shifts keep both their original simulation and legacy visuals.
    // Only an explicit isolated QA flag may exercise rigs at legacy stress speeds.
    if(this.session?.version!==7&&!this.qaAllowLegacyMotion){this.cache.delete(id);return null;}
    const kind=animalKind(id,actor,this.definitions),rig=this.bundle.rigs?.[kind],config=this.configs[kind];
    if(!actor.visible||!rig||!config||kind==='bear-parent'&&!this.configs['bear-child']||!finitePoint(actor)||actor.phase==='inCart'||(actor.action==='slipping'&&!this.definitions[kind].supportsReaction)||(actor.carrying&&!loadFor(actor)&&!this.definitions[kind].load?.(actor))){this.cache.delete(id);return null;}
    const carried=actor.motionCarryProgress>0&&this.cache.get(actor.motionCarrierId)?.output;
    const stairs=carried?null:stairAt(actor);
    const landing=carried?null:this.stairAdapter?.landingAt?.(actor,this.session);
    if(stairs&&!this.stairAdapter){this.cache.delete(id);return null;}
    const referenceHeight=config.origin[1]*config.scale+config.hipHeight;
    const scale=(160*renderer.spriteScale*this.definitions[kind].opaqueHeight/384)/referenceHeight;
    const project=(x,y)=>{const p=renderer.point(x,y);return{x:p.x/scale,y:p.y/scale};};
    const root=project(actor.x,actor.y),time=this.time??0,reducedMotion=!!renderer.settings?.reducedMotion;
    let cache=this.cache.get(id);
    if(!cache){if(this.cache.size>=this.maxActors)this.cache.delete(this.cache.keys().next().value);cache={planner:this.definitions[kind].createPlanner?.(config)||new FlatContactPlanner(kind),facing:actor.facing<0?-1:1,auxiliary:['chef','owl','hedgehog','deer'].includes(kind),parentId:actor.motionParentId};if(kind==='bear-parent'&&this.familyMemory?.has(id))Object.assign(cache,this.familyMemory.get(id));this.cache.set(id,cache);}
    const stamp=[time,actor.x,actor.y,actor.facing,actor.moving,actor.action,actor.progress,actor.carrying,actor.job?.type,actor.job?.phase,actor.working,actor.motionCarryProgress,reducedMotion].join('|');
    if(cache.stamp===stamp)return cache.output;
    let wantedFace=actor.facing<0?-1:1;
    if(actor.path?.length&&Math.abs(actor.path[0].x-actor.x)>1)wantedFace=Math.sign(actor.path[0].x-actor.x);
    wantedFace=renderer.motionFacing?.(actor,wantedFace)??wantedFace;
    wantedFace=this.definitions[kind].landingFacing?.(actor,wantedFace)??wantedFace;
    const elapsed=cache.lastObserved?time-cache.lastObserved.time:0;
    // Shared escorts may run slower than actor.speed. Forecast contact travel from
    // measured authoritative displacement, not a renderer-owned follower offset.
    const measured=elapsed>0&&elapsed<=.25?Math.hypot(actor.x-cache.lastObserved.x,actor.y-cache.lastObserved.y)/elapsed:actor.speed;
    const routeSpeed=actor.moving&&measured>.01?measured:actor.speed;
    const predict=routeForecast(actor,project,routeSpeed),next=predict(.02),speed=Math.hypot(next.x-root.x,next.y-root.y)/.02;
    // Engine moving may remain true for the last arrival frame: preserve that exact
    // last displacement, but no gait clock advances when simulation time is frozen.
    const moving=!!actor.moving&&speed>.01;
    let state,pose,foreground;
    if(stairs||landing){
      const supplied=this.stairAdapter.sample({actor,gameState:this.session,id,kind,config,project,scale,time,dt:this.dt,previous:cache.output});
      if(!supplied||!finitePoint(supplied.state?.root)||!finitePoint(supplied.state?.feet?.near)||!finitePoint(supplied.state?.feet?.far)){this.cache.delete(id);return null;}
      state=supplied.state;pose=supplied.pose;foreground=supplied.drawForeground;
      if(landing&&supplied.repose){
        const yaw=state.yawPlan;
        if(yaw){cache.facing=yaw.fromFace;cache.turn={fromFace:yaw.fromFace,toFace:yaw.toFace,start:time-yaw.progress*yaw.duration,duration:yaw.duration};}
        (this.definitions[kind].turnState||turnState)(cache,state,yaw?.toFace??state.face,config);
        const revised=supplied.repose(state);state=revised.state;pose=revised.pose;
      }else if(this.definitions[kind].syncStairFacing||[2,3].includes(this.session?.config?.motionRouteRevision)){cache.facing=state.face;cache.turn=null;}
    }else if(reducedMotion){
      state={root,feet:{near:(this.definitions[kind].restContact||restContact)(root,'near',wantedFace,config),far:(this.definitions[kind].restContact||restContact)(root,'far',wantedFace,config)},support:'both',moving:false,face:wantedFace,time:0,cadence:0,u:0,flightHeight:0,velocity:0,nominalSpeed:1,targetPhoneSpeed:40,gait:'walk',stairs:false,reducedMotion:true};
      cache.turn=null;cache.facing=wantedFace;cache.planner.reset(root,time,wantedFace);
    }else{
      if(cache.output?.state?.plinth&&cache.planner.resumeFromContacts)cache.planner.resumeFromContacts(root,time,wantedFace,Object.fromEntries(Object.entries(cache.output.pose.legs).map(([side,leg])=>[side,cache.output.pose.world(leg.sole)])));
      state=cache.planner.sample({root,time,moving,face:wantedFace,speed,predict,displayedFeet:cache.output?Object.fromEntries(Object.entries(cache.output.pose.legs).map(([side,leg])=>[side,cache.output.pose.world(leg.sole)])):null});(this.definitions[kind].turnState||turnState)(cache,state,wantedFace,config);
    }
    const load=this.definitions[kind].load?.(actor)??(kind==='rabbit'?'suitcase':loadFor(actor));
    let reach=0,intendedLoad=load;
    if(!reducedMotion&&['pip','badger'].includes(kind)){
      const progress=clamp(actor.progress||0);
      if(actor.action==='placing'&&load)reach=smooth(progress/.8);
      if(actor.action==='collecting'&&['deliverTowel','deliverMeal'].includes(actor.job?.type)){
        intendedLoad=actor.job.type==='deliverMeal'?'meal':'towel';reach=smooth(progress);
      }
      if(cache.previousLoad!==undefined&&cache.previousLoad!==load&&cache.output){
        cache.returnReach={start:time,reach:cache.output.state.reach||0,load:cache.previousLoad||load};
        if(cache.previousLoad&&!load&&cache.previousAction==='placing')cache.release={start:time,load:cache.previousLoad,point:cache.output.pose.world(cache.output.pose.arms.near.paw),face:cache.output.pose.face};
      }
      if(cache.returnReach){const q=clamp((time-cache.returnReach.start)/.18);reach=Math.max(reach,cache.returnReach.reach*(1-smooth(q)));intendedLoad||=cache.returnReach.load;if(q>=1)cache.returnReach=null;}
    }
    Object.assign(state,{motionRouteRevision:this.session?.config?.motionRouteRevision,load,intendedLoad,reach,reducedMotion,segment:{at:{...state.root}},kind,idlePhase:[...id].reduce((n,c)=>n+c.charCodeAt(0),0)%47/10,working:!!actor.working||['checking','working','stealing'].includes(actor.action),action:actor.action,workProgress:clamp(actor.progress||0),jobType:actor.job?.type,reaction:['startled','slipping'].includes(actor.action)?.65:0});
    if(kind==='bear-parent'){state.familyCarryProgress=familyCarryProgress(cache,actor,{state});state.familyAssist=Math.sin(Math.PI*state.familyCarryProgress);}
    pose||=this.definitions[kind].pose(state,config);
    if(this.definitions[kind].finalizePose)pose=this.definitions[kind].finalizePose(state,pose,config);
    if(carried)pose=piggybackPose(state,config,pose,carried,scale,actor.motionCarryProgress);
    const release=cache.release&&time-cache.release.start<.14?{...cache.release,alpha:1-clamp((time-cache.release.start)/.14)}:null;
    if(!release)cache.release=null;
    cache.previousLoad=load;cache.previousAction=actor.action;cache.stamp=stamp;cache.lastObserved={time,x:actor.x,y:actor.y};
    return cache.output={kind,rig,config,scale,state,pose,release,foreground};
  }
  companionActors(renderer,items){
    const companions=[];
    for(const actor of items){if(actor.type!=='actor'||actor.spriteKind!=='family'||!this.configs['bear-child'])continue;
      const output=this.sampleActor(renderer,actor.id,actor);if(output?.kind!=='bear-parent')continue;
      const familyCache=this.cache.get(actor.id),child=castFamilyFollower(familyCache,actor,this.time,actor.id),carry=familyCarryProgress(familyCache,actor,output);
      const companion={...child,motionCarrierId:actor.id,motionCarryProgress:carry,id:`${actor.id}:cub`,type:'actor'};
      // Resolve the shared assisting grip before either actor enters the paint list.
      this.sampleActor(renderer,companion.id,companion);companions.push(companion);
    }
    return companions;
  }
  drawActor(renderer,id,actor){
    try{
      const output=this.sampleActor(renderer,id,actor);if(!output)return false;
      const {kind,rig,config,scale,state,pose,release,foreground}=output;
      const cache=this.cache.get(id);cache.painter??=(this.definitions[kind].painter||createPaintedRigPainter)({ctx:renderer.ctx,...rig,config,kind});
      if(!state.carried)renderer.shadow(actor.x,actor.y,22);
      const c=renderer.ctx;c.save();
      try{c.scale(scale,scale);cache.painter.draw(state,pose);if(release){c.save();c.globalAlpha=release.alpha;c.translate(release.point.x,release.point.y);c.scale(release.face,1);cache.painter.drawLoad(release.load,{x:0,y:0});c.restore();}}
      finally{c.restore();}
      foreground?.({ctx:c,renderer,state,pose,scale});
      return true;
    }catch(error){this.cache.delete(id);if(this.failures.length<8)this.failures.push({id,message:String(error?.message||error)});return false;}
  }
}
export const createAnimalMotionRuntime=(bundle,options)=>new AnimalMotionRuntime(bundle,options);
