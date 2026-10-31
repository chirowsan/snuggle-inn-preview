import {encodePortableSave,decodePortableSave,MAX_PORTABLE_SAVE_BYTES} from './portable-save.mjs';
/** Browser-local, explicitly confirmed transfer. All writes stay behind the single-writer fence. */
export function setupSaveTransfer({document,guard,persist,getData,getIdentity,setApplying,reload,download}) {
 const $=id=>document.getElementById(id); let pending=null,epoch=0,busy=false;
 const note=text=>{$('save-transfer-status').textContent=text;};
 const reset=()=>{pending=null;epoch++;$('save-import-preview').hidden=true;$('save-import-file').value='';};
 function enabled(value){busy=!value;for(const id of ['export-save','import-save','confirm-import','cancel-import','close-settings'])$(id).disabled=!value;}
 const allowed=()=>guard.active&&!busy;
 $('export-save').onclick=async()=>{
  if(!allowed())return;enabled(false);note('Preparing your backup…');const identity=getIdentity();
  try{if(!await persist()||!guard.active||identity!==getIdentity())throw Error('The active tab changed. Please try again here.');
   const text=encodePortableSave(getData());await download(text,'snuggle-inn-save.json');note('Backup downloaded. Keep this file before changing the hotel link.');
  }catch(error){note(error.message||'Could not export. Your saved hotel is unchanged.');}finally{enabled(true);}
 };
 $('import-save').onclick=()=>{if(!allowed())return;reset();note('Choose a Snuggle Inn save file. Nothing changes until you confirm.');$('save-import-file').click();};
 $('save-import-file').onchange=async()=>{
  if(!allowed())return;const file=$('save-import-file').files?.[0];if(!file)return;
  const attempt=++epoch,identity=getIdentity();enabled(false);note('Checking the save…');
  try{
   if(file.size>MAX_PORTABLE_SAVE_BYTES)throw Error('That file is too large. Your hotel is unchanged.');
   const decoded=decodePortableSave(await file.text());
   if(attempt!==epoch||!guard.active||identity!==getIdentity())throw Error('The active tab changed. Choose the file again.');
   if(!decoded.ok)throw Error(decoded.error);
   pending={data:decoded.data,identity};
   const p=decoded.data.envelope.profile;
   $('save-import-summary').textContent=`This backup has ${p.bank} ${p.bank===1?'coin':'coins'} and ${p.openRooms} open ${p.openRooms===1?'room':'rooms'}. Import replaces this browser’s hotel, including its current shift and settings.`;
   $('save-import-preview').hidden=false;note('Review the backup, then choose Replace this hotel or Cancel.');
  }catch(error){pending=null;$('save-import-preview').hidden=true;note(error.message||'Invalid save. Your hotel is unchanged.');}finally{enabled(true);}
 };
 $('cancel-import').onclick=()=>{if(busy)return;reset();note('Import canceled. Your hotel is unchanged.');};
 $('confirm-import').onclick=async()=>{
  if(!allowed()||!pending)return;
  if(pending.identity!==getIdentity()){reset();note('The hotel changed. Choose the file again.');return;}
  const incoming=pending.data;let committed=false;enabled(false);setApplying(true);note('Importing your hotel…');
  try{
   // Suppress old autosaves before queuing the replacement. Earlier writes finish
   // first; every write, including this one, rechecks the exact owner token.
   if(!await guard.write(incoming))throw Error('Could not import in this tab. Your hotel was not replaced.');
   committed=true;pending=null;reload();
  }catch(error){if(committed){note('Import saved. Reload this page to open your hotel.');return;}setApplying(false);enabled(true);note(error.message||'Import failed. Your hotel is unchanged.');}
 };
 return {cancel(){if(!busy)reset();},get busy(){return busy;}};
}
export function downloadPortableSave(text,name){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
