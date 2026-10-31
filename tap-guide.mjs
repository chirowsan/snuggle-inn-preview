/** Read-only tap help. Guide state lives beside settings, never in the engine save. */
import {canRushCommand} from './rush.mjs';
import {interactionTargets} from './rush-interactions.mjs';
import {requestPlan} from './hotel-request-plan.mjs';
import {floorOf} from './rush-floors.mjs';
export const TAP_GUIDE_VERSION=1;
export function restoreTapGuide(saved,{shiftId,isNew=false}={}) {
 if(saved?.version===TAP_GUIDE_VERSION&&['active','done','skipped'].includes(saved.status))return {version:TAP_GUIDE_VERSION,status:saved.status==='active'&&saved.shiftId!==shiftId?'done':saved.status,shiftId,guestId:typeof saved.guestId==='string'?saved.guestId:null,roomId:typeof saved.roomId==='string'?saved.roomId:null};
 return {version:TAP_GUIDE_VERSION,status:isNew?'active':'done',shiftId,guestId:null,roomId:null};
}
export function startTapGuide(state,shiftId,selection=null){
 const selected=selection?.kind==='guest'?state.guests.find(g=>g.id===selection.id):null;
 const pending=state.guests.find(g=>state.rooms.some(r=>r.id===g.roomId&&r.guestId===g.id&&r.status==='occupied')&&['command','activity','recovery'].includes(requestPlan(state,g.roomId).kind));
 const guest=selected||pending||state.guests.find(g=>g.visible&&g.status==='waiting')||state.guests.find(g=>!['pending','departed','abandoned'].includes(g.status));
 return {version:TAP_GUIDE_VERSION,status:state.status==='playing'?'active':'done',shiftId,guestId:guest?.id||null,roomId:guest?.roomId||null};
}
export function advanceTapGuide(guide,state,shiftId) {
 if(guide.status!=='active')return guide;
 const next={...guide};
 if(shiftId!==guide.shiftId||state.status!=='playing'){next.status='done';return next;}
 const guest=state.guests.find(g=>g.id===guide.guestId)||(!guide.guestId?state.guests.find(g=>g.visible&&!['pending','departed','abandoned'].includes(g.status)):null);
 if(guide.guestId&&!guest){next.status='done';return next;}
 if(guest){if(state.config.firstStepsRules===1&&guest.paid){next.status='done';return next;}next.guestId=guest.id;next.roomId=guest.roomId||next.roomId;const room=state.rooms.find(r=>r.id===next.roomId);if(guest.status==='abandoned'||guest.status==='departed'&&(!room||room.status!=='dirty'))next.status='done';}
 return next;
}
/** Returns one currently valid tap, never a busy station or a hidden prerequisite. */
export function nextHotelTap(state,{selection=null,floor=0,guestId=null,roomId=null}={}) {
 if(state.status!=='playing')return null;
 const go=(id,label='Tap')=>{const room=state.rooms.find(r=>r.id===id),facility=id?.startsWith('facility-')?state.facilities?.[id.slice(9)]:null;
  const dest=room?floorOf(room):facility?.floor;
  return {target:dest!=null&&dest!==floor?'floor-'+dest:id,label:dest!=null&&dest!==floor?'Tap floor':label};};
 const proposal=id=>{
  const p=requestPlan(state,id);
  if(p.kind==='command'||p.kind==='activity')return go(id,'Tap request');
  if(p.kind!=='recovery')return null;
  if(['staff-busy','washing','cooking','facility-busy'].includes(p.reason))return null;
  if(p.target==='used')return canRushCommand(state,{type:'loadWash'}).ok?go('washer','Tap wash'):null;
  if(p.target==='kitchen')return canRushCommand(state,{type:'prepFood'}).ok?go('kitchen','Tap cook'):null;
  if(p.target==='washer')return state.laundry.status==='ready'?go('washer','Tap fold'):null;
  if(p.target?.startsWith('facility-'))return state.facilities?.[p.target.slice(9)]?.status==='waiting'?go(p.target,'Tap guest'):null;
  if(p.target?.startsWith('room-'))return proposal(p.target);
  return null;
 };
 if(selection){const id=interactionTargets(state,selection)[0];if(id)return go(id,selection.kind==='guest'?'Tap room':'Tap here');}
 const focus=guestId?state.guests.find(g=>g.id===guestId):null;
 if(focus){
  if(state.config.firstStepsRules===1&&(focus.served||focus.paid))return null;
  if(focus.status==='waiting'){const id=interactionTargets(state,{kind:'guest',id:focus.id})[0];if(id)return floor===0?go('guest-'+focus.id,'Tap guest'):go('floor-0','Tap lobby');const dirty=state.rooms.find(r=>r.status==='dirty'&&(r.capacity||1)>=(focus.partySize||1));return dirty?proposal(dirty.id):null;}
  return proposal(focus.roomId||roomId);
 }
 for(const f of Object.values(state.facilities||{}))if(f.status==='waiting'&&canRushCommand(state,{type:'serveFacility',facilityId:f.id}).ok)return go('facility-'+f.id,'Tap guest');
 for(const r of state.rooms)if(r.status==='occupied'){const p=proposal(r.id);if(p)return p;}
 for(const g of state.guests)if(g.visible&&g.status==='waiting'&&interactionTargets(state,{kind:'guest',id:g.id}).length)return floor===0?go('guest-'+g.id,'Tap guest'):go('floor-0','Tap lobby');
 for(const r of state.rooms)if(r.status==='dirty'){const p=proposal(r.id);if(p)return p;}
 if(state.laundry.status==='ready')return go('washer','Tap fold');
 if(!state.laundry.clean&&canRushCommand(state,{type:'loadWash'}).ok)return go('washer','Tap wash');
 if(!state.kitchen.meals&&canRushCommand(state,{type:'prepFood'}).ok)return go('kitchen','Tap cook');
 if(state.actors.thief?.visible&&!state.actors.thief.resolved&&canRushCommand(state,{type:'callOutThief'}).ok)return go(floor===0?'rook':'floor-0','Tap');
 return null;
}
/** Exact next target within activities, shared by visual help and tests. */
export function nextActivityTap(a,selected,cookingStage,leisureStage) {
 if(!a||a.status!=='active')return null;
 if(cookingStage)return selected===cookingStage.tool?'.cooking-surface':cookingStage.gesture==='plate'?'.cooking-source':'.cooking-tool';
 if(leisureStage)return selected===leisureStage.tool?'.leisure-target':'.leisure-tool';
 if(a.kind==='bed')return !a.steps.includes('left')?'.tuck-left':!a.steps.includes('right')?'.tuck-right':selected==='pillow'?'.pillow-target':'.loose-pillow';
 if(['tray','pipe','ramen'].includes(a.kind)){
  const item=a.kind==='ramen'?a.items[a.steps.length]:selected||a.items.find(x=>!a.steps.includes(x));
  return item?(selected===item?(a.kind==='ramen'?'.ramen-drop':'.slot-'+item):'.item-'+item):null;
 }
 if(a.kind==='scrub'){const i=a.scrub.findIndex(x=>x.length<3);return i<0?null:'.stain-'+i;}
 const type={fixture:'turn',salon:'brush',spa:'soothe'}[a.kind];
 if(type){const i=[0,1,2].find(i=>!a.steps.includes(type+'-'+i));return i===undefined?null:'.target-'+i;}
 return null;
}
