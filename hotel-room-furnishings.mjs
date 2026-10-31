/** Optional first-floor furniture geometry and paid finish ownership. No capacity or navigation changes.
 * v1 remains byte-compatible; v2 adds quarter turns and game-coin finish tiers.
 * Coordinates are item top-left FLOOR footprints, not the height of a painted sprite. */
import {defaultRoomLayout,roomShells,ROOM_SHELL} from './hotel-room-layout.mjs';
export const ROOM_FURNISHINGS_VERSION=2;
export const FURNISHING_LIMITS=Object.freeze({grid:10,wallMargin:10,maxRooms:6,maxItems:12,undo:40});
export const ROOM_FURNITURE_CATALOG=Object.freeze(Object.fromEntries([
 ['bed','Bed',60,90,true],['lamp-cabinet','Bedside lamp cabinet',30,30,true],
 ['armchair','Armchair',40,40,true],['dresser','Dresser / bookshelf',50,30,true],
 ['plant','Plant',20,20,true],['rug','Rug',80,60,false],
].map(([kind,name,w,h,solid])=>[kind,Object.freeze({kind,name,w,h,solid})])));
const fail=(code,reason)=>({ok:false,code,reason});
const pass=()=>({ok:true,code:'',reason:''});
const own=(v,k)=>{try{const d=Object.getOwnPropertyDescriptor(v,String(k));return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
function objectData(v,expected){try{const keys=Reflect.ownKeys(v);return Object.getPrototypeOf(v)===Object.prototype&&keys.every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'))&&(!expected||keys.length===expected.length&&expected.every(k=>Object.hasOwn(v,k)));}catch{return false;}}
function listData(v,max){try{const n=own(v,'length');return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Number.isInteger(n)&&n>=0&&n<=max&&Reflect.ownKeys(v).length===n+1&&Array.from({length:n},(_,i)=>i).every(i=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))||{},'value'));}catch{return false;}}
function dataTree(raw){let count=0;const seen=new Set();function visit(v,depth){if(++count>512||depth>10)return false;if(v===null||['string','boolean'].includes(typeof v))return true;if(typeof v==='number')return Number.isFinite(v);if(!v||typeof v!=='object'||seen.has(v))return false;seen.add(v);const ok=(Array.isArray(v)?listData(v,128):objectData(v))&&Object.keys(v).every(k=>visit(own(v,k),depth+1));seen.delete(v);return ok;}return visit(raw,0);}
const copy=raw=>JSON.parse(JSON.stringify(raw));
const roomID=id=>typeof id==='string'&&/^room-[1-6]$/.test(id);
const itemID=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,31}$/.test(id);
const grid=n=>Number.isFinite(n)&&Number.isInteger(n)&&!Object.is(n,-0)&&n%10===0;
export function roomFurnitureFootprint(item){
 const kind=own(item,'kind');if(typeof kind!=='string'||!Object.hasOwn(ROOM_FURNITURE_CATALOG,kind))return null;const type=ROOM_FURNITURE_CATALOG[kind];
 if(!type||!Number.isFinite(own(item,'x'))||!Number.isFinite(own(item,'y')))return null;
 const rotation=own(item,'rotation')??0;if(![0,90,180,270].includes(rotation))return null;
 return {x:own(item,'x'),y:own(item,'y'),w:rotation%180?type.h:type.w,h:rotation%180?type.w:type.h,solid:type.solid};
}
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function schema(raw){
 if(!objectData(raw,['version','rooms'])||![1,2].includes(own(raw,'version')))return fail('unsupported','This furniture version or its fields are not supported. The original is preserved.');
 const records=own(raw,'rooms');if(!objectData(records)||Object.keys(records).length>FURNISHING_LIMITS.maxRooms)return fail('invalid-rooms','Furniture must be keyed by the existing first-floor room IDs.');
 for(const roomId of Object.keys(records)){
  const record=own(records,roomId),items=own(record,'items');
  if(!roomID(roomId)||!objectData(record,['items'])||!listData(items,FURNISHING_LIMITS.maxItems))return fail('invalid-room','Invalid first-floor furniture record.');
  const ids=new Set(),solids=[];
  for(let i=0;i<items.length;i++){
   const item=own(items,i),id=own(item,'id'),kind=own(item,'kind'),x=own(item,'x'),y=own(item,'y');
   if(!objectData(item,raw.version===2?['id','kind','x','y','rotation','tier','ownedTier']:['id','kind','x','y'])||!itemID(id)||ids.has(id)||typeof kind!=='string'||!Object.hasOwn(ROOM_FURNITURE_CATALOG,kind)||!grid(x)||!grid(y))return fail('invalid-item','Use unique item IDs, known furniture and 10-unit floor positions and supported version fields.');
   if(raw.version===2&&(![0,90,180,270].includes(own(item,'rotation'))||!Number.isInteger(own(item,'tier'))||!Number.isInteger(own(item,'ownedTier'))||item.tier<0||item.ownedTier<item.tier||item.ownedTier>furnitureTiers(kind).length-1))return fail('invalid-tier','Choose a supported furniture finish and quarter-turn.');
   ids.add(id);const box=roomFurnitureFootprint(item);
   if(x<ROOM_SHELL.left+10||x+box.w>ROOM_SHELL.right-10||y<(raw.version===2?-90:30)||y+box.h>ROOM_SHELL.apronTop)return fail('bounds','Keep furniture within the room walls and above the protected service corridor.');
   if(box.solid){if(solids.some(prior=>overlap(prior,box)))return fail('collision','Solid furniture cannot overlap. Rugs may sit underneath.');solids.push(box);}
  }
 }
 return pass();
}
function contextOf(options){
 if(!objectData(options)||Object.keys(options).some(k=>!['layout','rooms'].includes(k))||!Object.hasOwn(options,'rooms')||!listData(own(options,'rooms'),6))return fail('context','Use the current hotel building model to bind furniture to real rooms.');
 const rawLayout=own(options,'layout'),layout=rawLayout===undefined?defaultRoomLayout():rawLayout;
 if(!dataTree(layout))return fail('context','The room layout is unsupported; furniture has not been changed.');
 let shells;try{shells=roomShells(layout);}catch{}if(!shells)return fail('context','The room layout is unsupported; furniture has not been changed.');
 const bound=new Map(),bays=new Set(),ids=new Set();
 for(const model of own(options,'rooms')){
  const id=own(model,'id'),bay=own(model,'bay'),status=own(model,'status'),floor=own(model,'floor');
  if(!objectData(model)||!roomID(id)||ids.has(id)||!Number.isInteger(bay)||bay<0||bay>2||!['built','building','unbuilt'].includes(status))return fail('context','Invalid or duplicate building room identity.');ids.add(id);
  const actualFloor=floor===undefined?(Number(id.slice(5))<=3?1:2):floor;if(![1,2].includes(actualFloor))return fail('context','Use actual first-floor or second-floor room records.');const first=actualFloor===1;
  if(!first)continue;if(bays.has(bay))return fail('context','Two first-floor rooms cannot occupy one physical bay.');bays.add(bay);bound.set(id,{id,bay,status,shell:shells[bay]});
 }
 return {ok:true,bound,layout};
}
/** Omit context for strict transferable schema/collision/global-bounds validation.
 * Pass {layout, rooms} before display or edits for actual shell/status binding. */
