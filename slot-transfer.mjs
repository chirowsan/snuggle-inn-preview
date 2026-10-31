import {assertJSON,encodePortableSave,decodePortableSave,MAX_PORTABLE_SAVE_BYTES} from './portable-save.mjs';
import {migrateSlotBank} from './hotel-slots.mjs';
const FORMAT='snuggle-inn-slot-bank';
export function encodeSlotBank(bank){
 assertJSON(bank);const b=migrateSlotBank({slotBank:bank});
 for(const s of b.slots)if(s&&!s.quarantined&&Object.keys(s.data.envelope).length)encodePortableSave(s.data);
 const text=JSON.stringify({format:FORMAT,version:1,bank:b});if(new TextEncoder().encode(text).length>MAX_PORTABLE_SAVE_BYTES)throw Error('Backup is too large.');return text;
}
export function decodeSlotImport(text){
 try{if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_PORTABLE_SAVE_BYTES)throw Error('Save file is too large.');
 const p=JSON.parse(text);assertJSON(p);if(p.format!==FORMAT){const old=decodePortableSave(text);return old.ok?{ok:true,kind:'hotel',data:old.data}:old;}
 if(p.version!==1)throw Error('Unsupported slot backup version.');
 const bank=migrateSlotBank({slotBank:p.bank});
 // No repair or dropping metadata/unknown hotel fields: all payloads remain exact.
 if(JSON.stringify(bank)!==JSON.stringify(p.bank))throw Error('Backup has a damaged slot. Keep the original file for recovery.');
 for(const s of bank.slots)if(s&&!s.quarantined&&Object.keys(s.data.envelope).length)encodePortableSave(s.data);
 return {ok:true,kind:'bank',bank};
 }catch(e){return {ok:false,error:e.message||'Invalid backup.'};}
}
