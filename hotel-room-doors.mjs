/** Issued first-floor threshold policy. Absent means the exact legacy doors.
 * Each range is inside EVERY supported partition layout with 40-unit clearance.
 * Positions are indexed by physical bay, not persistent room ID. No actor moves
 * when a draft changes: this policy is copied only into a newly issued shift. */
export const ROOM_DOOR_LIMITS=Object.freeze([[110,300],[470,590],[760,910]].map(Object.freeze));
export function validRoomDoorXs(xs){
 try{
  if(!Array.isArray(xs)||Object.getPrototypeOf(xs)!==Array.prototype||xs.length!==3||Reflect.ownKeys(xs).length!==4)return false;
  return ROOM_DOOR_LIMITS.every(([lo,hi],i)=>{const d=Object.getOwnPropertyDescriptor(xs,String(i)),x=d?.value;return !!d&&Object.hasOwn(d,'value')&&d.enumerable&&Number.isInteger(x)&&x%10===0&&x>=lo&&x<=hi;});
 }catch{return false;}
}
export const copyRoomDoorXs=xs=>validRoomDoorXs(xs)?[...xs]:null;
export function roomDoorPosition(plot,slot,xs){return plot.floor===1&&xs?{...plot,x:xs[slot%3]}:plot;}
