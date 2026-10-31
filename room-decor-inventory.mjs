/** Optional, independent decorating inventory. Never rewrites legacy furnishings. */
import {defaultRoomLayout,roomShells,canEditRoomLayout} from './hotel-room-layout.mjs';
import {resolveRoomFurnishings,ROOM_FURNITURE_CATALOG,furnitureTiers} from './hotel-room-furnishings.mjs';
import {restoreMotionSession} from './hotel-motion-session.mjs';
import {projectHotelBuilding} from './hotel-building.mjs';
import {validInteriorRelationship} from './hotel-interior-relationship.mjs';
export const ROOM_DECOR_LIMIT=64;
export const ROOM_DECOR_RANKS=Object.freeze({cheap:'Cheap',medium:'Medium',expensive:'Expensive',luxury:'Luxury'});
export const ROOM_DECOR_CATALOG=Object.freeze(Object.fromEntries([
 ['linen-sofa','Linen sofa',100,50,120,true,'medium'],['olive-chair','Olive chair',50,50,60,true,'medium'],['oak-table','Oak table',50,50,45,true,'medium'],['terracotta-plant','Terracotta plant',30,30,25,true,'cheap'],['woven-rug','Woven rug',100,70,35,false,'cheap'],
 ['walnut-table','Walnut table',50,50,120,true,'expensive'],['marble-table','Marble table',50,50,260,true,'luxury'],
 ...Object.values(ROOM_FURNITURE_CATALOG).map(i=>['legacy-'+i.kind,i.name,i.w,i.h,0,i.solid,'cheap']),
].map(([id,name,w,h,price,solid,rank])=>[id,Object.freeze({id,name,w,h,price,solid,rank,purchasable:!id.startsWith('legacy-')})])));
/** Presentation metadata only: no rank field, rating or gating in saved data. */
export function roomDecorRank(item){
 const id=item?.catalogId;if(typeof id!=='string'||!Object.hasOwn(ROOM_DECOR_CATALOG,id))return null;const catalog=ROOM_DECOR_CATALOG[id];
 return catalog.purchasable?catalog.rank:({0:'cheap',1:'expensive',2:'luxury'}[item?.legacy?.tier]??'cheap');
}
const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const fail=(code,reason)=>({ok:false,code,reason});
function plain(root){let count=0;const seen=new Set();function visit(v,d){if(++count>200000||d>64)return false;if(v===undefined||v===null||['string','boolean'].includes(typeof v))return true;if(typeof v==='number')return Number.isFinite(v);if(!v||typeof v!=='object'||seen.has(v))return false;const a=Array.isArray(v),keys=Reflect.ownKeys(v);if(Object.getPrototypeOf(v)!==(a?Array.prototype:Object.prototype)||a&&keys.length!==v.length+1)return false;seen.add(v);for(const k of keys){if(a&&k==='length')continue;const p=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!p?.enumerable||!Object.hasOwn(p,'value')||a&&!/^(0|[1-9]\d*)$/.test(k)||!visit(p.value,d+1))return false;}seen.delete(v);return true;}try{return visit(root,0);}catch{return false;}}
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const grid=n=>Number.isSafeInteger(n)&&n%10===0&&!Object.is(n,-0);
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function roomDecorFootprint(item){const c=ROOM_DECOR_CATALOG[item?.catalogId];if(!c||![0,90,180,270].includes(item.rotation))return null;return {x:item.x,y:item.y,w:item.rotation%180?c.h:c.w,h:item.rotation%180?c.w:c.h,solid:c.solid};}
function context(saved,rooms){
 if(!plain({saved,rooms})||!saved||!Array.isArray(rooms))return fail('context','This room is unavailable.');
 const legacy=resolveRoomFurnishings(saved.roomFurnishings,{layout:saved.roomLayout,rooms});if(!legacy.ok)return legacy;
 const shells=roomShells(saved.roomLayout??defaultRoomLayout()),bound=new Map();for(const r of rooms)if(r.floor===1||r.floor===undefined&&Number(r.id.slice(5))<=3)bound.set(r.id,{...r,shell:shells[r.bay]});
 const imported=[];for(const [roomId,r]of Object.entries(legacy.value.rooms))for(const i of r.items)imported.push({id:`legacy-${roomId}-${i.id}`,catalogId:`legacy-${i.kind}`,roomId,x:i.x,y:i.y,rotation:i.rotation??0,legacy:{roomId,itemId:i.id,kind:i.kind,tier:i.tier??0,ownedTier:i.ownedTier??0}});
 return {ok:true,bound,imported};
}
export function validateRoomDecorInventory(inventory,{saved,rooms},allowStaleLegacy=false){
 const ctx=context(saved,rooms);if(!ctx.ok)return ctx;
 if(!plain(inventory)||!keys(inventory,['version','nextId','items'])||inventory.version!==1||!Number.isSafeInteger(inventory.nextId)||inventory.nextId<1||!Array.isArray(inventory.items)||inventory.items.length>ROOM_DECOR_LIMIT)return fail('unsupported','This inventory is unsupported. Your hotel is unchanged.');
 const ids=new Set(),solids=new Map();for(const i of inventory.items){
  if(!keys(i,['id','catalogId','roomId','x','y','rotation','legacy'])||typeof i.id!=='string'||ids.has(i.id)||!Object.hasOwn(ROOM_DECOR_CATALOG,i.catalogId)||!grid(i.x)||!grid(i.y)||![0,90,180,270].includes(i.rotation))return fail('invalid','Choose valid furniture and floor positions.');ids.add(i.id);
  if(i.legacy!==null){const expected=ctx.imported.find(x=>x.id===i.id);if(!expected||i.catalogId!==expected.catalogId||!keys(i.legacy,['roomId','itemId','kind','tier','ownedTier'])||i.legacy.roomId!==expected.legacy.roomId||i.legacy.itemId!==expected.legacy.itemId||i.legacy.kind!==expected.legacy.kind||!Number.isInteger(i.legacy.tier)||!Number.isInteger(i.legacy.ownedTier)||i.legacy.tier<0||i.legacy.ownedTier<i.legacy.tier||i.legacy.ownedTier>=furnitureTiers(i.legacy.kind).length||!allowStaleLegacy&&canonical(i.legacy)!==canonical(expected.legacy))return fail('legacy','Original furniture ownership must be preserved.');}
  else if(!ROOM_DECOR_CATALOG[i.catalogId].purchasable||!/^decor-[1-9]\d*$/.test(i.id)||!Number.isSafeInteger(Number(i.id.slice(6)))||Number(i.id.slice(6))>=inventory.nextId)return fail('identity','This furniture identity is unsupported.');
  if(i.roomId===null){if(i.x!==0||i.y!==0)return fail('storage','Stored furniture has no floor position.');continue;}
  const room=ctx.bound.get(i.roomId);if(!room||room.status!=='built')return fail('room','Choose a built first-floor room.');const b=roomDecorFootprint(i),s=room.shell;
  if(b.x<s.x+10||b.x+b.w>s.x+s.w-10||b.y<s.y+10||b.y+b.h>Math.min(s.y+s.h-10,220))return fail('bounds','Keep furniture inside the walls and clear of the doorway.');
  if(b.solid){const prior=solids.get(i.roomId)||[];if(prior.some(p=>overlap(p,b)))return fail('collision','Furniture cannot overlap.');prior.push(b);solids.set(i.roomId,prior);}
 }
 const serials=inventory.items.filter(i=>i.legacy===null).map(i=>Number(i.id.slice(6))).sort((a,b)=>a-b);
 if(inventory.nextId!==serials.length+1||serials.some((n,i)=>n!==i+1))return fail('identity','Purchased furniture identities must remain intact.');
 return {ok:true};
}
export function resolveRoomDecorInventory({saved,rooms}){
 const ctx=context(saved,rooms);if(!ctx.ok)return ctx;
 const value=saved.roomDecorInventory===undefined?{version:1,nextId:1,items:copy(ctx.imported)}:copy(saved.roomDecorInventory);
 const checked=validateRoomDecorInventory(value,{saved,rooms},true);if(!checked.ok)return checked;
 // The old editor remains authoritative for legacy finishes. Reconcile only
 // metadata in this transient copy, never placement/storage or the old save.
 for(const item of value.items)if(item.legacy!==null)item.legacy=copy(ctx.imported.find(i=>i.id===item.id).legacy);
 // New rooms may have acquired legacy pieces since the last inventory save.
 for(const item of ctx.imported)if(!value.items.some(i=>i.id===item.id))value.items.push(copy(item));
 const complete=validateRoomDecorInventory(value,{saved,rooms});return complete.ok?{ok:true,value}:complete;
}
export function quoteRoomDecorInventory({saved,inventory,rooms,bank}){
 if(!plain({saved,inventory,rooms,bank})||!Number.isSafeInteger(bank)||bank<0)return fail('invalid','This hotel cannot decorate right now.');
 const old=resolveRoomDecorInventory({saved,rooms});if(!old.ok)return old;const valid=validateRoomDecorInventory(inventory,{saved,rooms});if(!valid.ok)return valid;
 const prior=new Map(old.value.items.map(i=>[i.id,i]));let cost=0;const added=[];
 for(const item of inventory.items){const base=prior.get(item.id);if(base){if(base.catalogId!==item.catalogId||canonical(base.legacy)!==canonical(item.legacy))return fail('ownership','Owned furniture cannot be replaced.');prior.delete(item.id);}else{if(item.legacy!==null||!ROOM_DECOR_CATALOG[item.catalogId].purchasable)return fail('ownership','Original furniture cannot be duplicated.');added.push(item);cost+=ROOM_DECOR_CATALOG[item.catalogId].price;}}
 if(prior.size||inventory.nextId!==old.value.nextId+added.length)return fail('ownership','Store owned furniture instead of deleting it.');
 const serials=added.map(i=>Number(i.id.slice(6))).sort((a,b)=>a-b);if(serials.some((n,i)=>n!==old.value.nextId+i))return fail('ownership','New furniture must come from the shop.');
 const meaning=v=>canonical({...v,items:[...v.items].sort((a,b)=>a.id.localeCompare(b.id))});
 return {ok:true,value:copy(inventory),cost,balance:bank,after:bank-cost,affordable:cost<=bank,changed:meaning(inventory)!==meaning(old.value),reason:cost>bank?'Not enough game coins.':''};
}
export function createRoomDecorDraft({saved,rooms,bank=0}){
 if(!plain({saved,rooms,bank}))return null;const original={saved:copy(saved),rooms:copy(rooms),bank},resolved=resolveRoomDecorInventory(original);if(!resolved.ok)return null;
 const baseline=copy(resolved.value);let value=copy(baseline),history=[];
 const quote=()=>quoteRoomDecorInventory({...original,inventory:value});
 function accept(next){const result=quoteRoomDecorInventory({...original,inventory:next});if(!result.ok)return result;if(canonical(next)===canonical(value))return {ok:true,changed:false,value:copy(value)};history.push(value);if(history.length>40)history.shift();value=next;return {ok:true,changed:true,value:copy(value)};}
 function edit(id,change){const next=copy(value),item=next.items.find(i=>i.id===id);if(!item)return fail('identity','Choose an owned item.');change(item);return accept(next);}
 return {get value(){return copy(value);},get items(){return copy(value.items);},get cost(){return quote().cost;},get dirty(){return quote().changed;},get canUndo(){return history.length>0;},quote,
  buy(catalogId){const c=ROOM_DECOR_CATALOG[catalogId];if(!c?.purchasable)return fail('catalogue','Choose a shop item.');if(value.items.length>=ROOM_DECOR_LIMIT)return fail('capacity','Your storage is full.');const next=copy(value),id=`decor-${next.nextId++}`;next.items.push({id,catalogId,roomId:null,x:0,y:0,rotation:0,legacy:null});const r=accept(next);return {...r,...(r.ok?{id}:{})};},
  place(id,roomId,x,y){return edit(id,i=>Object.assign(i,{roomId,x,y}));},move(id,x,y){return edit(id,i=>Object.assign(i,{x,y}));},rotate(id,rotation){return edit(id,i=>i.rotation=rotation);},store(id){return edit(id,i=>Object.assign(i,{roomId:null,x:0,y:0}));},
  undo(){if(!history.length)return false;value=history.pop();return true;},cancel(){value=copy(baseline);history=[];return copy(value);},
 };
}
export async function commitRoomDecorInventory({saved,inventory,envelope,write,stillCurrent=()=>true}){
 try{
  if(!plain({saved,inventory,envelope})||!stillCurrent())return {ok:false};const restored=restoreMotionSession(envelope);
  if(!restored.ok||!canEditRoomLayout(restored.profile,restored.session.state,{settled:restored.alreadySettled,ownsSave:true})||!validInteriorRelationship({saved,envelope}))return {ok:false};
  const rooms=projectHotelBuilding(restored.profile,restored.session.state,saved.roomLayout).rooms.filter(r=>r.floor===1),q=quoteRoomDecorInventory({saved,inventory,rooms,bank:restored.profile.bank});
  if(!q.ok||!q.affordable)return {ok:false,reason:q.reason};if(!q.changed)return {ok:true,unchanged:true,saved,envelope,cost:0};
  const candidate=copy(saved);candidate.roomDecorInventory=q.value;const nextEnvelope=copy(envelope);nextEnvelope.profile.bank-=q.cost;
  if(!restoreMotionSession(nextEnvelope).ok||!validInteriorRelationship({saved:candidate,envelope:nextEnvelope})||!stillCurrent())return {ok:false};
  if(!await write({saved:candidate,envelope:nextEnvelope})||!stillCurrent())return {ok:false};return {ok:true,saved:candidate,envelope:nextEnvelope,cost:q.cost};
 }catch{return {ok:false};}
}
