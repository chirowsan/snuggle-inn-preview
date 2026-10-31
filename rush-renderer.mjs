import {prepareIsometricService,drawIsometricService} from './room-isometric-gameplay.mjs';
import {drawEditableRoomFloor} from './hotel-room-layout-paint.mjs';
import {drawConstruction} from './construction-view.mjs';
import {drawPressAccessories} from './hotel-reputation-view.mjs';
import {drawHotelWeather} from './hotel-weather.mjs';
import {GuestPresentation} from './rush-guest-view.mjs';
import {REVIEW_BOX_VIEW,reviewBoxSlotOffset} from './variety-view.mjs';
import {createAnimalMotionRuntime} from './animal-motion-runtime.mjs';
import {HotelRenderer} from './renderer.mjs';
import {drawInsideDecor,drawInsideAmbience} from './inside-ambience.mjs';
import {floorOf,FLOOR_HEIGHT} from './rush-floors.mjs';
export class RushRenderer extends HotelRenderer {
 setAnimalMotion(bundle,options={}){this.animalMotion?.reset();this.animalMotion=createAnimalMotionRuntime(bundle,options);return this.animalMotion;}
 resize(){super.resize();this.animalMotion?.reset();this.cutawayMotion?.reset();this.cutawayCamera=null;this.cutawayPan=null;this.stageViewport(false);this.floor??=0;}
 stageViewport(cutaway=false){const portrait=this.height>this.width&&this.width<=650;this.top=portrait?76:46;this.bottom=portrait?150:84;const available=Math.max(190,this.height-this.top-this.bottom);this.stageHeight=portrait&&!cutaway?Math.min(available,this.width*700/1200):available;if(portrait&&!cutaway)this.top+=(available-this.stageHeight)/2;this.sx=this.width/1200;this.sy=this.stageHeight/700;this.spriteScale=Math.max(.4,Math.min(this.width/1450,this.stageHeight/600));}
 point(x,y){if(this.cutawayCamera&&this.floor===1)return this.cutawayPoint(x,y);return{x:x*this.sx,y:this.top+(y+(this.floor||0)*FLOOR_HEIGHT)*this.sy};}
 elevatedPoint(x,y,z=0){if(this.cutawayCamera&&this.floor===1){const p=this.point(x,y);return {...p,y:p.y-z*this.cutawayCamera.scale};}return super.elevatedPoint(x,y,z);}
 prepareCutaway(state){return prepareIsometricService(this,state);}
 guestAnchor(a){return this.guestPresentation?.anchor(a)||{x:a.x,y:a.y};}
 visibleOnFloor(a){const supplied=this.animalMotion?.stairAdapter?.visibleOnFloor?.(this,a,this.animalMotion.session);if(supplied!==null&&supplied!==undefined)return supplied;const y=a.y+(this.floor||0)*FLOOR_HEIGHT;return y>=-45&&y<=745;}
 draw(state,dt=0){this.criticGuestId=state.reputation?.criticGuestId;this.criticRevealed=!!state.reputation?.article;this.guestPresentation??=new GuestPresentation();const departures=this.guestPresentation.update(state,dt);this.now+=dt;if(this.prepareCutaway(state)){drawIsometricService(this,state,dt,departures);return;}this.animalMotion?.beginFrame(this,state,{visualActors:departures});const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#143b32';c.fillRect(0,0,this.width,this.height);const bg=this.images[this.height>this.width&&this.width<=650?this.art.background.path:this.art.background.widePath],wing=this.images['assets/rush-wing.webp'],serviceWing=this.images[this.extraArt?.serviceWing],leisureWing=this.images[this.leisureArt?.floor];c.save();c.beginPath();c.rect(0,this.top,this.width,this.stageHeight);c.clip();
 if(this.floor===0){if(bg)c.drawImage(bg,0,this.top,this.width,this.stageHeight);}else if(this.floor===4&&leisureWing){c.drawImage(leisureWing,0,this.top,this.width,this.stageHeight);this.drawLeisureVenues(state);}else if(this.floor===3&&serviceWing){c.drawImage(serviceWing,0,this.top,this.width,this.stageHeight);this.drawCuisineInterior(state);for(const [id,f]of Object.entries(state.facilities||{})){if(f.floor!==3||f.level)continue;const cx={restaurant:182,salon:490,spa:800}[id];c.save();c.beginPath();c.roundRect((cx-110)*this.sx,this.top+45*this.sy,220*this.sx,265*this.sy,[70*this.sx,70*this.sx,0,0]);c.clip();c.fillStyle='#37594b';c.fillRect((cx-110)*this.sx,this.top+45*this.sy,220*this.sx,265*this.sy);for(let y=55;y<320;y+=16){c.fillStyle=y%32?'#59705a':'#244a40';c.fillRect((cx-110)*this.sx,this.top+y*this.sy,220*this.sx,4*this.sy);}c.restore();}}else if(wing){c.drawImage(wing,0,wing.height*.44,wing.width,wing.height*.56,0,this.top,this.width,this.stageHeight);c.drawImage(wing,0,0,wing.width*.5,wing.height,50*this.sx,this.top,900*this.sx,this.stageHeight);c.drawImage(wing,0,0,wing.width*.0278,wing.height,0,this.top,50*this.sx,this.stageHeight);}
 if(this.floor>0&&this.floor<3&&wing){c.drawImage(wing,0,0,85,320,930*this.sx,this.top,40*this.sx,300*this.sy);c.fillStyle='#a37f43';c.fillRect(950*this.sx,this.top+290*this.sy,9*this.sx,410*this.sy);c.fillStyle='#34685a';c.fillRect(952*this.sx,this.top+290*this.sy,4*this.sx,410*this.sy);c.fillStyle='#e5c67e';c.fillRect(958*this.sx,this.top+290*this.sy,2*this.sx,410*this.sy);}
 drawEditableRoomFloor(this,state);
 if(this.weather){c.save();c.translate(0,this.top);c.scale(this.sx,this.sy);drawHotelWeather(c,this.weather,{floor:this.floor,reducedMotion:this.settings?.reducedMotion});c.restore();}
 const stairs=this.images['assets/stair-flight.webp'];if(stairs&&!this.animalMotion?.stairAdapter?.drawBackground?.(this,state)){for(let f=(state.version>=6&&state.config.leisure?.lounge?3:2);f>=0;f--){const localY= -205+(this.floor-f)*FLOOR_HEIGHT;c.drawImage(stairs,910*this.sx,this.top+localY*this.sy,250*this.sx,808*this.sy);}}
 drawConstruction(this,this.construction,state);drawInsideDecor(this,state);
 const items=[];if(this.floor===4){for(const id of ['lounge','theater']){const f=state.facilities?.[id];if(f?.level)items.push({id:'performer-'+id,type:'actor',x:id==='lounge'?198:660,y:(id==='lounge'?240:247)-2800,visible:true,performer:f.performer||'hedgehog',working:f.status==='servicing'});}}if(this.floor===3&&state.config.chefLevel){items.push({id:'chef',type:'actor',x:190,y:-1770,visible:true,working:state.kitchen.status==='cooking'||state.facilities?.restaurant?.status==='servicing'});}if(this.floor===0){items.push({id:'fountain',x:850,y:415,type:'prop'},{id:'cart',...state.objects.cart,type:'prop'});}for(const[id,a]of Object.entries(state.actors)){const view=id.startsWith('guest-')?{...a,...this.guestAnchor(a)}:a;if(this.visibleOnFloor(view))items.push({id,...view,type:'actor'});}for(const a of departures){const y=a.y+(this.floor||0)*FLOOR_HEIGHT;if(y>=0&&y<=700+160*this.spriteScale/this.sy)items.push({...a,type:'actor'});}items.push(...(this.animalMotion?.companionActors(this,items)||[]));items.push(...(this.animalMotion?.stairAdapter?.occluderItems?.(this,state)||[]));items.sort((a,b)=>a.y-b.y);for(const it of items){if(it.type==='stairOccluder')this.animalMotion.stairAdapter.drawOccluder(this,it);else if(it.type==='prop')this.prop(it.id,it);else this.actor(it.id,it);}drawInsideAmbience(this,state);this.drawEvents(dt);c.restore();
 }

