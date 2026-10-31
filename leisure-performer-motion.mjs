/** Cosmetic activity-only clock for the same measured rigs used on the floor.
 * It never owns a hotel actor, advances the hotel, or changes an activity token. */
import {AnimalMotionRuntime,RIG_DEFINITIONS} from './animal-motion-runtime.mjs';

export function leisurePerformerAction(activity){
 if(activity?.status==='complete')return 'working';
 if(activity?.kind==='lounge'&&activity.steps.length>0)return 'tuning';
 return 'preparing';
}

export function leisurePerformerLayout(width,height,kind){
 // Match the approved 384px sprite's existing contain box and sole anchor.
 // The rig is isotropic even when the activity board changes aspect ratio.
 const size=Math.min(width,height),opaqueHeight=RIG_DEFINITIONS[kind].opaqueHeight;
 return {x:(width-size)/2+size*256/384,y:(height-size)/2+size*356/384,
  spriteScale:size/160*267/opaqueHeight};
}

export class LeisurePerformerMotion {
 constructor(host,{bundle,version,reducedMotion=()=>false,onFallback=()=>{}}={}){
  Object.assign(this,{host,bundle,version,reducedMotion,onFallback,closed:true,frameId:null,last:null,time:0});
  this.doc=host?.ownerDocument;this.win=this.doc?.defaultView||globalThis;
  this.tick=now=>{this.frameId=null;if(this.closed)return;if(!this.present()){this.last=null;this.schedule();return;}
   const reduced=this.isReduced();
   if(this.last!==null&&!reduced)this.time+=Math.max(0,Math.min(.05,(now-this.last)/1000));
   this.last=now;
   if(!this.draw()){this.fail();return;}this.schedule();};
  this.visibility=()=>{this.last=null;if(this.doc?.hidden){this.cancelFrame();return;}if(!this.closed){this.draw();this.schedule();}};
 }
 isReduced(){return !!this.reducedMotion()||!!this.media?.matches;}
 present(){return !this.doc?.hidden&&this.host?.isConnected!==false&&!this.host?.closest?.('[hidden]');}
 open(activity){
  const kind=activity?.performer;
  if(this.version!==7||!['hedgehog','deer'].includes(kind)||!this.bundle?.rigs?.[kind]||!this.doc?.createElement||!this.win.requestAnimationFrame)return false;
  this.runtime=new AnimalMotionRuntime({rigs:{[kind]:this.bundle.rigs[kind]}},{maxActors:1});
  if(!this.runtime.configs[kind])return false;
  this.canvas=this.doc.createElement('canvas');this.canvas.className='leisure-rig-performer';
  this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label',kind==='deer'?'Deer singer':'Hedgehog musician');
  this.ctx=this.canvas.getContext('2d');if(!this.ctx)return false;
  this.actor={x:0,y:0,facing:1,visible:true,moving:false,path:[],performer:kind,action:'preparing',working:false};
  // Copy only the version gate, not the live session or its clock/actors.
  this.state={version:this.version,time:0,actors:{'performer-activity':this.actor}};
  this.renderer={ctx:this.ctx,width:0,height:0,sx:1,sy:1,top:0,floor:0,spriteScale:1,settings:{},point:(x,y)=>({x,y}),shadow:()=>{}};
  this.media=this.win.matchMedia?.('(prefers-reduced-motion: reduce)');
  this.closed=false;this.update(activity);
  if(!this.draw()){this.close();return false;}
  this.host.replaceChildren(this.canvas);this.doc.addEventListener?.('visibilitychange',this.visibility);this.schedule();return true;
 }
 update(activity){
  if(this.closed)return;
  this.actor.action=leisurePerformerAction(activity);this.actor.working=this.actor.action==='working';
 }
 schedule(){if(!this.closed&&!this.doc?.hidden&&this.frameId===null)this.frameId=this.win.requestAnimationFrame(this.tick);}
 cancelFrame(){if(this.frameId!==null)this.win.cancelAnimationFrame?.(this.frameId);this.frameId=null;}
 draw(){
  if(this.closed)return false;
  const box=this.host.getBoundingClientRect(),width=Math.max(0,box.width),height=Math.max(0,box.height);
  if(!width||!height)return true;
  const dpr=Math.max(1,Math.min(2,this.win.devicePixelRatio||1)),w=Math.round(width*dpr),h=Math.round(height*dpr);
  const reduced=this.isReduced(),stamp=[this.time,width,height,dpr,reduced,this.actor.action].join(':');
  if(this.stamp===stamp)return true;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.ctx.setTransform(dpr,0,0,dpr,0,0);this.ctx.clearRect(0,0,width,height);
  const layout=leisurePerformerLayout(width,height,this.actor.performer);
  this.actor.x=layout.x;this.actor.y=layout.y;
  Object.assign(this.renderer,{width,height,spriteScale:layout.spriteScale});this.renderer.settings.reducedMotion=reduced;
  this.state.time=reduced?0:this.time;this.runtime.beginFrame(this.renderer,this.state);
  const painted=this.runtime.drawActor(this.renderer,'performer-activity',this.actor);if(painted)this.stamp=stamp;
  return painted;
 }
 fail(){this.close();this.onFallback();}
 close(){this.closed=true;this.cancelFrame();this.doc?.removeEventListener?.('visibilitychange',this.visibility);this.runtime?.reset();this.last=null;}
}
