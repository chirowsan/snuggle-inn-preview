import {resolveRoomDecorInventory} from './room-decor-inventory.mjs';
import {projectHotelBuilding} from './hotel-building.mjs';
import {validRoomFurnishings} from './hotel-room-furnishings.mjs';
import {validInteriorRelationship,INTERIOR_RELATIONSHIP_ERROR} from './hotel-interior-relationship.mjs';
import {validNewspaperReveal} from './hotel-newspaper-reveal.mjs';
import {validateLandscape,landscapeAccess} from './landscape-model.mjs';
import {validRoomLayout} from './hotel-room-layout.mjs';
/** Pure game-only transfer. Does not read storage, mutate callers, migrate or start a hotel. */
import {restoreMotionSession} from './hotel-motion-session.mjs';
import {sanitizeDesign,DESIGN_VERSION} from './exterior-model.mjs';
import {HOTEL_MUSIC_TRACKS} from './hotel-audio.mjs';
import {rushSnapshot} from './rush.mjs';
export const MAX_PORTABLE_SAVE_BYTES=5*1024*1024;
export const PORTABLE_SAVE_FORMAT='hotel-portable-save';
export const PORTABLE_SAVE_VERSION=1;
const fail=message=>{throw Error(message);};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const equal=(a,b)=>{
 if(a===b)return true;if(typeof a!==typeof b||a===null||b===null||typeof a!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
};
/** Descriptor walk never invokes getters/toJSON; reject data JSON would silently drop/change. */
export function assertJSON(value){
 const seen=new Set();let count=0;
 function visit(v,depth){
  if(++count>100000||depth>64)fail('Save is too complex.');
  if(v===null||typeof v==='boolean'||typeof v==='string')return;
  if(typeof v==='number'){if(!Number.isFinite(v)||Object.is(v,-0))fail('Save contains an invalid number.');return;}
  if(typeof v!=='object')fail('Save contains non-JSON data.');
  if(seen.has(v))fail('Save contains a cycle.');seen.add(v);
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);
  if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)fail('Save has an unsafe prototype.');
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(array&&(!Number.isSafeInteger(v.length)||v.length>100000))fail('Save array is too large.');
  for(const key of keys){
   if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key))fail('Save has an unsafe property.');
   const d=descriptors[key];if(!Object.hasOwn(d,'value'))fail('Save contains an accessor.');
   if(array&&key==='length')continue;
   if(!d.enumerable)fail('Save contains hidden data.');
   if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=v.length))fail('Save array has extra properties.');
   visit(d.value,depth+1);
  }
  if(array&&keys.length!==v.length+1)fail('Save array is incomplete.');seen.delete(v);
 }
 visit(value,0);
}
function validateData(data){
 assertJSON(data);
 if(!record(data)||Object.keys(data).length!==2||!record(data.saved)||!record(data.envelope))fail('Missing hotel save data.');
 const e=data.envelope,p=e.profile;
 if(e.version!==undefined&&e.version!==1)fail('Unsupported hotel envelope version.');
 if(!record(p)||![1,2,3,4].includes(p.version))fail('Unsupported hotel profile version.');
 for(const k of ['bank','openRooms','staffCount','serviceLevel','nextShift','lastSettledShift','shiftsCompleted','guestsCompleted','activeShift','lastResult'])if(!Object.hasOwn(p,k))fail('Hotel profile is incomplete.');
 for(const k of ['activeMode','preferredMode'])if(e[k]!==undefined&&!['rush','relaxed'].includes(e[k]))fail('Invalid saved hotel mode.');
 for(const k of ['started','modeConfirmed','modeChosenByPlayer','goalCelebrated'])if(e[k]!==undefined&&typeof e[k]!=='boolean')fail('Invalid saved hotel setting.');
 for(const feature of [p.reputation,p.activeShift?.reputationPlan,e.checkpoint?.reputation,e.checkpoint?.config?.reputationPlan])if(feature!==undefined&&(!record(feature)||feature.version!==1))fail('Unsupported newspaper save version.');
 if(p.location!==undefined&&(!record(p.location)||p.location.version!==1))fail('Unsupported location save version.');
 if(p.construction!==undefined&&(!record(p.construction)||p.construction.version!==1)||e.checkpoint?.config?.constructionRules!==undefined&&e.checkpoint.config.constructionRules!==1)fail('Unsupported construction save version.');
 const restored=restoreMotionSession(e);if(!restored.ok)fail('Hotel checkpoint is invalid or unsupported ('+restored.code+').');
 // Validation may internally understand old formats, but transfer returns their exact bytes/data.
 // Never accept a checkpoint/profile whose existing values would be silently repaired.
 if(!equal(rushSnapshot(restored.session.state),e.checkpoint))fail('Hotel checkpoint would require repair.');
 for(const k of Object.keys(p))if(k!=='version'&&Object.hasOwn(restored.profile,k)&&!equal(p[k],restored.profile[k]))fail('Hotel profile would require repair ('+k+').');
 if(data.saved.newspaperReveal!==undefined&&!validNewspaperReveal(data.saved.newspaperReveal))fail('Unsupported newspaper presentation save.');
 const s=data.saved.settings;
 if(s!==undefined){if(!record(s))fail('Invalid audio settings.');
  for(const k of ['sound','reducedMotion','musicEnabled','effectsEnabled','weatherEnabled'])if(s[k]!==undefined&&typeof s[k]!=='boolean')fail('Invalid audio preference.');
  for(const k of ['musicVolume','effectsVolume','weatherVolume'])if(s[k]!==undefined&&(typeof s[k]!=='number'||s[k]<0||s[k]>1))fail('Invalid audio volume.');
  if(s.musicTrack!==undefined&&!HOTEL_MUSIC_TRACKS.some(t=>t.id===s.musicTrack))fail('Unsupported music track.');
  if(s.atmosphereVersion!==undefined&&s.atmosphereVersion!==1)fail('Unsupported atmosphere settings.');
  if(s.weather!==undefined&&!['cycle','sunshine','overcast','rain','off'].includes(s.weather))fail('Invalid weather choice.');
 }
 if(data.saved.roomLayout!==undefined&&!validRoomLayout(data.saved.roomLayout))fail('Unsupported or invalid first-floor layout.');
 if(data.saved.roomFurnishings!==undefined&&!validRoomFurnishings(data.saved.roomFurnishings,{layout:data.saved.roomLayout,rooms:projectHotelBuilding(p,e.checkpoint,data.saved.roomLayout).rooms.filter(r=>r.floor===1)}))fail('Unsupported or invalid room furnishings.');
 if(data.saved.roomDecorInventory!==undefined&&!resolveRoomDecorInventory({saved:data.saved,rooms:projectHotelBuilding(p,e.checkpoint,data.saved.roomLayout).rooms.filter(r=>r.floor===1)}).ok)fail('Unsupported or invalid room decorating inventory.');
 if(!validInteriorRelationship(data))fail(INTERIOR_RELATIONSHIP_ERROR);
 const design=data.saved.exteriorDesign;
 if(design!==undefined&&(!record(design)||![1,2,3].includes(design.version)))fail('Unsupported exterior design version.');
 if(design&&Object.hasOwn(design,'landscape')){if(design.version!==3||!validateLandscape(design.landscape).ok||!landscapeAccess(design.landscape).ok)fail('Invalid or inaccessible landscape layout.');}
 if(design?.version===1){const normalized=sanitizeDesign(design);if(!record(design.sign)||['text','color','glow','font','size'].some(k=>!Object.hasOwn(design.sign,k)||!equal(design.sign[k],normalized.sign[k])))fail('Legacy exterior design would require repair.');}
 if(design?.version>=2&&!equal(sanitizeDesign(design),{...design,version:DESIGN_VERSION}))fail('Exterior design would require repair.');
 return data;
}
const bytes=text=>new TextEncoder().encode(text).byteLength;
export function encodePortableSave(data){
 validateData(data);const text=JSON.stringify({format:PORTABLE_SAVE_FORMAT,version:PORTABLE_SAVE_VERSION,data});
 if(bytes(text)>MAX_PORTABLE_SAVE_BYTES)fail('Save file is too large.');return text;
}
export function decodePortableSave(text){
 try{
  if(typeof text!=='string'||text.length>MAX_PORTABLE_SAVE_BYTES||bytes(text)>MAX_PORTABLE_SAVE_BYTES)fail('Save file is missing or too large.');
  let parsed;try{parsed=JSON.parse(text);}catch{fail('Save file is incomplete or not valid JSON.');}
  assertJSON(parsed);
  if(!record(parsed)||Object.keys(parsed).length!==3||parsed.format!==PORTABLE_SAVE_FORMAT||parsed.version!==PORTABLE_SAVE_VERSION||!Object.hasOwn(parsed,'data'))fail('Unsupported save file format or version.');
  return {ok:true,data:validateData(parsed.data)};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'Invalid save file.'};}
}