export function validateRoomFurnishings(raw,options){
 const result=schema(raw);if(!result.ok)return result;if(options===undefined)return result;
 const context=contextOf(options);if(!context.ok)return context;
 for(const roomId of Object.keys(raw.rooms)){
  const room=context.bound.get(roomId);if(!room)return fail('unknown-room','This furniture refers to a room outside the current first floor.');
  if(room.status!=='built')return fail('unbuilt-room','Furniture does not open rooms. Finish building this room first.');
  const s=room.shell;
  for(const item of raw.rooms[roomId].items){const box=roomFurnitureFootprint(item);if(box.x<s.x+10||box.x+box.w>s.x+s.w-10||box.y<s.y+10||box.y+box.h>Math.min(s.y+s.h-10,ROOM_SHELL.apronTop))return fail('bounds','This wall change would cover furniture. Move the item first; nothing has been relocated automatically.');}
 }
 return pass();
}
export const validRoomFurnishings=(raw,options)=>validateRoomFurnishings(raw,options).ok;
function seedRoom(shell,version=1){
 const {x,y,w,bedSide}=shell,left=bedSide==='left';
 const result={items:[
  {id:'bed-1',kind:'bed',x:left?x+10:x+w-70,y:y+20},
  {id:'lamp-cabinet-1',kind:'lamp-cabinet',x:left?x+80:x+w-110,y:y+20},
  {id:'armchair-1',kind:'armchair',x:left?x+w-60:x+20,y:y+60},
  {id:'dresser-1',kind:'dresser',x:left?x+w-60:x+10,y:y+10},
  {id:'plant-1',kind:'plant',x:left?x+w-40:x+20,y:y+110},
  {id:'rug-1',kind:'rug',x:left?x+40:x+w-120,y:y+70},
 ]};if(version===2)for(const item of result.items)Object.assign(item,{rotation:0,tier:0,ownedTier:0});return result;
}
/** Seeds only currently built first-floor rooms. Unknown/future records never fall back. */
export function resolveRoomFurnishings(raw,options){
 const context=contextOf(options);if(!context.ok)return context;
 if(raw!==undefined){const checked=validateRoomFurnishings(raw,options);if(!checked.ok)return checked;}
 const value=raw===undefined?{version:1,rooms:{}}:copy(raw),seededRoomIds=[];
 for(const room of context.bound.values())if(room.status==='built'&&!Object.hasOwn(value.rooms,room.id)){value.rooms[room.id]=seedRoom(room.shell,value.version);seededRoomIds.push(room.id);}
 if(context.layout.version===2&&Object.values(value.rooms).some(r=>r.items.some(i=>i.y<30)))upgradeFurnitureVersion(value);
 const checked=validateRoomFurnishings(value,options);return checked.ok?{ok:true,code:'',reason:'',value,seededRoomIds}:checked;
}
export function defaultRoomFurnishings(layout,rooms){const result=resolveRoomFurnishings(undefined,{layout,rooms});return result.ok?result.value:null;}
export function snapRoomFurniturePoint(x,y){return Number.isFinite(x)&&Number.isFinite(y)?{x:Math.round(x/10)*10,y:Math.round(y/10)*10}:null;}
/** One item, one snapped move. Rejections never return a repaired or partial layout. */
export function moveRoomFurniture(raw,action,options){
 const context=contextOf(options);if(!context.ok)return context;const checked=validateRoomFurnishings(raw,options);if(!checked.ok)return checked;
 if(!objectData(action,['roomId','itemId','x','y']))return fail('invalid-action','Choose one furniture item and a floor position.');
 const {roomId,itemId}=action;if(!roomID(roomId)||!itemID(itemId))return fail('unknown-item','Choose an existing room and furniture item.');const point=snapRoomFurniturePoint(action.x,action.y),record=own(raw.rooms,roomId);
 if(!point||!record)return fail('unknown-item','Choose an item in an existing first-floor room.');
 const at=record.items.findIndex(item=>item.id===itemId);if(at<0)return fail('unknown-item','That item is not in this room.');
 const value=copy(raw);if(point.y<30)upgradeFurnitureVersion(value);Object.assign(value.rooms[roomId].items[at],point);const valid=validateRoomFurnishings(value,options);
 return valid.ok?{ok:true,code:'',reason:'',value,changed:raw.rooms[roomId].items[at].x!==point.x||raw.rooms[roomId].items[at].y!==point.y}:valid;
}
/** Isolated draft. Cancel/undo return copies; the input save and geometry are never mutated. */
export function createRoomFurnishingsDraft(raw,options){
 const resolved=resolveRoomFurnishings(raw,options);if(!resolved.ok)return null;
 const context={layout:own(options,'layout')===undefined?undefined:copy(own(options,'layout')),rooms:own(options,'rooms').map(model=>({id:own(model,'id'),bay:own(model,'bay'),status:own(model,'status'),...(own(model,'floor')===undefined?{}:{floor:own(model,'floor')})}))};
 const baseline=copy(resolved.value);let value=copy(baseline),history=[];
 return {get value(){return copy(value);},get dirty(){return JSON.stringify(value)!==JSON.stringify(baseline);},get canUndo(){return history.length>0;},get seededRoomIds(){return [...resolved.seededRoomIds];},
  move(action){const result=moveRoomFurniture(value,action,context);if(result.ok&&result.changed){history.push(value);if(history.length>FURNISHING_LIMITS.undo)history.shift();value=result.value;}return result.ok?{...result,value:copy(result.value)}:result;},
  rotate(action){const result=rotateRoomFurniture(value,action,context);if(result.ok&&result.changed){history.push(value);if(history.length>FURNISHING_LIMITS.undo)history.shift();value=result.value;}return result.ok?{...result,value:copy(result.value)}:result;},
  style(action){const result=styleRoomFurniture(value,action,context);if(result.ok&&result.changed){history.push(value);if(history.length>FURNISHING_LIMITS.undo)history.shift();value=result.value;}return result.ok?{...result,value:copy(result.value)}:result;},
  undo(){if(!history.length)return false;value=history.pop();return true;},
  cancel(){value=copy(baseline);history=[];return copy(value);},
 };
}