 drawLeisureVenues(state){
  const c=this.ctx;
  for(const [id,r]of Object.entries({lounge:{x:45,y:66,w:290,h:260},theater:{x:395,y:68,w:502,h:260}})){
   if(state.facilities?.[id]?.level)continue;
   c.save();c.translate(0,this.top);c.scale(this.sx,this.sy);
   c.beginPath();c.roundRect(r.x,r.y,r.w,r.h,[80,80,2,2]);c.clip();
   const g=c.createLinearGradient(r.x,0,r.x+r.w,0);g.addColorStop(0,'#1e493c');g.addColorStop(.5,'#487357');g.addColorStop(1,'#1b4235');c.fillStyle=g;c.fillRect(r.x,r.y,r.w,r.h);
   for(let x=r.x+6;x<r.x+r.w;x+=18){c.fillStyle='#112d2426';c.fillRect(x,r.y,6,r.h);}
   c.strokeStyle='#d0a55f';c.lineWidth=4;c.beginPath();c.moveTo(r.x,r.y+25);c.quadraticCurveTo(r.x+r.w/2,r.y+75,r.x+r.w,r.y+25);c.stroke();
   c.fillStyle='#d6bb7c';c.fillRect(r.x+r.w/2-26,r.y+145,52,43);c.strokeStyle='#d6bb7c';c.lineWidth=8;c.beginPath();c.arc(r.x+r.w/2,r.y+144,16,Math.PI,0);c.stroke();c.fillStyle='#436047';c.beginPath();c.arc(r.x+r.w/2,r.y+164,5,0,Math.PI*2);c.fill();c.restore();
  }
 }
 leisureSprite(kind,a,size,active){
  const meta=this.leisureArt?.actors?.[kind];if(!meta)return;
  const animated=active&&!this.settings.reducedMotion,im=this.images[animated?meta.atlas:meta.idle];if(!im)return;
  const c=this.ctx,p=this.point(a.x,a.y),w=size*this.spriteScale,frame=animated?Math.floor(this.now*meta.fps)%4:0;
  if(kind==='owl')this.shadow(a.x,a.y,22);
  c.save();c.translate(p.x,p.y);if(kind==='owl'&&a.facing<0)c.scale(-1,1);
  if(animated)c.drawImage(im,(frame%2)*384,Math.floor(frame/2)*384,384,384,-w*256/384,-w*356/384,w,w);
  else c.drawImage(im,-w*256/384,-w*356/384,w,w);
  c.restore();
  if(active&&kind!=='owl'&&!this.settings.reducedMotion){c.save();c.strokeStyle='#f4d894';c.lineWidth=1.5;const phase=(this.now*.8)%1;c.globalAlpha=1-phase;c.beginPath();c.arc(p.x+14,p.y-w*.68-phase*9,2,0,Math.PI*2);c.stroke();c.restore();}
 }

