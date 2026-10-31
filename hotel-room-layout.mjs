/** Optional first-floor shell. v1 keeps fixed doors; v2 drafts a bounded next-stay door plan.
 * Stored beside the checkpoint; active actors/routes are never moved by a draft.
 * The service apron stays clear. Absence means the original painted hotel. */
export const ROOM_LAYOUT_VERSION=2;
export const ROOM_SHELL=Object.freeze({left:70,right:950,front:250,apronTop:220,apronBottom:320,grid:10,doors:Object.freeze([240,530,820])});
export const ROOM_DOOR_RANGES=Object.freeze([[110,300],[470,590],[760,910]].map(Object.freeze));
export const ROOM_FINISHES=Object.freeze({sage:{name:'Sage',wall:'#8dafa0',trim:'#476c5b',linen:'#c4d7ac'},rose:{name:'Rose',wall:'#d5a9a2',trim:'#8d625e',linen:'#efd2bc'},sky:{name:'Sky',wall:'#a5bcc6',trim:'#557789',linen:'#d5e5db'},honey:{name:'Honey',wall:'#d6bf8f',trim:'#8b7047',linen:'#ede0b2'}});
export const ROOM_FLOORS=Object.freeze({oak:{name:'Oak',base:'#d4b483',line:'#b58e5b'},walnut:{name:'Walnut',base:'#ad8767',line:'#896446'},tile:{name:'Cream tile',base:'#e2d7bd',line:'#c8bca1'}});
const clone=v=>JSON.parse(JSON.stringify(v));
const own=(v,k)=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,String(k))?.value:undefined;
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,wanted)=>{try{return record(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===wanted.length&&wanted.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});}catch{return false;}};
const list=(v,n)=>{try{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length===n&&Reflect.ownKeys(v).length===n+1&&Array.from({length:n},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));return d?.enumerable&&Object.hasOwn(d,'value');}).every(Boolean);}catch{return false;}};
const grid=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi&&n%10===0;
export function defaultRoomLayout(){return {version:1,partitions:[70,380,670,950],rooms:Array.from({length:3},()=>({depth:190,finish:'sage',floor:'oak',windows:2,bedSide:'left'}))};}
export function validRoomLayout(raw){
 if(!keys(raw,['version','partitions','rooms'])||![1,2].includes(own(raw,'version')))return false;
 const p=own(raw,'partitions'),rooms=own(raw,'rooms');
 return list(p,4)&&own(p,0)===70&&own(p,3)===950&&grid(own(p,1),340,430)&&grid(own(p,2),630,720)&&
  list(rooms,3)&&Array.from({length:3},(_,i)=>own(rooms,i)).every((r,bay)=>keys(r,raw.version===2?['depth','finish','floor','windows','bedSide','doorX']:['depth','finish','floor','windows','bedSide'])&&(raw.version!==2||grid(own(r,'doorX'),...ROOM_DOOR_RANGES[bay]))&&grid(own(r,'depth'),170,raw.version===2?350:230)&&Object.hasOwn(ROOM_FINISHES,own(r,'finish'))&&Object.hasOwn(ROOM_FLOORS,own(r,'floor'))&&[0,1,2].includes(own(r,'windows'))&&['left','right'].includes(own(r,'bedSide')));
}
export function roomLayoutStatus(raw){return raw===undefined?'original':validRoomLayout(raw)?'editable':'unsupported';}
/** Every furniture rectangle ends above y=220. Door/service routes stay below it. */
export function roomShells(raw){
 if(!validRoomLayout(raw))return null;
 return raw.rooms.map((r,bay)=>{
  const x=raw.partitions[bay],w=raw.partitions[bay+1]-x,y=ROOM_SHELL.front-r.depth,door=r.doorX??ROOM_SHELL.doors[bay];
  const bed={kind:'bed',x:r.bedSide==='left'?x+22:x+w-120,y:y+6,w:98,h:126};
  const desk={kind:'desk',x:r.bedSide==='left'?x+w-70:x+22,y:y+65,w:48,h:54};
  const plant={kind:'plant',x:r.bedSide==='left'?x+w-65:x+29,y:y+104,w:40,h:28};
  return {bay,x,y,w,h:r.depth,door,finish:r.finish,floor:r.floor,windows:r.windows,bedSide:r.bedSide,furniture:[bed,desk,plant],apron:{x,y:220,w,h:100}};
 });
}
export function canEditRoomLayout(profile,state,{settled=false,ownsSave=false}={}){
 return ownsSave&&settled&&['won','lost'].includes(state?.status)&&!profile?.activeShift&&!profile?.construction?.project&&(profile?.guestsCompleted||0)>0;
}
export function changeRoomLayout(raw,action){
 if(!validRoomLayout(raw)||!keys(action,['type','bay','value']))return null;
 const next=clone(raw),{type,bay,value}=action;
 if(type==='doorX'||type==='depth'&&value>230){next.version=2;next.rooms.forEach((r,i)=>r.doorX??=ROOM_SHELL.doors[i]);}
 if(type==='partition'&&[1,2].includes(bay))next.partitions[bay]=value;
 else if(['depth','finish','floor','windows','bedSide','doorX'].includes(type)&&[0,1,2].includes(bay))next.rooms[bay][type]=value;
 else return null;
 return validRoomLayout(next)?next:null;
}
/** Copy-on-write draft. Cancel is simply disposal; input and saved data are never mutated. */
export function createRoomLayoutDraft(raw){
 if(roomLayoutStatus(raw)==='unsupported')return null;
 let draft=raw===undefined?defaultRoomLayout():clone(raw),history=[];
 return {get value(){return clone(draft);},get canUndo(){return history.length>0;},
  change(action){const next=changeRoomLayout(draft,action);if(!next||JSON.stringify(next)===JSON.stringify(draft))return false;history.push(draft);if(history.length>40)history.shift();draft=next;return true;},
  undo(){if(!history.length)return false;draft=history.pop();return true;},
  restoreOriginal(){return undefined;}
 };
}
/** Durable-first replacement. Caller freezes competing saves/navigation until it resolves.
 * Failure or ownership handoff never mutates the currently displayed saved object. */
