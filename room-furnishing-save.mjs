import {validRoomFurnishings,quoteRoomFurnishings} from './hotel-room-furnishings.mjs';
import {validProfile} from './rush-economy.mjs';
import {restoreMotionSession} from './hotel-motion-session.mjs';
import {projectHotelBuilding} from './hotel-building.mjs';
const own=(o,k)=>o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k)?.value:undefined;
// Paid writes must not execute a supplied getter/toJSON while quoting or cloning.
function plainData(root){
 const seen=new Set();let count=0;
 function visit(v,depth){
  if(++count>200000||depth>60)return false;
  if(v===null||v===undefined||['string','boolean'].includes(typeof v))return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(typeof v!=='object'||seen.has(v))return false;
  const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))return false;
  seen.add(v);const keys=Reflect.ownKeys(v);if(array&&keys.length!==v.length+1)return false;
  for(const key of keys){if(array&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value')||array&&!/^(0|[1-9]\d*)$/.test(key)||!visit(d.value,depth+1))return false;}
  seen.delete(v);return true;
 }
 try{return visit(root,0);}catch{return false;}
}
/** Durable first: furniture ownership and game-coin debit are one save transaction. */
export async function commitRoomFurnishings({saved,furnishings,context,envelope,write,stillCurrent=()=>true}){
 if(!plainData(saved)||!plainData(envelope))return {ok:false};
 if(!stillCurrent()||saved.roomFurnishings!==undefined&&!validRoomFurnishings(saved.roomFurnishings,context)||!validRoomFurnishings(furnishings,context))return {ok:false};
 let quote=quoteRoomFurnishings(saved.roomFurnishings,furnishings,context,own(own(envelope,'profile'),'bank')??0);if(!quote.ok||!quote.affordable)return {ok:false,reason:quote.reason};
 try{
  if(quote.cost){
   if(!plainData(saved)||!plainData(envelope)||!validProfile(envelope?.profile)||envelope.profile.activeShift!==null||envelope.profile.construction?.project)return {ok:false};
   const current=restoreMotionSession(envelope);if(!current.ok||!current.alreadySettled)return {ok:false};
   const actualContext={layout:saved.roomLayout,rooms:projectHotelBuilding(current.profile,current.session.state,saved.roomLayout).rooms.filter(r=>r.floor===1)};
   quote=quoteRoomFurnishings(saved.roomFurnishings,furnishings,actualContext,envelope.profile.bank);if(!quote.ok||!quote.affordable)return {ok:false};
  }
  const candidate=JSON.parse(JSON.stringify(saved));candidate.roomFurnishings=quote.value;
  const nextEnvelope=envelope===undefined?undefined:JSON.parse(JSON.stringify(envelope));if(quote.cost){nextEnvelope.profile.bank-=quote.cost;if(!restoreMotionSession(nextEnvelope).ok)return {ok:false};}
  if(!await write({saved:candidate,envelope:nextEnvelope})||!stillCurrent())return {ok:false};return {ok:true,saved:candidate,envelope:nextEnvelope,cost:quote.cost};
 }catch{return {ok:false};}
}