/** Read-only render/hit-test projection. Footprints are not actor navigation targets. */
export function roomFurnitureItems(raw,roomId,options){
 if(!roomID(roomId))return fail('unknown-room','Choose an actual first-floor room.');const resolved=resolveRoomFurnishings(raw,options);if(!resolved.ok)return resolved;const record=own(resolved.value.rooms,roomId);if(!record)return fail('unbuilt-room','This room is not built on the first floor.');
 const items=Object.freeze(record.items.map(item=>Object.freeze({...item,...roomFurnitureFootprint(item)})));return {ok:true,code:'',reason:'',items,seeded:resolved.seededRoomIds.includes(roomId)};
}

// Premium prices are cumulative ownership prices, not repeated per-use charges.
const CLASSIC=Object.freeze({name:'Classic',price:0});
export const FURNITURE_TIERS=Object.freeze({bed:Object.freeze([CLASSIC,Object.freeze({name:'Velvet',price:90}),Object.freeze({name:'Royal',price:220})]),armchair:Object.freeze([CLASSIC,Object.freeze({name:'Velvet',price:50}),Object.freeze({name:'Royal',price:120})]),rug:Object.freeze([CLASSIC,Object.freeze({name:'Woven',price:30}),Object.freeze({name:'Royal',price:70})])});
export function furnitureTiers(kind){return FURNITURE_TIERS[kind]||[CLASSIC];}
export function upgradeFurnitureVersion(value){if(value.version===1){value.version=2;for(const r of Object.values(value.rooms))for(const i of r.items)Object.assign(i,{rotation:0,tier:0,ownedTier:0});}return value;}
function editFurniture(raw,action,options,field){
 const checked=validateRoomFurnishings(raw,options);if(!checked.ok)return checked;
 if(!objectData(action,['roomId','itemId',field])||!roomID(own(action,'roomId'))||!itemID(own(action,'itemId')))return fail('invalid-action','Choose an existing item.');
 const value=upgradeFurnitureVersion(copy(raw)),item=own(value.rooms,action.roomId)?.items.find(i=>i.id===action.itemId);if(!item)return fail('unknown-item','Choose an existing item.');
 const before=JSON.stringify(item);
 if(field==='rotation'){if(![0,90,180,270].includes(action.rotation))return fail('rotation','Use quarter turns.');item.rotation=action.rotation;}
 else {if(!Number.isInteger(action.tier)||!furnitureTiers(item.kind)[action.tier])return fail('tier','Choose a listed finish.');item.tier=action.tier;item.ownedTier=Math.max(item.ownedTier,item.tier);}
 const result=validateRoomFurnishings(value,options);return result.ok?{ok:true,value,changed:before!==JSON.stringify(item)}:result;
}
export const rotateRoomFurniture=(raw,action,options)=>editFurniture(raw,action,options,'rotation');
export const styleRoomFurniture=(raw,action,options)=>editFurniture(raw,action,options,'tier');
/** Quote against saved ownership, never trusting draft ownedTier or a caller price. */
export function quoteRoomFurnishings(raw,draft,context,bank){
 const old=resolveRoomFurnishings(raw,context),valid=validateRoomFurnishings(draft,context);
 if(!old.ok||!valid.ok||!Number.isSafeInteger(bank)||bank<0)return fail('invalid','This hotel cannot buy furniture right now.');
 const value=copy(draft);let cost=0;
 if(JSON.stringify(Object.keys(old.value.rooms).sort())!==JSON.stringify(Object.keys(value.rooms).sort()))return fail('identity','Keep the current room furniture.');
 for(const [id,r]of Object.entries(value.rooms)){
  const prior=old.value.rooms[id].items;if(prior.length!==r.items.length)return fail('identity','Keep the current room furniture.');
  for(const item of r.items){const base=prior.find(i=>i.id===item.id&&i.kind===item.kind);if(!base)return fail('identity','Keep the current room furniture.');
   const owned=base.ownedTier||0,tier=item.tier||0,newOwned=Math.max(owned,tier);cost+=furnitureTiers(item.kind)[newOwned].price-furnitureTiers(item.kind)[owned].price;
   if(value.version===2)item.ownedTier=newOwned;else if(owned)return fail('ownership','Paid furniture ownership cannot be discarded.');
  }
 }
 return {ok:true,value,cost,balance:bank,after:bank-cost,affordable:bank>=cost,reason:bank<cost?'Not enough game coins. Your hotel is unchanged.':''};
}
