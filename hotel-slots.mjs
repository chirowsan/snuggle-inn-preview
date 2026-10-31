import {validateLandscape,landscapeAccess} from './landscape-model.mjs';
import {validInteriorRelationship} from './hotel-interior-relationship.mjs';
import {assertJSON} from './portable-save.mjs';
/** Slot bank is inside the protected atomic bundle. Never writes storage itself. */
export const SLOT_BANK_VERSION=1;
const clone=v=>JSON.parse(JSON.stringify(v)),record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const empty=()=>({saved:{},envelope:{}});
// Local data is untrusted too: retain original evidence rather than passing an
// unsupported landscape to the exterior sanitizer or silently dropping it.
const safeLandscape=data=>{
 let d=data?.saved?.exteriorDesign;
 if(typeof d==='string'){if(d.length>65536)return false;try{d=JSON.parse(d);}catch{return false;}}
 if(!record(d)||!Object.hasOwn(d,'landscape'))return true;
 return d.version===3&&validateLandscape(d.landscape).ok&&landscapeAccess(d.landscape).ok;
};
// A known advanced floor without its supported cutaway must not fall through
// to the old side-view renderer. Preserve the complete slot as recovery evidence.
const safeHotelData=data=>{try{assertJSON(data);return safeLandscape(data)&&validInteriorRelationship(data);}catch{return false;}};
const quarantine=s=>({quarantined:true,evidence:s,name:'Save needs attention'});
const inspectSlot=s=>s===null?null:record(s)&&s.quarantined===true&&Object.hasOwn(s,'evidence')?s:record(s)&&record(s.data)&&record(s.data.saved)&&record(s.data.envelope)&&safeHotelData(s.data)?s:quarantine(s);
export function migrateSlotBank(bundle){
 // Persisted JSON can be quarantined exactly. Non-JSON caller objects cannot:
 // reject descriptors/toJSON before any clone rather than execute or erase them.
 assertJSON(bundle);
 if(bundle.slotBank!==undefined){
  const b=bundle.slotBank;
  if(!record(b)||b.version!==1||!Number.isInteger(b.active)||b.active<0||b.active>2||!Array.isArray(b.slots)||b.slots.length!==3)throw Error('Unsupported slot bank. Your saves have not been changed.');
  const result=clone(b);
  result.slots=result.slots.map(inspectSlot);
  return result;
 }
 const data={saved:clone(bundle.saved||{}),envelope:clone(bundle.envelope||{})};
 return {version:1,active:0,slots:[Object.keys(data.envelope).length||Object.keys(data.saved).length?inspectSlot({name:'My Snuggle Inn',data}):null,null,null]};
}
export function createSlotGuard(guard){
 let bank,root={},hooks={},queue=Promise.resolve(),transition=false;
 function adopt(data){const next=migrateSlotBank(data);root=clone(data);bank=next;const s=bank.slots[bank.active];return s?.quarantined?empty():clone(s?.data||empty());}
 const enqueue=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const bundle=b=>({...root,...(b.slots[b.active]?.data||empty()),slotBank:b});
 async function commit(b){const data=bundle(b);if(!await guard.write(data))return false;bank=b;root=data;return true;}
 const api={
  async start(){return adopt(await guard.start());},
  playHere:()=>guard.playHere(),pause:why=>guard.pause(why),verify:()=>guard.verify(),status:()=>guard.status(),dispose:()=>guard.dispose(),
  get active(){return guard.active;},get transitioning(){return transition;},get bank(){return clone(bank);},
  write(data){if(transition||bank?.slots[bank.active]?.quarantined||!safeHotelData(data))return Promise.resolve(false);const copy=clone(data);return enqueue(()=>{if(bank?.slots[bank.active]?.quarantined)return false;const b=clone(bank);b.slots[b.active]={...b.slots[b.active],name:b.slots[b.active]?.name||'My Snuggle Inn',data:copy};return commit(b);});},
  /** Caller freezes input first. Current snapshot and selected slot change in ONE fenced write. */
  switchSlot(index,current,{restart=false,confirmed=false,name}={}){
   if(transition||!Number.isInteger(index)||index<0||index>2||current&&!bank?.slots[bank.active]?.quarantined&&!safeHotelData(current))return Promise.resolve(false);
   transition=true;const snapshot=current?clone(current):null;
   return enqueue(async()=>{const b=clone(bank),target=b.slots[index];
    if((restart&&target&&!confirmed)||(target?.quarantined&&(!restart||!confirmed)))return false;
    if(snapshot&&b.slots[b.active]&&!b.slots[b.active]?.quarantined)b.slots[b.active]={...b.slots[b.active],name:b.slots[b.active]?.name||'My Snuggle Inn',data:snapshot};
    if(restart||!target){b.slots[index]={name:(name||['My Snuggle Inn','Willow Inn','Moonflower Inn'][index]).slice(0,48),data:empty()};}
    b.active=index;return commit(b);
   }).finally(()=>{transition=false;});
  },
  importHotel(index,incoming,current){if(transition||!Number.isInteger(index)||index<0||index>2||!safeHotelData(incoming)||current&&!bank?.slots[bank.active]?.quarantined&&!safeHotelData(current))return Promise.resolve(false);transition=true;const data=clone(incoming),snapshot=current?clone(current):null;return enqueue(()=>{const b=clone(bank);if(snapshot&&b.slots[b.active]&&!b.slots[b.active].quarantined)b.slots[b.active]={...b.slots[b.active],data:snapshot};b.slots[index]={name:b.slots[index]?.name||['My Snuggle Inn','Willow Inn','Moonflower Inn'][index],data};b.active=index;return commit(b);}).finally(()=>{transition=false;});},
  importBank(incoming){if(transition)return Promise.resolve(false);transition=true;return enqueue(()=>commit(migrateSlotBank({slotBank:incoming}))).finally(()=>{transition=false;});},
  setHooks(value){hooks=value||{};guard.setHooks({...hooks,onAcquire:data=>hooks.onAcquire?.(adopt(data))});}
 };return api;
}
export function slotSummary(slot,index){const p=slot?.data?.envelope?.profile;return {name:slot?.name||`Hotel ${index+1}`,empty:!slot,quarantined:!!slot?.quarantined,coins:p?.bank||0,rooms:p?.openRooms||0,shifts:p?.shiftsCompleted||0};}
