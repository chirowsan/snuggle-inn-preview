import {scrubCoverage,motionCue,isMotionActivity} from './motion-gestures.mjs';
import {applyActivity,cancelActivity,CUISINE_ACTIVITIES,getCookingStage,LEISURE_ACTIVITIES,getLeisureStage} from './hotel-activities.mjs';
import {cuisineSceneArt,cookingToolArt,cookingMotionArt} from './cuisine-art.mjs';
import {leisureSceneArt,leisureToolArt,leisurePropArt,leisureMotionArt,leisurePerformerArt,LEISURE_CUE_PATHS} from './leisure-activity-art.mjs';
import {icon} from './rush-icons.mjs';
import {LeisurePerformerMotion} from './leisure-performer-motion.mjs';
import {nextActivityTap} from './tap-guide.mjs';
import {FINISH_MOTIONS,finishMotionFor,evaluateFinish} from './finish-motions.mjs';
import {NEW_FOOD_ART,ramenArt,pipeBackdrop,fixtureBackdrop,salonBackdrop,spaBackdrop,tuftArt,fastenerArt,tensionArt,serviceBackdrop,serviceTargetArt} from './activity-art.mjs';
const wrap=(body)=>`<svg viewBox="0 0 120 100" aria-hidden="true"><defs><linearGradient id="bread" x2="0" y2="1"><stop stop-color="#f8d68c"/><stop offset=".45" stop-color="#d58d43"/><stop offset="1" stop-color="#95542e"/></linearGradient><radialGradient id="cream"><stop stop-color="#fff9df"/><stop offset="1" stop-color="#d2bd8b"/></radialGradient><linearGradient id="tea" x2="0" y2="1"><stop stop-color="#e8c27b"/><stop offset="1" stop-color="#946137"/></linearGradient></defs>${body}</svg>`;
export const foodArt={
 pastry:wrap('<ellipse cx="60" cy="78" rx="48" ry="10" fill="#704c3033"/><path d="M12 60Q11 37 35 30L45 17Q62 10 77 22L85 33Q113 42 106 66L92 75Q80 57 74 54Q60 48 46 56L28 76Z" fill="url(#bread)" stroke="#9b642f" stroke-width="3"/><path d="M34 31Q27 47 31 64M46 20Q39 35 46 55M62 17Q55 30 62 51M77 25Q71 39 77 56M88 37Q85 48 93 64" fill="none" stroke="#a86732" stroke-width="4"/><path d="M20 49L28 40M49 25L55 22M68 26L73 31M94 44L100 52" stroke="#ffe0a2" stroke-width="4" stroke-linecap="round"/>'),
 cup:wrap('<ellipse cx="56" cy="84" rx="48" ry="11" fill="#ddd0ad" stroke="#a78b59" stroke-width="2"/><path d="M87 32Q117 28 107 57Q99 72 86 62" fill="none" stroke="#eadbb7" stroke-width="10"/><path d="M21 30H91L84 73Q56 88 28 73Z" fill="url(#cream)" stroke="#b9a377" stroke-width="2"/><ellipse cx="56" cy="31" rx="35" ry="12" fill="#efe1be" stroke="#b9a377" stroke-width="2"/><ellipse cx="56" cy="32" rx="29" ry="8" fill="url(#tea)"/><path d="M39 52Q56 61 76 50" fill="none" stroke="#8ca28a" stroke-width="3"/><path d="M45 20Q34 13 43 4M67 20Q56 12 65 3" fill="none" stroke="#f9f2df" stroke-width="3" opacity=".75"/>'),
 fruit:wrap('<ellipse cx="60" cy="73" rx="48" ry="18" fill="#eee3c5" stroke="#b5a77d" stroke-width="2"/><path d="M25 39Q26 22 43 25Q57 18 61 36Q59 56 43 69Q26 58 25 39M56 43Q57 25 76 29Q91 22 96 43Q93 65 77 76Q60 65 56 43" fill="#c86750" stroke="#9a4b3e" stroke-width="2"/><path d="M31 27L42 14 47 27 59 21 52 33 40 29 28 35ZM63 32L75 19 80 32 93 28 86 40 74 35 61 41Z" fill="#75966c" stroke="#54744b" stroke-width="2"/><path d="M34 42L36 46M45 36L47 40M44 53L46 57M66 47L68 51M80 44L82 48M78 61L80 65" stroke="#f9d28b" stroke-width="3" stroke-linecap="round"/>')
};
Object.assign(foodArt,NEW_FOOD_ART);
const pillow=`<svg viewBox="0 0 140 90" aria-hidden="true"><defs><radialGradient id="pillow-fill"><stop stop-color="#fff7dd"/><stop offset="1" stop-color="#cbbd96"/></radialGradient></defs><path d="M15 13Q70 24 126 12Q113 45 127 76Q70 65 14 77Q28 44 15 13Z" fill="url(#pillow-fill)" stroke="#a69776" stroke-width="2"/><path d="M23 22Q70 31 118 21M23 67Q70 59 118 67" stroke="#fff9e5" fill="none" stroke-width="3"/><path d="M33 47Q60 39 82 46" stroke="#c5b690" fill="none" opacity=".7"/></svg>`;
const actionFor = {fixture:'turn',salon:'brush',spa:'soothe'};
const targetArt = {fixture:fastenerArt,salon:tuftArt,spa:tensionArt};
const sceneArt = {pipe:pipeBackdrop,fixture:fixtureBackdrop,salon:salonBackdrop,spa:spaBackdrop};
const labels = {fixture:'Tighten fastener',salon:'Brush tangled tuft',spa:'Relax tension spot'};
const rectEqual=(a,b)=>['left','top','width','height'].every(k=>Math.abs(a[k]-b[k])<1);
const artFor=item=>item==='pillow'?pillow:foodArt[item]||'';
/** Geometry is relative to the live target, so mouse and touch use identical
 * generous paths at phone and tablet sizes. No velocity or timed window. */
