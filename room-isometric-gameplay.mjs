import {drawIsometricRoomScene} from './room-isometric-scene.mjs';
import {ROOM_FURNITURE_CATALOG,resolveRoomFurnishings} from './hotel-room-furnishings.mjs';
import {roomLayoutStatus,roomShells,defaultRoomLayout} from './hotel-room-layout.mjs';
import {createAnimalMotionRuntime} from './animal-motion-runtime.mjs';
import {floorOf} from './rush-floors.mjs';
import {projectRoomPoint,fitRoomCamera} from './room-isometric-projection.mjs';
import {SERVICE_CAMERA_BOUNDS,SERVICE_CORRIDOR,presentationLocalPoint,serviceRoomCamera,projectServicePoint,visibleServiceActor,serviceActorFacing,sortServiceItems} from './room-isometric-service-geometry.mjs';

/** Display-only opt-in. An absent/unsupported saved furnishing field keeps the
 * exact legacy renderer, including all authoritative stair mechanics. */
function serviceMode(renderer,enabled){
 if(!!renderer.cutawayActive!==enabled){renderer.animalMotion?.reset();renderer.cutawayMotion?.reset();renderer.cutawayLastPositions={};renderer.cutawayDistances={};}
 if(!enabled)renderer.stageViewport?.(false);renderer.cutawayActive=enabled;return enabled;
}
export function prepareIsometricService(renderer,state){
 renderer.cutawayCamera=null;
 if(renderer.floor!==1||state.version!==7||renderer.roomFurnishings===undefined||roomLayoutStatus(renderer.roomLayout)==='unsupported')return serviceMode(renderer,false);
 const rooms=renderer.roomBuilding?.rooms?.filter(r=>r.floor===1)||[],resolved=resolveRoomFurnishings(renderer.roomFurnishings,{layout:renderer.roomLayout,rooms});
 if(!rooms.length||!resolved.ok)return serviceMode(renderer,false);
 renderer.stageViewport?.(true);
 const built=rooms.filter(r=>r.status==='built'),focus=built.find(r=>r.id===renderer.cutawayFocusId)||built[0];
 if(focus)renderer.cutawayFocusId=focus.id;
 const shell=focus?roomShells(renderer.roomLayout||defaultRoomLayout())[focus.bay]:null;
 let camera;
 if(renderer.cutawayOverview||!shell){const rear=Math.min(SERVICE_CAMERA_BOUNDS.y,...roomShells(renderer.roomLayout||defaultRoomLayout()).map(s=>s.y));camera=fitRoomCamera({...SERVICE_CAMERA_BOUNDS,y:rear,h:SERVICE_CAMERA_BOUNDS.h+SERVICE_CAMERA_BOUNDS.y-rear},renderer.width,renderer.stageHeight,22);}
 else {
  // Default focus shows the complete enclosing walls and both the currently
  // issued doorway and the next-layout doorway. Player zoom/pan remain explicit.
  const issuedDoor=(state.config.roomDoorXs??[240,530,820])[focus.bay];
  const left=Math.min(shell.x,issuedDoor-28,shell.door-28),right=Math.max(shell.x+shell.w,issuedDoor+28,shell.door+28);
  const base=fitRoomCamera({x:left,y:shell.y,w:right-left,h:280-shell.y,wallHeight:112},renderer.width,renderer.stageHeight,24),zoom=renderer.cutawayZoom||1;
  camera={scale:base.scale*zoom,x:renderer.width/2+(base.x-renderer.width/2)*zoom,y:renderer.stageHeight/2+(base.y-renderer.stageHeight/2)*zoom};
  camera.x+=renderer.cutawayPan?.x||0;camera.y+=renderer.cutawayPan?.y||0;
 }
 camera.y+=renderer.top;
 renderer.cutawayCamera=camera;renderer.cutawayPoint=(x,y)=>projectServicePoint(x,y,camera);
 renderer.cutawayScene={rooms,furnishings:resolved.value};return serviceMode(renderer,true);
}
function polygon(c,points,fill,stroke){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
/** Opaque enclosed stairs: no decorative flight is substituted for real treads.
 * Rev3 actors walk to the real (850,590/600) gates, then remain behind this shell.
 * West and north vestibule openings cover both room and inspector approaches. */
export function drawServiceStairPortal(c,camera){
 const p=(x,y,z=0)=>projectRoomPoint(presentationLocalPoint({x,y,z}),camera),face=(pts,fill,stroke='#6c593b')=>polygon(c,pts.map(a=>p(...a)),fill,stroke);
 const height=168,shade=(x,y,top,bottom)=>{const a=p(x,y,height),b=p(x,y,0),g=c.createLinearGradient(a.x,a.y,b.x,b.y);g.addColorStop(0,top);g.addColorStop(1,bottom);return g;};
 face([[850,500,0],[1170,500,0],[1170,500,height],[850,500,height]],shade(1010,500,'#d7c69b','#958562'));
 face([[850,500,0],[850,690,0],[850,690,height],[850,500,height]],shade(850,600,'#8c9d7b','#395848'));
 face([[850,550,0],[850,650,0],[850,650,120],[850,550,120]],'#263f34','#c0a667');
 face([[850,500,0],[910,500,0],[910,500,120],[850,500,120]],'#263f34','#c0a667');
 // Near faces complete the enclosure, including the lower landing at y530.
 // Their full height masks tall/carried silhouettes before deep-well culling.
 face([[1170,500,0],[1170,690,0],[1170,690,height],[1170,500,height]],shade(1170,600,'#89977a','#3d5e4c'));
 face([[850,690,0],[1170,690,0],[1170,690,height],[850,690,height]],shade(1010,690,'#d6c29a','#9a815e'));
 face([[850,690,0],[1170,690,0],[1170,690,32],[850,690,32]],'#365d4b','#c3a466');
 for(let x=860;x<1170;x+=45)face([[x,690,5],[x+32,690,5],[x+32,690,26],[x,690,26]],'#426651','#8e9a69');
 face([[850,500,height],[1170,500,height],[1170,690,height],[850,690,height]],'#d9c59b');
 for(let x=865;x<1170;x+=35){c.beginPath();const a=p(x,500,height),b=p(x,690,height);c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle='#a68e5e55';c.lineWidth=.8;c.stroke();}
 // Arched opening sits on the actual west gate, not an invented front door.
 const door=p(850,500);c.save();c.transform(-.8660254038*SERVICE_CORRIDOR.depthScale*camera.scale,.5*SERVICE_CORRIDOR.depthScale*camera.scale,0,-camera.scale,door.x,door.y);c.beginPath();c.moveTo(55,0);c.lineTo(55,91);c.quadraticCurveTo(105,161,155,91);c.lineTo(155,0);c.closePath();c.fillStyle='#233f34';c.fill();c.strokeStyle='#ddc28b';c.lineWidth=6;c.stroke();c.beginPath();c.moveTo(70,0);c.lineTo(70,87);c.quadraticCurveTo(105,139,140,87);c.lineTo(140,0);c.strokeStyle='#816b45';c.lineWidth=3;c.stroke();c.restore();
 // Brass picture rail and a warm inset panel break up the plaster, while the
 // dark doorway keeps the full enclosure opaque for carried silhouettes.
 face([[910,690,52],[1110,690,52],[1110,690,127],[910,690,127]],'#405e4d','#d3b778');
 face([[918,690,60],[1102,690,60],[1102,690,119],[918,690,119]],'#829173','#a99c6b');
}
export function drawIsometricService(renderer,state,dt=0,departures=[]){
 const c=renderer.ctx,camera=renderer.cutawayCamera,{rooms,furnishings}=renderer.cutawayScene;
 c.setTransform(renderer.dpr,0,0,renderer.dpr,0,0);c.fillStyle='#143b32';c.fillRect(0,0,renderer.width,renderer.height);
 c.save();c.beginPath();c.rect(0,renderer.top,renderer.width,renderer.stageHeight);c.clip();
 c.save();c.translate(0,renderer.top);drawIsometricRoomScene(c,{width:renderer.width,height:renderer.stageHeight,layout:renderer.roomLayout,rooms,furnishings,serviceDoorXs:state.config.roomDoorXs??[240,530,820],catalog:ROOM_FURNITURE_CATALOG,images:renderer.images,selectedRoomId:renderer.cutawayFocusId,overview:!!renderer.cutawayOverview,service:true,camera:{...camera,y:camera.y-renderer.top}});c.restore();
 const bundle=renderer.animalMotion?.bundle;
 if(!renderer.cutawayMotion||renderer.cutawayMotion.bundle!==bundle)renderer.cutawayMotion=createAnimalMotionRuntime(bundle);
 const view=Object.create(renderer);view.lastPositions=renderer.cutawayLastPositions??={};view.distances=renderer.cutawayDistances??={};view.animalMotion=renderer.cutawayMotion;view.spriteScale=camera.scale*.86;view.cutawayPoint=(x,y)=>projectServicePoint(x,y,{...camera,x:0,y:0});view.motionProjectionKey=`cutaway:${camera.scale}`;view.motionFacing=(actor,fallback)=>serviceActorFacing(actor,camera,fallback);
 const actorBadge=renderer.actorBadge;view.actorBadge=function(actor,...args){if(actor.x>=850&&actor.y+700>=500)return;return actorBadge.call(this,actor,...args);};
 view.animalMotion.beginFrame(view,state,{visualActors:departures});
 const all=Object.entries(state.actors||{}).map(([id,a])=>({id,...(id.startsWith('guest-')?{...a,...renderer.guestAnchor(a)}:a),type:'actor'}));
 all.push(...departures.map(a=>({...a,type:'actor'})));
 const candidates=all.filter(a=>visibleServiceActor(a));
 const companions=view.animalMotion.companionActors(view,all).filter(a=>visibleServiceActor(a,{carrier:all.find(p=>p.id===a.motionCarrierId)}));
 // Camera pan is a canvas translation, not actor displacement. World-relative
 // contact caches therefore remain stable while the player pans.
 c.save();c.translate(camera.x,camera.y);for(const a of sortServiceItems([...candidates,...companions],camera))view.actor(a.id,a);c.restore();
 drawServiceStairPortal(c,camera);
 // Screen-vertical feedback, never a diagonal floor offset. Other-floor events
 // still age normally but cannot float over a first-floor room.
 for(const e of renderer.events)e.age+=dt;renderer.events=renderer.events.filter(e=>e.age<2.4);
 for(const e of renderer.events){if(!Number.isFinite(e.x)||floorOf(e)!==1)continue;const p=renderer.elevatedPoint(e.x,e.y,130+e.age*18);c.save();c.globalAlpha=Math.min(1,(2.4-e.age)*2);c.font='bold 12px Arial';c.textAlign='center';c.shadowColor='#173628';c.shadowBlur=3;c.fillStyle=e.type.includes('hit')?'#ffd69e':'#fff4c4';c.fillText(e.short||'',p.x,p.y);c.restore();}
 c.restore();
}
