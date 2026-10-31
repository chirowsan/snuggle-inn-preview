/** Save-boundary relationship, separate from the independently usable geometry model.
 * Advanced v2 plans are new: they require a supported, opted-in furnished cutaway.
 * Legacy/default-sized plans and unknown future layouts keep their prior policy. */
import {validRoomLayout,ROOM_SHELL} from './hotel-room-layout.mjs';
import {validRoomFurnishings} from './hotel-room-furnishings.mjs';
import {projectHotelBuilding} from './hotel-building.mjs';
const UNSAFE=Symbol('unsafe descriptor');
const own=(value,key)=>{try{if(value===null||value===undefined)return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d?(Object.hasOwn(d,'value')?d.value:UNSAFE):undefined;}catch{return UNSAFE;}};
function plainTree(root){
 let count=0;const seen=new Set();
 function visit(value,depth){
  if(++count>100000||depth>64)return false;
  if(value===null||['string','boolean'].includes(typeof value))return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(!value||typeof value!=='object'||seen.has(value))return false;
  const array=Array.isArray(value),keys=Reflect.ownKeys(value);
  if(Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype)||array&&keys.length!==value.length+1)return false;
  seen.add(value);
  for(const key of keys){if(array&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value')||array&&!/^(0|[1-9]\d*)$/.test(key)||!visit(d.value,depth+1))return false;}
  seen.delete(value);return true;
 }
 try{return visit(root,0);}catch{return false;}
}
export const INTERIOR_RELATIONSHIP_ERROR='Larger rooms and adjustable doors require saved Furniture & cutaway on a current stay. The original save is preserved.';
export function layoutNeedsCutaway(layout){
 return validRoomLayout(layout)&&layout.version===2&&layout.rooms.some((room,bay)=>room.depth>230||room.doorX!==ROOM_SHELL.doors[bay]);
}
export function validInteriorRelationship(data){
 const saved=own(data,'saved'),layout=own(saved,'roomLayout');
 if(saved===UNSAFE||layout===UNSAFE)return false;
 if(!layoutNeedsCutaway(layout))return true;
 const envelope=own(data,'envelope'),checkpoint=own(envelope,'checkpoint'),profile=own(envelope,'profile'),furnishings=own(saved,'roomFurnishings');
 // Do not silently upgrade an old checkpoint to make the new view available.
 // Existing v6/v1 plans are unaffected; malformed advanced pairs stay recoverable.
 if(own(checkpoint,'version')!==7||furnishings===undefined||!plainTree(profile)||!plainTree(checkpoint))return false;
 try{return validRoomFurnishings(furnishings,{layout,rooms:projectHotelBuilding(profile,checkpoint,layout).rooms.filter(room=>room.floor===1)});}catch{return false;}
}