export async function commitRoomLayout({saved,layout,envelope,write,stillCurrent=()=>true}){
 if(roomLayoutStatus(saved?.roomLayout)==='unsupported'||layout!==undefined&&!validRoomLayout(layout)||!stillCurrent())return {ok:false};
 try{const candidate=clone(saved);if(layout===undefined)delete candidate.roomLayout;else candidate.roomLayout=clone(layout);
 if(layout!==undefined&&!validRoomLayout(candidate.roomLayout))return {ok:false};
 if(candidate.roomDecorInventory!==undefined){
  // Lazy imports avoid a geometry→inventory→geometry initialization cycle.
  // Existing no-inventory saves retain their original commit contract.
  const [{resolveRoomDecorInventory},{restoreMotionSession},{projectHotelBuilding}]=await Promise.all([import('./room-decor-inventory.mjs'),import('./hotel-motion-session.mjs'),import('./hotel-building.mjs')]);
  const restored=restoreMotionSession(envelope);
  if(!restored.ok||!canEditRoomLayout(restored.profile,restored.session.state,{settled:restored.alreadySettled,ownsSave:true}))return {ok:false};
  const rooms=projectHotelBuilding(restored.profile,restored.session.state,candidate.roomLayout).rooms.filter(r=>r.floor===1);
  if(!resolveRoomDecorInventory({saved:candidate,rooms}).ok)return {ok:false,reason:'Move or store furniture before changing these walls.'};
 }
 if(!stillCurrent())return {ok:false};
 if(!await write({saved:candidate,envelope})||!stillCurrent())return {ok:false};return {ok:true,saved:candidate};}catch{return {ok:false};}
}
