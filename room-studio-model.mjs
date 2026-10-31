/** Room Studio's transient joint draft. Saved schemas, prices and issuing rules
 * remain the v26 contracts. A geometry edit never moves furniture or actors. */
import {ROOM_SHELL,defaultRoomLayout,validRoomLayout,changeRoomLayout,canEditRoomLayout} from './hotel-room-layout.mjs';
import {resolveRoomFurnishings,validateRoomFurnishings,moveRoomFurniture,rotateRoomFurniture,styleRoomFurniture,quoteRoomFurnishings,upgradeFurnitureVersion,FURNISHING_LIMITS} from './hotel-room-furnishings.mjs';
import {layoutNeedsCutaway,validInteriorRelationship} from './hotel-interior-relationship.mjs';
import {restoreMotionSession} from './hotel-motion-session.mjs';
import {projectHotelBuilding} from './hotel-building.mjs';
import {resolveRoomDecorInventory} from './room-decor-inventory.mjs';
const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const fail=(code,reason)=>({ok:false,code,reason});
// Compare meaning, not schema promotion or object insertion order. A default
// preview is not consent to adopt the decorated painter or persist furniture.
const canonical=v=>JSON.stringify(v,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
function layoutMeaning(raw){const value=copy(raw??defaultRoomLayout());value.version=2;value.rooms.forEach((r,i)=>r.doorX??=ROOM_SHELL.doors[i]);return canonical(value);}
function furnitureMeaning(raw){const value=upgradeFurnitureVersion(copy(raw));for(const r of Object.values(value.rooms))r.items.sort((a,b)=>a.id.localeCompare(b.id));return canonical(value);}
// Read only data descriptors before cloning: no getters, toJSON or prototypes.
function plainData(root){
 let count=0;const seen=new Set();
 function visit(v,depth){
  if(++count>200000||depth>64)return false;
  if(v===null||v===undefined||['string','boolean'].includes(typeof v))return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(!v||typeof v!=='object'||seen.has(v))return false;
  const array=Array.isArray(v),keys=Reflect.ownKeys(v);
  if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype)||array&&keys.length!==v.length+1)return false;
  seen.add(v);
  for(const key of keys){if(array&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value')||array&&!/^(0|[1-9]\d*)$/.test(key)||!visit(d.value,depth+1))return false;}
  seen.delete(v);return true;
 }
 try{return visit(root,0);}catch{return false;}
}
/** Validate both geometries independently, then reuse the exact existing price
 * authority. The quote-only baseline adopts the proposed coordinates/turns, but
 * its ownership comes exclusively from the original valid saved furnishings.
 * This lets a user move furniture THEN shrink a wall in one atomic draft. */
export function quoteRoomStudio({layout,raw,rooms,nextLayout,furnishings,bank}){
 if(!plainData({layout,raw,rooms,nextLayout,furnishings,bank})||layout!==undefined&&!validRoomLayout(layout)||!validRoomLayout(nextLayout))return fail('invalid','This room plan is unsupported. Your hotel is unchanged.');
 const old=resolveRoomFurnishings(raw,{layout,rooms}),valid=validateRoomFurnishings(furnishings,{layout:nextLayout,rooms});
 if(!old.ok)return old;if(!valid.ok)return valid;
 const ownership=upgradeFurnitureVersion(copy(furnishings));
 if(JSON.stringify(Object.keys(old.value.rooms).sort())!==JSON.stringify(Object.keys(ownership.rooms).sort()))return fail('identity','Keep your current room furniture.');
 for(const [id,record]of Object.entries(ownership.rooms)){
  const prior=old.value.rooms[id].items;if(prior.length!==record.items.length)return fail('identity','Keep your current room furniture.');
  for(const item of record.items){const base=prior.find(p=>p.id===item.id&&p.kind===item.kind);if(!base)return fail('identity','Keep your current room furniture.');item.tier=base.tier||0;item.ownedTier=base.ownedTier||0;}
 }
 const quote=quoteRoomFurnishings(ownership,furnishings,{layout:nextLayout,rooms},bank);if(!quote.ok)return quote;
 const layoutChanged=layoutMeaning(layout)!==layoutMeaning(nextLayout),furnishingsChanged=furnitureMeaning(old.value)!==furnitureMeaning(quote.value);
 const changed=layoutChanged||furnishingsChanged,requiresViewConfirmation=raw===undefined&&changed&&(furnishingsChanged||layoutNeedsCutaway(nextLayout));
 return {...quote,changed,layoutChanged,furnishingsChanged,requiresViewConfirmation};
}
export function createRoomStudioDraft({layout,raw,rooms,bank=0,advancedReady=true}={}){
 if(!plainData({layout,raw,rooms,bank})||layout!==undefined&&!validRoomLayout(layout)||typeof advancedReady!=='boolean')return null;
 const resolved=resolveRoomFurnishings(raw,{layout,rooms});if(!resolved.ok)return null;
 const original={layout:copy(layout),raw:copy(raw),rooms:copy(rooms),bank};
 const baseline={layout:copy(layout??defaultRoomLayout()),furnishings:copy(resolved.value)};let value=copy(baseline),history=[];
 function accept(next){
  const valid=validateRoomFurnishings(next.furnishings,{layout:next.layout,rooms:original.rooms});if(!valid.ok)return valid;
  const changed=JSON.stringify(value)!==JSON.stringify(next);if(changed){history.push(value);if(history.length>FURNISHING_LIMITS.undo)history.shift();value=copy(next);}return {ok:true,changed,value:copy(value)};
 }
 function edit(fn,action){if(!plainData(action))return fail('invalid-action','Choose an existing item.');const result=fn(value.furnishings,action,{layout:value.layout,rooms:original.rooms});return result.ok?accept({layout:value.layout,furnishings:result.value}):result;}
 return {
  get value(){return copy(value);},get canUndo(){return history.length>0;},get dirty(){return JSON.stringify(value)!==JSON.stringify(baseline);},
  get seededRoomIds(){return [...resolved.seededRoomIds];},
  changeLayout(action){
   if(!plainData(action))return fail('invalid-action','Choose a room edge or door.');
   if(!advancedReady&&(action?.type==='doorX'||action?.type==='depth'&&action.value>230))return fail('legacy-stay','Continue a stay before larger rooms or door editing.');
   const next=changeRoomLayout(value.layout,action);if(!next)return fail('bounds','Keep the room within its available space.');
   return accept({layout:next,furnishings:value.furnishings});
  },
  move:action=>edit(moveRoomFurniture,action),rotate:action=>edit(rotateRoomFurniture,action),style:action=>edit(styleRoomFurniture,action),
  undo(){if(!history.length)return false;value=history.pop();return true;},
  cancel(){value=copy(baseline);history=[];return copy(value);},
  quote(){return quoteRoomStudio({...original,nextLayout:value.layout,furnishings:value.furnishings});},
 };
}
/** A single durable write: proposed walls/doors, furnishings and any premium
 * debit become visible together. Active issued doors/checkpoint stay untouched.
 * Authority is rebuilt from the real settled envelope, never caller rooms/bank. */
export async function commitRoomStudio({saved,layout,furnishings,context,envelope,write,stillCurrent=()=>true,decoratedViewConfirmed=false}){
 try{
  if(!plainData({saved,layout,furnishings,context,envelope})||!saved||!validRoomLayout(layout)||saved.roomLayout!==undefined&&!validRoomLayout(saved.roomLayout)||!stillCurrent())return {ok:false};
  const restored=restoreMotionSession(envelope);
  if(!restored.ok||!canEditRoomLayout(restored.profile,restored.session.state,{settled:restored.alreadySettled,ownsSave:true})||!validInteriorRelationship({saved,envelope})||layoutNeedsCutaway(layout)&&restored.session.state.version!==7)return {ok:false};
  const rooms=projectHotelBuilding(restored.profile,restored.session.state,saved.roomLayout).rooms.filter(r=>r.floor===1);
  const quote=quoteRoomStudio({layout:saved.roomLayout,raw:saved.roomFurnishings,rooms,nextLayout:layout,furnishings,bank:restored.profile.bank});
  if(!quote.ok||!quote.affordable)return {ok:false,reason:quote.reason};
  if(!quote.changed)return {ok:true,unchanged:true,changed:false,saved,envelope,cost:0};
  if(quote.requiresViewConfirmation&&decoratedViewConfirmed!==true)return {ok:false,needsViewConfirmation:true,cost:quote.cost};
  const candidate=copy(saved);if(quote.layoutChanged)candidate.roomLayout=copy(layout);
  // Preserve absent furnishings for classic shell-only edits, and preserve the
  // exact existing furniture schema/ownership when furniture itself is unchanged.
  if(quote.furnishingsChanged||saved.roomFurnishings===undefined&&layoutNeedsCutaway(layout))candidate.roomFurnishings=quote.value;
  if(candidate.roomDecorInventory!==undefined&&!resolveRoomDecorInventory({saved:candidate,rooms}).ok)return {ok:false,reason:'Move or store furniture before changing these walls.'};
  const nextEnvelope=copy(envelope);if(quote.cost)nextEnvelope.profile.bank-=quote.cost;
  if(!restoreMotionSession(nextEnvelope).ok||!validInteriorRelationship({saved:candidate,envelope:nextEnvelope})||!stillCurrent())return {ok:false};
  if(!await write({saved:candidate,envelope:nextEnvelope})||!stillCurrent())return {ok:false};
  return {ok:true,changed:true,saved:candidate,envelope:nextEnvelope,cost:quote.cost};
 }catch{return {ok:false};}
}
