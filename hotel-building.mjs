import {roomShells} from './hotel-room-layout.mjs';
/** One read-only projection of the owned building for inside navigation and outside architecture.
 * Profile is authoritative after result-screen purchases; an old settled checkpoint must not
 * hide a new project or relabel chosen physical bays. This never repairs or saves either input. */
import {ORIGINAL_SLOTS,validRoomSlots} from './hotel-construction.mjs';
import {FACILITIES,LEISURE_VENUES,ROOM_TIERS} from './hotel-content.mjs';
export const FACADE_GEOMETRY=Object.freeze({left:160,width:880,lobbyTop:296,lobbyBottom:550,floorHeight:150,roofHeight:48,bayCenters:Object.freeze([338,596,854]),bayWidth:190,bayHeight:94});
export function projectHotelBuilding(profile={},state={},roomLayout){
 const raw=profile.openRooms??state.openRooms??3,openRooms=Number.isInteger(raw)?Math.max(1,Math.min(6,raw)):3;
 const sourceSlots=profile.construction?.slots??state.config?.roomSlots,slots=validRoomSlots(sourceSlots)?[...sourceSlots]:[...ORIGINAL_SLOTS];
 const tiers=profile.roomTiers??state.config?.roomTiers??[];
 const rawProject=profile.construction?.project,pending=rawProject&&rawProject.roomIndex===openRooms&&openRooms<6?rawProject:null;
 const rooms=Array.from({length:6},(_,index)=>{const slot=slots[index],built=index<openRooms,building=pending?.roomIndex===index,tier=built?([0,1,2].includes(tiers[index])?tiers[index]:0):building?pending.tier:0;return {id:`room-${index+1}`,index,slot,bay:slot%3,floor:1+Math.floor(slot/3),status:built?'built':building?'building':'unbuilt',tier,type:ROOM_TIERS[tier]?.key||'regular',name:ROOM_TIERS[tier]?.name||'Regular',progress:building?Math.max(0,Math.min(1,1-pending.remaining/pending.duration)):built?1:0};});
 const shells=roomShells(roomLayout);if(shells)for(const room of rooms)if(room.floor===1)room.shell={...shells[room.bay]};
 const owned=profile.facilities??state.config?.facilities??{},leisure=profile.leisure??state.config?.leisure??{};
 const facilities=FACILITIES.map((f,bay)=>({...f,bay,owned:owned[f.id]===1,status:owned[f.id]===1?'built':'unbuilt'}));
 const entertainment=LEISURE_VENUES.map((f,i)=>({...f,bay:i===0?0:2,owned:leisure[f.id]===1,status:leisure[f.id]===1?'built':'unbuilt'}));
 const hasServices=facilities.some(f=>f.owned),hasEntertainment=entertainment.some(f=>f.owned),guestTop=openRooms>=4||pending&&slots[pending.roomIndex]>=3?2:1;
 const topFloor=hasEntertainment?4:hasServices?3:guestTop;
 const levels=Array.from({length:5},(_,floor)=>{
  const bays=floor===0?[]:floor<3?rooms.filter(r=>r.floor===floor).sort((a,b)=>a.bay-b.bay):floor===3?facilities:entertainment;
  const built=floor===0||bays.some(b=>b.status==='built'),building=bays.some(b=>b.status==='building'),structural=floor<=topFloor;
  return {floor,label:floor===0?'Lobby':`${floor}F`,purpose:floor===0?'Lobby':floor<3?'Guest rooms':floor===3?'Services':'Entertainment',built,building,structural,status:building?'building':built?'built':structural?'closed':'unbuilt',accessible:floor<2||floor===2&&(openRooms>=4||!!pending&&slots[pending.roomIndex]>=3||hasServices)||floor===3&&hasServices||floor===4&&hasEntertainment,bays};
 });
 const roofY=FACADE_GEOMETRY.lobbyTop-topFloor*FACADE_GEOMETRY.floorHeight-FACADE_GEOMETRY.roofHeight;
 return {version:1,openRooms,slots,rooms,levels,topFloor,hasServices,hasEntertainment,guestFloors:guestTop,roofY,signAnchor:{x:598,y:332},doorAnchor:{x:596.5,y:453},pending:pending?{...pending,slot:slots[pending.roomIndex]}:null};
}
