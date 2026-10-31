/** Bounded two-guest-floor construction. Pure data; no wall clock or storage. */
export const ORIGINAL_SLOTS = Object.freeze([0,1,2,3,4,5]);
export const BUILD_TYPES = Object.freeze([
  {tier:0,name:'Standard',extra:0}, {tier:1,name:'Luxury',extra:120}, {tier:2,name:'Family',extra:300},
]);
const own=(value,key)=>value && typeof value==='object' ? Object.getOwnPropertyDescriptor(value,String(key))?.value : undefined;
export const slotName = slot => ['Left','Middle','Right'][slot % 3];
export function validRoomSlots(slots) {
  if (!Array.isArray(slots) || slots.length!==6) return false;
  const values=Array.from({length:6},(_,i)=>own(slots,i));
  return values.every((s,i)=>Number.isInteger(s)&&s>=0&&s<6&&(i<3?s<3:s>=3)) && new Set(values).size===6;
}
export const roomBuildPrice=count=>({2:100,3:140,4:100,5:180,6:260}[count]||0);
export const roomBuildDuration=openRooms=>openRooms===1?8:openRooms===2?15:openRooms===3?45:25;
export function validConstruction(build, openRooms) {
  if (!build || own(build,'version')!==1 || !validRoomSlots(own(build,'slots'))) return false;
  const p=own(build,'project'),tier=own(p,'tier'),duration=own(p,'duration'),remaining=own(p,'remaining');
  return p===null || !!p && openRooms<6 && own(p,'roomIndex')===openRooms && [0,1,2].includes(tier) &&
    duration===roomBuildDuration(openRooms) && Number.isFinite(remaining) && remaining>0 && remaining<=duration &&
    own(p,'price')===(roomBuildPrice(openRooms+1)+BUILD_TYPES[tier].extra);
}
export function copyConstruction(build,openRooms){
 if(!validConstruction(build,openRooms))return null;
 const p=own(build,'project');return {version:1,slots:Array.from({length:6},(_,i)=>own(own(build,'slots'),i)),project:p===null?null:Object.fromEntries(['roomIndex','tier','duration','remaining','price'].map(k=>[k,own(p,k)]))};
}
export function constructionOffer(profile, slot, tier=0) {
  const slots=profile.construction?.slots||ORIGINAL_SLOTS;
  const occupied=slots.slice(0,profile.openRooms);
  const type=BUILD_TYPES.find(t=>t.tier===tier),duration=roomBuildDuration(profile.openRooms);
  const price=roomBuildPrice(profile.openRooms+1)+(type?.extra||0);
  const reason=profile.activeShift?'Finish this shift before building.':profile.construction?.project?'Your builders are already at work.':
    profile.openRooms>=6?'Both guest floors are complete.':!type?'Choose a room type.':!(profile.openRooms<3?[0,1,2]:[3,4,5]).includes(slot)||occupied.includes(slot)?'Choose an empty bay.':
    profile.bank<price?`Need ${price-profile.bank} more coins.`:'';
  return {ok:!reason,reason,price,duration,slot,tier,roomIndex:profile.openRooms,floor:profile.openRooms<3?1:2};
}
/** Caller validates profile and save ownership before confirmation. Repeated confirmation cannot charge twice. */
export function startConstruction(profile, slot, tier=0) {
  const offer=constructionOffer(profile,slot,tier);
  if (!offer.ok) return offer;
  const slots=[...(profile.construction?.slots||ORIGINAL_SLOTS)],index=profile.openRooms,other=slots.indexOf(slot);
  [slots[index],slots[other]]=[slots[other],slots[index]];
  profile.bank-=offer.price;
  profile.construction={version:1,slots,project:{roomIndex:index,tier,duration:offer.duration,remaining:offer.duration,price:offer.price}};
  return offer;
}
/** Only simulation seconds that actually elapsed count. All pauses/closed tabs freeze work. */
export function advanceConstruction(profile,state,seconds) {
  const build=profile.construction,p=build?.project;
  if (!p || !(seconds>0) || !Number.isFinite(seconds) || !validConstruction(build,profile.openRooms) ||
    state.paused || !profile.activeShift || state.shiftId!==profile.activeShift.id || !validRoomSlots(state.config.roomSlots) ||
    JSON.stringify(state.config.roomSlots)!==JSON.stringify(build.slots) || state.openRooms!==profile.openRooms) return false;
  const room=state.rooms[p.roomIndex];
  if (!room || room.status!=='locked' || room.guestId!==null) return false;
  p.remaining=Math.max(0,p.remaining-seconds);
  if(p.remaining>1e-7)return false;
  profile.openRooms++;profile.roomTiers[p.roomIndex]=p.tier;
  state.openRooms=state.config.openRooms=profile.openRooms;state.config.roomTiers[p.roomIndex]=p.tier;
  room.tier=p.tier;room.capacity=p.tier===2?2:1;room.status='available';build.project=null;
  return true;
}