export function cookingGestureSatisfied(stage,points,rect,fromTool=false) {
 if(!stage||!Array.isArray(points)||points.length<2||!rect||rect.width<=0||rect.height<=0)return false;
 const p=points.map(v=>({x:(v.x-rect.left)/rect.width,y:(v.y-rect.top)/rect.height}));
 if(p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return false;
 const within=v=>v.x>=-.08&&v.x<=1.08&&v.y>=-.12&&v.y<=1.12;
 const last=p.at(-1),start=p[0];
 if(['drop','pour','plate'].includes(stage.gesture))return fromTool&&within(last)&&Math.hypot(last.x-start.x,last.y-start.y)>=.16;
 // Once a utensil reaches the dish, its path on the dish is what counts.
 const onDish=p.filter(within);if(onDish.length<2||!within(last))return false;
 const first=onDish[0],dx=last.x-first.x,dy=last.y-first.y,unit=Math.min(rect.width,rect.height);
 const px=dx*rect.width/unit,py=dy*rect.height/unit;
 const centered=v=>({x:(v.x-.5)*rect.width/unit,y:(v.y-.5)*rect.height/unit});
 if(stage.gesture==='spread')return Math.abs(px)>=.3&&Math.abs(dy)<.7;
 if(stage.gesture==='roll')return dy<=-.3&&Math.abs(dx)<.7;
 if(stage.gesture==='fold')return px>=.3&&Math.abs(dy)<.75;
 if(stage.gesture==='flip')return dy<=-.34&&Math.abs(dx)<.7;
 if(stage.gesture==='toss')return py<=-.28&&px>=.13;
 if(stage.gesture==='stretch'){
  const radius=v=>{const p=centered(v);return Math.hypot(p.x,p.y);};
  return radius(first)<.6&&radius(last)-radius(first)>=.18;
 }
 if(['stir','swirl'].includes(stage.gesture)){
  let arc=0,travel=0;
  for(let i=1;i<onDish.length;i++){
   const a=centered(onDish[i-1]),b=centered(onDish[i]),ra=Math.hypot(a.x,a.y),rb=Math.hypot(b.x,b.y);
   travel+=Math.hypot(b.x-a.x,b.y-a.y);
   if(ra<.1||rb<.1||ra>1||rb>1)continue;
   let angle=Math.atan2(b.y,b.x)-Math.atan2(a.y,a.x);
   if(angle>Math.PI)angle-=Math.PI*2;if(angle< -Math.PI)angle+=Math.PI*2;
   if(Math.abs(angle)<1.8)arc+=angle;
  }
  return Math.abs(arc)>=2.4&&travel>=.38;
 }
 return false;
}
/** Leisure paths are forgiving, scale-free and never depend on tap speed. */
export function leisureGestureSatisfied(stage,points,rect,fromTool=false) {
 if(!stage||!Array.isArray(points)||points.length<2||!rect||rect.width<=0||rect.height<=0)return false;
 const p=points.map(v=>({x:(v.x-rect.left)/rect.width,y:(v.y-rect.top)/rect.height}));
 if(p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return false;
 const within=v=>v.x>=-.08&&v.x<=1.08&&v.y>=-.12&&v.y<=1.12;
 const last=p.at(-1),start=p[0];
 if(['place','aim'].includes(stage.gesture))return fromTool&&within(last)&&Math.hypot(last.x-start.x,last.y-start.y)>=.18;
 const onTarget=p.filter(within);if(onTarget.length<2||!within(last))return false;
 const first=onTarget[0],dx=last.x-first.x,dy=last.y-first.y;
 if(stage.gesture==='pluck')return Math.abs(dx)>=.38&&Math.abs(dy)<=.6;
 if(stage.gesture==='curtain')return Math.abs(dx)>=.38&&Math.abs(dy)<=.6;
 if(stage.gesture==='conduct')return Math.abs(dx)>=.42&&Math.max(...onTarget.map(v=>v.y))-Math.min(...onTarget.map(v=>v.y))>=.18;
 return false;
}
const leisureTargetBox=(kind,stage)=>kind==='lounge'
 ? stage===0?{x:22,y:24,w:24,h:48}:stage===1?{x:57,y:18,w:35,h:61}:{x:35,y:18,w:55,h:61}
 : stage===0?{x:18,y:25,w:21,h:47}:stage===1?{x:69,y:12,w:20,h:36}:{x:32,y:12,w:40,h:67};
export class ActivityView {
 constructor(root,{onComplete,onSound=()=>{},reducedMotion=()=>false,hints=()=>true,motionBundle=()=>null,sessionVersion=()=>null}) {
  Object.assign(this,{root,onComplete,onSound,reducedMotion,hints,motionBundle,sessionVersion,tapAssist:false,serial:0,token:0,drag:null,suppress:0,selected:null});
  this.resize=()=>{this.cancelGesture();this.positionTapHand();};
  this.blur=()=>this.cancelGesture();
  this.visibility=()=>{if(globalThis.document?.hidden)this.cancelGesture();};
 }
 open(activity) {
  this.leisureMotion?.close();this.leisureMotion=null;
  if(this.activity)cancelActivity(this.activity);
  this.token++;this.activity=activity;this.finishing=false;this.selected=null;this.drag=null;this.suppress=0;this.pending=null;
  this.root.className='activity-board '+activity.kind+(Object.hasOwn(CUISINE_ACTIVITIES,activity.kind)?' cooking':'')+(Object.hasOwn(LEISURE_ACTIVITIES,activity.kind)?' performance-activity':'')+(activity.command.recipe?' recipe-'+activity.command.recipe:'');
  this.build();this.sync();
  globalThis.addEventListener?.('resize',this.resize);globalThis.addEventListener?.('blur',this.blur);globalThis.document?.addEventListener?.('visibilitychange',this.visibility);
  this.observer?.disconnect();
  if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(()=>{if(this.drag&&!rectEqual(this.drag.rect,this.root.getBoundingClientRect()))this.cancelGesture();});this.observer.observe(this.root);}
 }
 close() {
  this.leisureMotion?.close();this.leisureMotion=null;
  this.token++;if(this.activity)cancelActivity(this.activity);this.activity=null;this.pending=null;this.cancelGesture();
  this.observer?.disconnect();globalThis.removeEventListener?.('resize',this.resize);globalThis.removeEventListener?.('blur',this.blur);globalThis.document?.removeEventListener?.('visibilitychange',this.visibility);this.root.replaceChildren();
 }
 act(action) {
  if(!this.activity||this.finishing)return false;
  const next=applyActivity(this.activity,action);if(next===this.activity)return false;
  this.activity=next;
  this.onSound(action.type==='perform'?(this.activity.kind==='lounge'?'strum':action.step==='open-curtain'?'cloth':'tray'):['scrub','scrubTap','brush','soothe'].includes(action.type)?'scrub':this.activity.kind==='bed'?'bed':'tray');
  this.sync();
  if(next.status==='complete'){
   this.finishing=true;this.root.classList.add('complete');const t=this.token;
   setTimeout(()=>{if(t===this.token&&this.activity)this.onComplete(this.activity);},this.reducedMotion()?70:520);
  }
  return true;
 }
 slot(item,i,extra='') {return `<button class="tray-slot slot-${item} position-${i} ${extra}" data-slot="${item}" aria-label="Place ${item.replaceAll('-',' ')} here"><span class="ghost-food">${artFor(item)}</span><span class="placed-food">${artFor(item)}</span><i class="slot-check">${icon('check')}</i></button>`;}
 ingredients(items){return `<div class="ingredients">${items.map((item,i)=>`<button class="ingredient item-${item} position-${i}" data-item="${item}" aria-label="Pick up ${item.replaceAll('-',' ')}">${artFor(item)}</button>`).join('')}</div>`;}
 build() {
  const {kind:k,items}=this.activity;
  if(k==='tray'){
   this.root.innerHTML=`<div class="breakfast-tray"><i class="tray-handle left"></i><i class="tray-handle right"></i>${items.map((item,i)=>this.slot(item,i)).join('')}</div>${this.ingredients(items)}`;
  }else if(k==='ramen'){
   this.root.innerHTML=`<div class="ramen-station"><i class="ramen-chopsticks"></i><div class="ramen-bowl-art">${ramenArt([])}</div><button class="ramen-drop" data-slot="noodles" aria-label="Add noodles to the bowl"><span class="ramen-ingredient-guide">${artFor('noodles')}</span></button></div>${this.ingredients(items)}`;
  }else if(Object.hasOwn(CUISINE_ACTIVITIES,k)){
   this.root.innerHTML=`<div class="cooking-scene"></div><button class="cooking-source" data-cook-tool="" aria-label="Pick up wok" hidden></button><button class="cooking-surface" data-cook-target="" aria-label="Cooking surface"><span class="cooking-motion" aria-hidden="true"></span><span class="cooking-target-mark">${icon('check')}</span></button><button class="cooking-tool" data-cook-tool="" aria-label="Pick up cooking tool"></button><div class="cooking-caption" role="status" aria-live="polite"></div><span class="cooking-link" aria-hidden="true">${icon('arrow')}</span>`;
  }else if(Object.hasOwn(LEISURE_ACTIVITIES,k)){
   this.root.innerHTML=`<div class="leisure-scene"></div><div class="leisure-performer"></div>${k==='theater'?`<div class="leisure-scenery tree">${leisurePropArt('tree',true)}${leisurePropArt('tree')}</div><div class="leisure-scenery moon">${leisurePropArt('moon',true)}${leisurePropArt('moon')}</div><div class="leisure-curtains" aria-hidden="true"><i class="curtain-left"></i><i class="curtain-right"></i><b></b></div>`:''}<button class="leisure-target" data-leisure-target="" aria-label="Performance target"><span class="leisure-motion" aria-hidden="true"></span><span class="leisure-target-mark" aria-hidden="true"></span></button><button class="leisure-tool" data-leisure-tool="" aria-label="Select performance tool"></button><div class="leisure-caption" role="status" aria-live="polite"></div>`;
  }else if(k==='pipe'){
   this.root.innerHTML=`<div class="activity-scene">${serviceBackdrop(k,this.activity.guestKind).replace('<svg','<svg preserveAspectRatio="none"')}</div><div class="pipe-gaps">${items.map((item,i)=>this.slot(item,i,'pipe-gap')).join('')}</div>${this.ingredients(items)}`;
  }else if(actionFor[k]){
   this.root.innerHTML=`<div class="activity-scene">${serviceBackdrop(k,this.activity.guestKind).replace('<svg','<svg preserveAspectRatio="none"')}</div>${[0,1,2].map(i=>`<button class="service-target target-${i}" data-service="${i}" aria-label="${labels[k]} ${i+1}">${serviceTargetArt(k,false,this.activity.guestKind)}<i class="service-check">${icon('check')}</i></button>`).join('')}<div class="service-tool ${k}-tool" aria-hidden="true">${k==='salon'?'<i></i>':k==='fixture'?'↻':'✦'}</div>`;
  }else if(k==='bed'){
   this.root.innerHTML=`<div class="bed-frame"><i class="headboard"></i><div class="mattress"><i class="sheet-center"></i><i class="quilt"></i><i class="sheet-wing wing-left" data-sheet="left"></i><i class="sheet-wing wing-right" data-sheet="right"></i></div><button class="pillow-target" data-slot="pillow" aria-label="Place pillow on bed">${pillow}</button><span class="bed-pillow">${pillow}</span></div><button class="tuck-handle tuck-left" data-tuck="left" aria-label="Tuck left sheet corner">${icon('arrow')}</button><button class="tuck-handle tuck-right" data-tuck="right" aria-label="Tuck right sheet corner">${icon('arrow')}</button><button class="loose-pillow" data-item="pillow" aria-label="Pick up pillow">${pillow}</button>`;
  }else{
   this.root.innerHTML=`<div class="scrub-floor">${[0,1,2].map(i=>`<button class="stain stain-${i}" data-stain="${i}" aria-label="Wipe stain ${i+1}"><svg viewBox="0 0 130 100" aria-hidden="true"><path d="M17 40Q5 10 38 20Q61 0 74 23Q109 11 105 40Q139 58 106 71Q101 99 76 82Q46 107 37 78Q3 86 17 58Q0 46 17 40Z" fill="#a97b4c"/><ellipse cx="61" cy="49" rx="35" ry="22" fill="#8a5f3e" opacity=".4"/><path d="M29 33Q48 18 67 32M35 65L49 69M78 44L94 47" fill="none" stroke="#bd986b" stroke-width="5"/></svg><span class="wipe-clean">${icon('check')}</span><span class="wipe-pips" aria-hidden="true"><i></i><i></i><i></i></span></button>`).join('')}<div class="sponge" aria-hidden="true"><i></i></div></div>`;
  }
  this.root.insertAdjacentHTML('beforeend',`<div class="activity-hand" aria-hidden="true">${icon('hand')}<b>Tap</b></div><div class="activity-drag" hidden></div>`);
  this.root.onpointerdown=e=>this.down(e);this.root.onpointermove=e=>this.move(e);this.root.onpointerup=e=>this.up(e);
  this.root.onpointercancel=()=>this.cancelGesture();this.root.onlostpointercapture=()=>{if(this.drag)this.cancelGesture();};
  this.root.onclick=e=>this.click(e);
  if(isMotionActivity(this.activity.kind)){this.root.insertAdjacentHTML('beforeend','<button class="motion-assist" aria-pressed="false">Tap assist</button><div class="motion-caption" aria-live="polite"></div>');}
 }
 click(e) {
  if(!this.activity||this.finishing)return;
  if(e.target.closest('.motion-assist')){this.cancelGesture();this.pending=null;this.tapAssist=!this.tapAssist;this.selected=null;this.sync();return;}
  if(performance.now()<this.suppress)return;
  if(isMotionActivity(this.activity.kind)&&!this.tapAssist)return;
  const leisureTool=e.target.closest('[data-leisure-tool]'),leisureTarget=e.target.closest('[data-leisure-target]'),leisureStage=getLeisureStage(this.activity);
  if(leisureTool&&leisureStage&&!leisureTool.disabled){this.selected=leisureStage.tool;this.sync();return;}
  if(leisureTarget&&leisureStage&&!leisureTarget.disabled){if(this.selected===leisureStage.tool){this.selected=null;if(this.act({type:'perform',step:leisureStage.id,gestureId:'tap'+(++this.serial)}))this.suppress=performance.now()+170;}else this.nudgeLeisure(true);return;}
  const cookTool=e.target.closest('[data-cook-tool]'),cookTarget=e.target.closest('[data-cook-target]');
  const stage=getCookingStage(this.activity);
  if(cookTool&&stage&&!cookTool.disabled){this.selected=stage.tool;this.sync();return;}
  if(cookTarget&&stage&&!cookTarget.disabled){if(this.selected===stage.tool){this.selected=null;if(this.act({type:'cook',step:stage.id,gestureId:'tap'+(++this.serial)}))this.suppress=performance.now()+170;}else this.nudgeCooking(true);return;}
  const tuck=e.target.closest('[data-tuck],[data-sheet]'),stain=e.target.closest('[data-stain]'),item=e.target.closest('[data-item]'),slot=e.target.closest('[data-slot]'),target=e.target.closest('[data-service]');
  let accepted=false;
  if(tuck&&!tuck.disabled)accepted=this.act({type:'tuck',side:tuck.dataset.tuck||tuck.dataset.sheet});
  if(stain&&!stain.disabled)accepted=this.act({type:'scrubTap',stain:+stain.dataset.stain,gestureId:'tap'+(++this.serial)});
  if(target&&!target.disabled)accepted=this.act({type:actionFor[this.activity.kind],index:+target.dataset.service,gestureId:'tap'+(++this.serial)});
  if(item&&!item.disabled){this.selected=item.dataset.item;this.sync();}
  if(slot&&!slot.disabled&&this.selected){accepted=this.act(this.selected==='pillow'&&slot.dataset.slot==='pillow'?{type:'pillow'}:{type:'place',item:this.selected,slot:slot.dataset.slot});if(accepted)this.selected=null;this.sync();}
  // A click is a complete accessibility gesture, not a tap-rate challenge.
  if(accepted)this.suppress=performance.now()+170;
 }
 down(e) {
  if(e.button!==0||this.drag||this.finishing||!this.activity)return;
  // A new physical pointer gesture must not be swallowed by the preceding
  // drag's synthetic-click guard. The synthetic click has no new down event.
  this.suppress=0;
  this.root.classList?.remove('cooking-retry','cooking-pick-tool','leisure-retry','leisure-pick-tool');
  if(this.pending){if(!e.target.closest('.motion-assist')){this.root.classList?.remove('finish-retry');this.drag={id:e.pointerId,finish:true,x:e.clientX,y:e.clientY,moved:false,rect:this.root.getBoundingClientRect(),pts:[{x:e.clientX,y:e.clientY,t:performance.now()}]};this.root.classList?.add('finish-working');e.target.setPointerCapture?.(e.pointerId);return;}this.pending=null;this.sync();}
  const leisureTool=e.target.closest('[data-leisure-tool]'),leisureTarget=e.target.closest('[data-leisure-target]'),leisureStage=getLeisureStage(this.activity);
  const cookTool=e.target.closest('[data-cook-tool]'),cookTarget=e.target.closest('[data-cook-target]');
  const stage=getCookingStage(this.activity);
  const item=e.target.closest('[data-item]'),tuck=e.target.closest('[data-tuck],[data-sheet]'),stain=e.target.closest('[data-stain]'),sponge=e.target.closest('.sponge'),service=e.target.closest('[data-service]');
  const hit=leisureTool||leisureTarget||cookTool||cookTarget||item||tuck||stain||sponge||service;if(!hit||hit.disabled)return;
  const b=hit.getBoundingClientRect();
  this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,travel:0,moved:false,item:item?.dataset.item,tuck:tuck?.dataset.tuck||tuck?.dataset.sheet,stain:stain?+stain.dataset.stain:null,scrubbing:!!stain||!!sponge,service:service?+service.dataset.service:null,rect:this.root.getBoundingClientRect(),targetRect:b,start:performance.now(),sectors:new Map(),scrubPoints:[{x:e.clientX,y:e.clientY}],arc:0,lastAngle:Math.atan2(e.clientY-(b.top+b.height/2),e.clientX-(b.left+b.width/2))};
  if(leisureStage&&(leisureTool||leisureTarget)){
   Object.assign(this.drag,{leisureStep:leisureStage.id,leisureFromTool:!!leisureTool,leisureRect:this.root.querySelector('.leisure-target').getBoundingClientRect(),leisurePoints:[{x:e.clientX,y:e.clientY}]});
   this.root.classList.add('leisure-working');
  }
  if(stage&&(cookTool||cookTarget)){
   Object.assign(this.drag,{cookStep:stage.id,cookFromTool:!!cookTool,cookRect:this.root.querySelector('.cooking-surface').getBoundingClientRect(),cookPoints:[{x:e.clientX,y:e.clientY}]});
   this.root.classList.add('cooking-working');
  }
  hit.setPointerCapture?.(e.pointerId);
  if(service)this.root.querySelector('.service-tool')?.classList.add('working');
 }
 move(e) {
  const d=this.drag;if(!d||e.pointerId!==d.id)return;
  if(!rectEqual(d.rect,this.root.getBoundingClientRect())){this.cancelGesture();return;}
  if(d.finish){if(d.pts.length<400)d.pts.push({x:e.clientX,y:e.clientY,t:performance.now()});const cue=this.root.querySelector('.finish-cue');if(cue){cue.style.setProperty('--fx',(e.clientX-d.x)*.35+'px');cue.style.setProperty('--fy',(e.clientY-d.y)*.35+'px');}return;}
  d.travel+=Math.hypot(e.clientX-d.lastX,e.clientY-d.lastY);d.lastX=e.clientX;d.lastY=e.clientY;
  if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>7)d.moved=true;
  if(!d.moved)return;
  if(d.leisureStep){
   if(d.leisurePoints.length<300)d.leisurePoints.push({x:e.clientX,y:e.clientY});else d.leisurePoints[d.leisurePoints.length-1]={x:e.clientX,y:e.clientY};
   const ghost=this.root.querySelector('.activity-drag'),stage=getLeisureStage(this.activity);
   if(stage&&stage.id===d.leisureStep){ghost.innerHTML=leisureToolArt(stage.tool);ghost.hidden=false;ghost.style.left=(e.clientX-d.rect.left)+'px';ghost.style.top=(e.clientY-d.rect.top)+'px';}
   if(stage?.gesture==='curtain')this.root.style.setProperty('--curtain-pull',Math.min(1,Math.abs(e.clientX-d.x)/d.leisureRect.width)+'');
  }else if(d.cookStep){
   if(d.cookPoints.length>=300)d.cookPoints=d.cookPoints.filter((_,i)=>i%2===0||i===d.cookPoints.length-1);
   d.cookPoints.push({x:e.clientX,y:e.clientY});
   const ghost=this.root.querySelector('.activity-drag'),stage=getCookingStage(this.activity);
   if(stage&&stage.id===d.cookStep){ghost.innerHTML=cookingToolArt(stage.tool);ghost.hidden=false;ghost.style.left=(e.clientX-d.rect.left)+'px';ghost.style.top=(e.clientY-d.rect.top)+'px';}
   this.root.style.setProperty('--cook-lean',Math.max(-12,Math.min(12,(e.clientX-d.x)/8))+'deg');
  }else if(d.scrubbing){
   d.scrubPoints.push({x:e.clientX,y:e.clientY});
   for(const el of this.root.querySelectorAll('[data-stain]')){const stain=+el.dataset.stain,coverage=[0,1,2].filter(sector=>!this.activity.scrub[stain].includes(sector)).slice(0,scrubCoverage(d.scrubPoints,el.getBoundingClientRect()).length);
    for(const sector of coverage)d.sectors.set(`${stain}:${sector}`,{type:'scrub',stain,sector});
    const total=new Set([...this.activity.scrub[stain],...coverage]).size;el.style.setProperty('--dirt',1-total/3);
   }
   const r=d.rect,s=this.root.querySelector('.sponge');s.style.left=(e.clientX-r.left)+'px';s.style.top=(e.clientY-r.top)+'px';s.classList.add('wiping');
  }else if(d.item){const ghost=this.root.querySelector('.activity-drag');ghost.innerHTML=artFor(d.item);ghost.hidden=false;ghost.style.left=(e.clientX-d.rect.left)+'px';ghost.style.top=(e.clientY-d.rect.top)+'px';}
  else if(d.service!==null){
   const b=d.targetRect,angle=Math.atan2(e.clientY-(b.top+b.height/2),e.clientX-(b.left+b.width/2));
   let delta=angle-d.lastAngle;if(delta>Math.PI)delta-=Math.PI*2;if(delta< -Math.PI)delta+=Math.PI*2;d.arc+=delta;d.lastAngle=angle;
   const tool=this.root.querySelector('.service-tool');tool.style.left=(e.clientX-d.rect.left)+'px';tool.style.top=(e.clientY-d.rect.top)+'px';
  }
 }
 up(e) {
  const d=this.drag;if(!d||e.pointerId!==d.id)return;
  if(!rectEqual(d.rect,this.root.getBoundingClientRect())){this.cancelGesture();return;}
  this.drag=null;this.root.classList.remove('cooking-working','leisure-working');this.root.style.setProperty('--curtain-pull','0');this.root.querySelector('.activity-drag').hidden=true;this.root.querySelector('.sponge')?.classList.remove('wiping');this.root.querySelector('.service-tool')?.classList.remove('working');
  if(d.finish){this.root.classList.remove('finish-working');this.finishGesture(d,e);return;}
  const heldSpa=d.service!==null&&this.activity.kind==='spa'&&performance.now()-d.start>=400;
  if(!d.moved&&!heldSpa)return;
  this.suppress=performance.now()+400;
  if(d.leisureStep){
   const stage=getLeisureStage(this.activity),surface=this.root.querySelector('.leisure-target');
   if(stage?.id===d.leisureStep&&rectEqual(d.leisureRect,surface.getBoundingClientRect())){
    if(leisureGestureSatisfied(stage,[...d.leisurePoints,{x:e.clientX,y:e.clientY}],d.leisureRect,d.leisureFromTool)){this.selected=null;this.act({type:'perform',step:stage.id,gestureId:'drag'+(++this.serial)});}
    else this.nudgeLeisure();
   }
  }else if(d.cookStep){
   const stage=getCookingStage(this.activity),surface=this.root.querySelector('.cooking-surface');
   if(stage?.id===d.cookStep&&rectEqual(d.cookRect,surface.getBoundingClientRect())){
    if(cookingGestureSatisfied(stage,[...d.cookPoints,{x:e.clientX,y:e.clientY}],d.cookRect,d.cookFromTool)){this.selected=null;this.act({type:'cook',step:stage.id,gestureId:'drag'+(++this.serial)});}
    else this.nudgeCooking();
   }
  }else if(d.tuck){const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dy)<110&&(d.tuck==='left'?dx>28:dx< -28))this.act({type:'tuck',side:d.tuck});}
  else if(d.item&&['tray','ramen'].includes(this.activity.kind)&&finishMotionFor(d.item)&&(()=>{const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');return slot&&this.root.contains(slot)&&!slot.disabled&&slot.dataset.slot===d.item&&!this.activity.steps.includes(d.item);})()){this.selected=null;this.pending={item:d.item,motion:finishMotionFor(d.item),count:0};this.onSound('tray');this.sync();}
  else if(d.item){const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');const accepted=slot&&this.root.contains(slot)&&!slot.disabled&&this.act(d.item==='pillow'&&slot.dataset.slot==='pillow'?{type:'pillow'}:{type:'place',item:d.item,slot:slot.dataset.slot});this.selected=accepted?null:d.item;this.sync();}
  else if(d.scrubbing){const r=d.rect;if(e.clientX>=r.left&&e.clientX<=r.left+r.width&&e.clientY>=r.top&&e.clientY<=r.top+r.height){for(const action of d.sectors.values())this.act(action);}this.sync();}
  else if(d.service!==null){
   const b=d.targetRect,inside=e.clientX>=b.left-12&&e.clientX<=b.right+12&&e.clientY>=b.top-12&&e.clientY<=b.bottom+12;
   const meaningful=this.activity.kind==='fixture'?Math.abs(d.arc)>=.42&&d.travel>=14:this.activity.kind==='salon'?d.travel>=22:heldSpa||d.travel>=24;
   if(inside&&meaningful)this.act({type:actionFor[this.activity.kind],index:d.service,gestureId:'drag'+(++this.serial)});
  }
 }
 finishGesture(d,e){
  const p=this.pending;if(!p||!this.activity)return;
  d.pts.push({x:e.clientX,y:e.clientY,t:performance.now()});this.suppress=performance.now()+400;
  const r=evaluateFinish(p.motion,d.pts,p.count);
  const cue=this.root.querySelector('.finish-cue');cue?.style.setProperty('--fx','0px');cue?.style.setProperty('--fy','0px');
  if(!r.done){p.count=r.count;if(r.count===0||FINISH_MOTIONS[p.motion].taps===0){this.root.classList.remove('finish-retry');void this.root.offsetWidth;this.root.classList.add('finish-retry');}else this.onSound('tray');this.sync();return;}
  this.pending=null;const accepted=this.act({type:'place',item:p.item,slot:p.item});
  const slot=this.root.querySelector(this.activity.kind==='ramen'?'.ramen-bowl-art':'.slot-'+p.item);
  if(accepted&&slot&&!this.reducedMotion()){slot.classList.remove('finish-'+p.motion);void slot.offsetWidth;slot.classList.add('finish-done','finish-'+p.motion);setTimeout(()=>slot.classList?.remove('finish-done','finish-'+p.motion),700);}
  this.sync();
 }
 syncFinish(){
  let cue=this.root.querySelector('.finish-cue');const p=this.pending;
  this.root.querySelectorAll('.awaiting-finish').forEach(el=>el.classList.remove('awaiting-finish'));
  this.root.classList.toggle('finish-pending',!!p);
  if(!p){if(cue)cue.hidden=true;return;}
  const m=FINISH_MOTIONS[p.motion],slot=this.root.querySelector(this.activity.kind==='ramen'?'.ramen-drop':'.slot-'+p.item);
  if(!cue){this.root.insertAdjacentHTML('beforeend','<div class="finish-cue" aria-live="polite"></div>');cue=this.root.querySelector('.finish-cue');}
  slot?.classList.add('awaiting-finish','next');this.root.querySelector('.item-'+p.item)?.classList.add('used');
  cue.hidden=false;cue.dataset.motion=p.motion;
  const dots=m.taps?`<b class="finish-dots">${Array.from({length:m.taps},(_,i)=>`<i class="${i<p.count?'done':''}"></i>`).join('')}</b>`:'';
  cue.innerHTML=`<span class="finish-food">${artFor(p.item)}</span><span class="finish-gesture" aria-hidden="true">${m.cue}</span><span class="finish-label">${m.label}</span>${dots}`;
  const rr=this.root.getBoundingClientRect?.(),sr=slot?.getBoundingClientRect?.();
  if(rr&&sr&&rr.width){cue.style.left=Math.max(70,Math.min(rr.width-70,sr.left-rr.left+sr.width/2))+'px';cue.style.top=Math.max(60,Math.min(rr.height-50,sr.top-rr.top+sr.height/2))+'px';}
 }
 nudgeLeisure(pickTool=false){this.root.classList.remove('leisure-retry','leisure-pick-tool');void this.root.offsetWidth;this.root.classList.add(pickTool?'leisure-pick-tool':'leisure-retry');}
 nudgeCooking(pickTool=false){this.root.classList.remove('cooking-retry','cooking-pick-tool');void this.root.offsetWidth;this.root.classList.add(pickTool?'cooking-pick-tool':'cooking-retry');}
 cancelGesture(){if(this.drag)this.suppress=performance.now()+400;this.drag=null;this.root.classList.remove('cooking-working','leisure-working');this.root.style?.setProperty('--curtain-pull','0');const g=this.root.querySelector('.activity-drag');if(g)g.hidden=true;this.root.querySelector('.sponge')?.classList.remove('wiping');this.root.querySelector('.service-tool')?.classList.remove('working');if(this.activity?.kind==='scrub')for(const el of this.root.querySelectorAll('[data-stain]'))el.style.setProperty('--dirt',1-this.activity.scrub[+el.dataset.stain].length/3);}
 positionTapHand(){
  const hand=this.root.querySelector('.activity-hand'),target=this.root.querySelector('.next');
  if(!hand)return;hand.hidden=!this.hints()||!target||this.activity?.status!=='active'||(isMotionActivity(this.activity?.kind)&&!this.tapAssist);
  if(target){const b=target.getBoundingClientRect(),r=this.root.getBoundingClientRect();hand.style.left=Math.min(r.width-42,b.left-r.left+b.width*.55)+'px';hand.style.top=Math.min(r.height-60,b.top-r.top+b.height*.45)+'px';}
 }
 syncPerformer(activity){
  const host=this.root.querySelector('.leisure-performer');
  const fallback=()=>{if(this.activity)host.innerHTML=leisurePerformerArt(this.activity.performer,this.activity.status==='complete',globalThis.document?.documentElement?.dataset?.release||'');};
  if(this.leisureMotion){if(this.leisureMotion.closed)fallback();else this.leisureMotion.update(activity);return;}
  fallback();
  const motion=new LeisurePerformerMotion(host,{bundle:this.motionBundle(),version:this.sessionVersion(),reducedMotion:this.reducedMotion,onFallback:fallback});
  if(motion.open(activity))this.leisureMotion=motion;
 }
 sync() {
  if(!this.activity)return;const a=this.activity,steps=a.steps;
  this.root.querySelector('.activity-hand').hidden=!this.hints()||a.status!=='active';this.root.dataset.progress=a.progress;
  this.root.querySelectorAll('.next,.chosen').forEach(e=>e.classList.remove('next','chosen'));
  this.root.classList.remove('cooking-retry','cooking-pick-tool','leisure-retry','leisure-pick-tool');
  if(a.kind==='bed'){
   this.root.classList.toggle('tucked-left',steps.includes('left'));this.root.classList.toggle('tucked-right',steps.includes('right'));this.root.classList.toggle('pillow-done',steps.includes('pillow'));this.root.classList.toggle('pillow-ready',steps.includes('right'));
   for(const side of ['left','right'])this.root.querySelector(`[data-tuck="${side}"]`).disabled=steps.includes(side)||(side==='right'&&!steps.includes('left'));
   this.root.querySelector('.loose-pillow').disabled=!steps.includes('right')||steps.includes('pillow');
   const next=!steps.includes('left')?'.tuck-left':!steps.includes('right')?'.tuck-right':'.loose-pillow';this.root.querySelector(next).classList.add('next');this.root.dataset.next=next.slice(1);if(this.selected==='pillow')this.root.querySelector('.pillow-target').classList.add('next');
  }else if(['tray','pipe','ramen'].includes(a.kind)){
   for(const item of a.items){const done=steps.includes(item),slot=this.root.querySelector('.slot-'+item),ingredient=this.root.querySelector('.item-'+item);slot?.classList.toggle('filled',done);if(slot)slot.disabled=done;ingredient.classList.toggle('used',done);ingredient.disabled=done||(a.kind==='ramen'&&item!==a.items[steps.length]);}
   const next=this.selected||a.items.find(x=>!steps.includes(x));
   if(a.kind==='ramen'){
    this.root.querySelector('.ramen-bowl-art').innerHTML=ramenArt(steps);
    const item=a.items[steps.length],drop=this.root.querySelector('.ramen-drop');drop.dataset.slot=item||'';drop.disabled=!item;drop.classList.toggle('next',!!item);drop.setAttribute('aria-label',item?`Add ${item} to the bowl`:'Ramen ready');drop.querySelector('.ramen-ingredient-guide').innerHTML=item?artFor(item):'';
   }
   if(next){this.root.querySelector('.item-'+next)?.classList.add(this.selected?'chosen':'next');this.root.querySelector('.slot-'+next)?.classList.add('next');this.root.dataset.next=String(a.items.indexOf(next));}
  }else if(Object.hasOwn(CUISINE_ACTIVITIES,a.kind)){
   const stage=getCookingStage(a),surface=this.root.querySelector('.cooking-surface'),tool=this.root.querySelector('.cooking-tool'),source=this.root.querySelector('.cooking-source');
   this.root.dataset.cookingStage=String(steps.length);this.root.dataset.gesture=stage?.gesture||'done';
   this.root.querySelector('.cooking-scene').innerHTML=cuisineSceneArt(a.kind,steps.length);
   this.root.querySelector('.cooking-caption').textContent=stage?(this.tapAssist?(this.selected===stage.tool?'Tap '+stage.target:'Tap the tool'):motionCue(stage)):CUISINE_ACTIVITIES[a.kind].name;
   surface.disabled=!stage;tool.disabled=!stage;surface.dataset.cookTarget=stage?.id||'';tool.dataset.cookTool=stage?.tool||'';
   tool.innerHTML=stage?cookingToolArt(stage.tool):'';
   const plating=stage?.gesture==='plate';tool.hidden=plating;source.hidden=!plating;source.disabled=!stage;source.dataset.cookTool=stage?.tool||'';source.setAttribute('aria-label',stage?this.tapAssist?`Select tool: ${stage.label}, then tap ${stage.target}`:`Drag to ${stage.target}: ${stage.label}`:'Dish ready');
   surface.querySelector('.cooking-motion').innerHTML=stage?cookingMotionArt(stage.gesture):'';
   surface.setAttribute('aria-label',stage?this.tapAssist?`${stage.label}; select tool then tap here`:`${motionCue(stage)}. Tap assist available`:'Dish ready');
   tool.setAttribute('aria-label',stage?this.tapAssist?`Select tool: ${stage.label}, then tap ${stage.target}`:`Drag to ${stage.target}: ${stage.label}`:'Dish ready');
   this.root.classList.toggle('cooking-selected',!!stage&&this.selected===stage.tool);
   if(stage){const carried=['drop','pour','plate'].includes(stage.gesture);if(this.selected===stage.tool){(plating?source:tool).classList.add('chosen');surface.classList.add('next');}else (carried?(plating?source:tool):surface).classList.add('next');}
  }else if(Object.hasOwn(LEISURE_ACTIVITIES,a.kind)){
   const stage=getLeisureStage(a),surface=this.root.querySelector('.leisure-target'),tool=this.root.querySelector('.leisure-tool'),n=steps.length,box=leisureTargetBox(a.kind,Math.min(n,2));
   this.root.dataset.leisureStage=String(n);this.root.dataset.gesture=stage?.gesture||'done';
   this.root.querySelector('.leisure-scene').innerHTML=leisureSceneArt(a.kind,n);
   this.syncPerformer(a);
   this.root.querySelector('.leisure-caption').textContent=stage?(this.selected===stage.tool?'Tap '+stage.target:'Tap the tool'):LEISURE_ACTIVITIES[a.kind].name;
   if(a.kind==='theater')for(const [i,prop] of ['tree','moon'].entries())this.root.querySelector('.leisure-scenery.'+prop).classList.toggle('placed',n>i);
   Object.assign(surface.style,{left:box.x+'%',top:box.y+'%',width:box.w+'%',height:box.h+'%'});
   surface.disabled=!stage;tool.disabled=!stage;surface.dataset.leisureTarget=stage?.id||'';tool.dataset.leisureTool=stage?.tool||'';
   tool.innerHTML=stage?leisureToolArt(stage.tool):'';
   surface.querySelector('.leisure-motion').innerHTML=stage?leisureMotionArt(stage.gesture):'';
   surface.setAttribute('aria-label',stage?`${stage.label}; select the ${stage.tool.replaceAll('-',' ')}, then tap here. Dragging is optional`:'Performance ready');
   tool.setAttribute('aria-label',stage?`Select ${stage.tool.replaceAll('-',' ')}, then tap the ${stage.target}`:'Performance ready');
   this.root.classList.toggle('leisure-selected',!!stage&&this.selected===stage.tool);
   if(stage){
    const carry=['place','aim'].includes(stage.gesture),selected=this.selected===stage.tool;
    (selected?surface:carry?tool:surface).classList.add('next');if(selected)tool.classList.add('chosen');
    const local=LEISURE_CUE_PATHS[stage.gesture],points=local?local.map(([x,y])=>[box.x+x*box.w,box.y+y*box.h]):[[12,82],[(12+box.x+box.w*.5)/2,(82+box.y+box.h*.5)/2],[box.x+box.w*.5,box.y+box.h*.5]];
    for(const [i,[x,y]] of points.entries()){this.root.style.setProperty('--leisure-cue-x'+i,x+'%');this.root.style.setProperty('--leisure-cue-y'+i,y+'%');}
   }
  }else if(actionFor[a.kind]){
   let first=null;
   for(let i=0;i<3;i++){const el=this.root.querySelector('.target-'+i),done=steps.includes(`${actionFor[a.kind]}-${i}`);el.classList.toggle('done',done);el.disabled=done;el.innerHTML=serviceTargetArt(a.kind,done,a.guestKind)+`<i class="service-check">${icon('check')}</i>`;if(!done&&first===null)first=i;}
   this.root.dataset.next=String(first??2);if(first!==null)this.root.querySelector('.target-'+first).classList.add('next');
  }else{
   for(let i=0;i<3;i++){const count=a.scrub[i].length,el=this.root.querySelector('.stain-'+i);el.style.setProperty('--dirt',1-count/3);el.classList.toggle('clean',count===3);el.disabled=count===3;el.querySelectorAll('.wipe-pips i').forEach((pip,n)=>pip.classList.toggle('done',n<count));}
   const next=[0,1,2].find(i=>a.scrub[i].length<3);this.root.dataset.next=String(next??2);if(next!==undefined)this.root.querySelector('.stain-'+next).classList.add('next');
  }
  this.root.querySelectorAll('.next').forEach(el=>el.classList.remove('next'));
  const stage=getCookingStage(a);
  const next=stage&&!this.tapAssist?(['drop','pour','plate'].includes(stage.gesture)?stage.gesture==='plate'?'.cooking-source':'.cooking-tool':'.cooking-surface'):nextActivityTap(a,this.selected,stage,getLeisureStage(a));
  this.root.classList.toggle('motion-primary',isMotionActivity(a.kind)&&!this.tapAssist);
  const assist=this.root.querySelector('.motion-assist');if(assist){assist.setAttribute('aria-pressed',String(this.tapAssist));assist.textContent=this.tapAssist?'Use motions':'Tap assist';}
  const caption=this.root.querySelector('.motion-caption');if(caption)caption.textContent=a.status!=='active'||stage?'':this.tapAssist?(a.kind==='scrub'?'Tap each patch to wipe':'Tap an item, then its place'):a.kind==='scrub'?'Rub each patch back and forth':this.pending?FINISH_MOTIONS[this.pending.motion].label:'Drag each ingredient to its place';
  this.syncFinish();
  this.root.querySelector(next||'.no-next-target')?.classList.add('next');
  if(this.selected)this.root.querySelector(`[data-item="${this.selected}"]`)?.classList.add('chosen');
  this.positionTapHand();
  const p=document.getElementById('activity-progress');if(p){p.setAttribute('aria-label',Math.floor(a.progress*3)+' of 3 complete');p.innerHTML=Array.from({length:3},(_,i)=>`<i class="${a.progress>=(i+1)/3-.001?'done':''}">${a.progress>=(i+1)/3-.001?icon('check'):''}</i>`).join('');}
 }
}
