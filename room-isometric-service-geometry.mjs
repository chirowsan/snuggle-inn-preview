/** Presentation only: canonical actor roots, routes and stair progress are never changed.
 * The service corridor is deliberately compressed after local y=300. Every
 * ground point, actor forecast and enclosing portal must use this same mapping.
 * This is an enclosed stairwell presentation, not visible reprojected stair gait.
 */
import {FLOOR_HEIGHT,floorOf,stairAt} from './rush-floors.mjs';
import {projectRoomPoint,fitRoomCamera} from './room-isometric-projection.mjs';

export const SERVICE_CAMERA_BOUNDS=Object.freeze({x:55,y:10,w:1115,h:650,wallHeight:112});
export const SERVICE_PORTAL=Object.freeze({x:850,y:500,w:320,h:190,height:168,doorX:850,doorY:600,maxActorX:1100,yMin:220,yMax:690});
export const SERVICE_CORRIDOR=Object.freeze({startY:300,depthScale:.8});
const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const sign=(value,fallback=1)=>value<0?-1:value>0?1:fallback<0?-1:1;

/** Floor-local input, including optional vertical height; a continuous, strictly
 * increasing map retains each route's direction and never introduces a jump. */
export function presentationLocalPoint(p){
  const y=p.y<=SERVICE_CORRIDOR.startY?p.y:SERVICE_CORRIDOR.startY+(p.y-SERVICE_CORRIDOR.startY)*SERVICE_CORRIDOR.depthScale;
  return {x:p.x,y,...(Number.isFinite(p.z)?{z:p.z}:{})};
}
export function serviceRoomCamera(width,height){return fitRoomCamera(SERVICE_CAMERA_BOUNDS,width,height,22);}
/** Project a canonical world point into the first-floor view. Visibility is a
 * separate decision so hidden DOM targets can still be positioned consistently. */
export function projectServicePoint(x,y,camera){return projectRoomPoint(presentationLocalPoint({x,y:y+FLOOR_HEIGHT}),camera);}

function candidate(actor){
  if(!finitePoint(actor)||actor.visible===false||floorOf(actor)!==1||stairAt(actor))return false;
  const y=actor.y+FLOOR_HEIGHT;
  return y>=SERVICE_PORTAL.yMin&&y<=SERVICE_PORTAL.yMax&&actor.x<=SERVICE_PORTAL.maxActorX;
}
/** Candidates beyond the doorway must be masked by the opaque enclosure. This
 * predicate deliberately does NOT claim their unmasked pixels are visible.
 * A carried child shares its actual carrier's visibility; no orphan cub appears
 * when the carrier is on hidden stairs or another floor. Uncarried children
 * continue to use their own canonical root rather than being teleported. */
export function visibleServiceActor(actor,{carrier}={}){
  if(!actor||actor.visible===false)return false;
  if(actor.motionCarryProgress>0){
    return !!carrier&&actor.motionCarrierId===carrier.id&&candidate(carrier);
  }
  return candidate(actor);
}
/** Facing is read from the projected next route segment, not canonical dx.
 * A screen-vertical segment retains the caller's existing facing. */
export function serviceActorFacing(actor,camera,fallback=actor?.facing){
  if(!finitePoint(actor))return sign(0,fallback);
  const next=actor.path?.find(p=>finitePoint(p)&&Math.hypot(p.x-actor.x,p.y-actor.y)>1e-7)
    ||(finitePoint(actor.target)&&Math.hypot(actor.target.x-actor.x,actor.target.y-actor.y)>1e-7?actor.target:null);
  if(!next)return sign(0,fallback);
  const a=projectServicePoint(actor.x,actor.y,camera),b=projectServicePoint(next.x,next.y,camera),dx=b.x-a.x;
  return Math.abs(dx)>1e-7?sign(dx):sign(0,fallback);
}
export function serviceDepth(point,camera){return projectServicePoint(point.x,point.y,camera).y;}
/** Stable copy: never reorder the authoritative collection or use canonical y
 * as a substitute for the actual projected ground-depth coordinate. */
export function sortServiceItems(items,camera){
  const indexed=new Map(items.filter(item=>item.id!==undefined).map(item=>[item.id,item]));
  return items.map((item,index)=>{
    const carrier=item.motionCarryProgress>0?indexed.get(item.motionCarrierId):null;
    const attached=carrier&&carrier!==item;
    return {item,index,depth:serviceDepth(attached?carrier:item,camera),group:attached?items.indexOf(carrier):index,carried:attached?1:0};
  }).sort((a,b)=>a.depth-b.depth||a.group-b.group||a.carried-b.carried||a.index-b.index).map(entry=>entry.item);
}