 drawCuisineInterior(state){
  if(state.version<5||!state.facilities?.restaurant?.level||!this.cuisineArt)return;
  const image=this.images[this.cuisineArt.paths[state.config.restaurantCuisine]],r=this.cuisineArt.sourceBounds;
  if(!image||!r)return; // Ramen remains the unchanged original interior.
  const c=this.ctx;c.save();c.translate(0,this.top);c.scale(this.sx,this.sy);
  c.clip(new Path2D(this.cuisineArt.archPath));c.drawImage(image,r.x,r.y,r.width,r.height);c.restore();
 }
 actor(id,a){if(a.reason)this.actorBadge(a,125,a.reason,'#f3dec1','#675445');if((id.startsWith('performer-')||id==='inspector'||id==='chef')&&this.animalMotion?.drawActor(this,id,a))return;if(id.startsWith('performer-')){this.leisureSprite(a.performer,a,130,a.working);return;}if(id==='inspector'){if(a.visible)this.leisureSprite('owl',a,160,!!a.moving);return;}if(id==='chef'){const m=this.characters.actors.chef;if(!m)return;const key=a.working?m.work_frames[Math.floor(this.now*(m.work_fps||3))%m.work_frames.length]:m.actions.idle,frame=this.characters.actions[key];if(frame){this.shadow(a.x,a.y,22);this.spriteAt(frame.file,a.x,a.y,175,175,(frame.foot_anchor||[256,356]).map(v=>v/384));}return;}const articulated=this.animalMotion?.drawActor(this,id,a)||false;if(!articulated)super.actor(id,a);else if(a.visible&&(a.served||a.escorted)&&a.spriteKind==='guest')this.actorBadge(a,130,'♥','#f5deaa','#47684b');if(a.visible&&a.served&&['cat','family'].includes(a.spriteKind))this.actorBadge(a,130,'♥','#f5deaa','#47684b');if(a.visible&&a.action==='reviewing'){const t=Math.max(0,Math.min(1,1-(a.checkoutRemaining||0)/.35)),start=this.point(a.x,a.y-40),end=this.point(REVIEW_BOX_VIEW.x,REVIEW_BOX_VIEW.y),p={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-reviewBoxSlotOffset(this.width,this.height)-start.y)*t-10*Math.sin(Math.PI*t)},c=this.ctx;c.save();c.translate(p.x,p.y);c.rotate(-.2+t*.35);c.fillStyle='#fff0c8';c.strokeStyle='#a27c43';c.lineWidth=1;c.fillRect(-6,-4,12,8);c.strokeRect(-6,-4,12,8);c.beginPath();c.moveTo(-6,-4);c.lineTo(0,0);c.lineTo(6,-4);c.stroke();c.restore();}if(id===this.criticGuestId)drawPressAccessories(this,a,this.criticRevealed);if(id==='helper'&&a.visible)this.actorBadge(a,115,'3','#e5c47d','#285541');if(!articulated&&a.visible&&a.carrying==='meal'){const p=this.point(a.x,a.y),c=this.ctx;c.save();c.fillStyle='#edce85';c.strokeStyle='#88663d';c.lineWidth=1;c.beginPath();c.ellipse(p.x+9*this.spriteScale,p.y-48*this.spriteScale,18*this.spriteScale,6*this.spriteScale,0,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.ellipse(p.x+9*this.spriteScale,p.y-52*this.spriteScale,14*this.spriteScale,10*this.spriteScale,0,Math.PI,0);c.fill();c.restore();}}
}
