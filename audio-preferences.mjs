/** Slot adoption must never turn sound back on after the current player muted it.
 * No new storage layer: ordinary settings controls can explicitly re-enable sound.
 * Track, nonzero volume and visual weather preferences still belong to each hotel.
 */
export function preserveAudioMute(current,next){
 const result={...next};
 for(const channel of ['music','effects','weather']){
  if(current?.[channel+'Enabled']===false)result[channel+'Enabled']=false;
  if(current?.[channel+'Volume']===0)result[channel+'Volume']=0;
 }
 return result;
}
