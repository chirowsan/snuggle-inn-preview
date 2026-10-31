/** Slot-local land exchange. Pure candidates only: commit through the protected slot guard. */
export const LOCATIONS=Object.freeze([
 Object.freeze({id:'garden',name:'Garden Courtyard',price:400,description:'Leafy paths and a sheltered neighborhood garden.'}),
 Object.freeze({id:'lake',name:'Willow Lake',price:1200,description:'Still blue water, reed beds and a little timber dock.'}),
 Object.freeze({id:'marina',name:'Moonlit Marina',price:2600,description:'A lantern-lit waterfront promenade and distant city lights.'}),
]);
const own=(v,k)=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,k)?.value:undefined;
const int=n=>Number.isSafeInteger(n)&&n>=0;
const clone=v=>JSON.parse(JSON.stringify(v));
const find=id=>LOCATIONS.find(l=>l.id===id);
export const initialLocation=()=>({version:1,id:'garden',paid:0,revision:0,receipt:null});
export function validLocation(v){
 if(!v||own(v,'version')!==1||!find(own(v,'id'))||!int(own(v,'revision')))return false;
 const id=own(v,'id'),paid=own(v,'paid'),rev=own(v,'revision'),r=own(v,'receipt');
 if(rev===0)return id==='garden'&&paid===0&&r===null;
 if(paid!==find(id).price||!r||own(r,'revision')!==rev||own(r,'to')!==id||!find(own(r,'from'))||r.from===id)return false;
 if(!int(r.before)||!int(r.proceeds)||!int(r.before+r.proceeds)||!int(r.after)||r.cost!==paid||r.after!==r.before+r.proceeds-r.cost)return false;
 return [0,Math.floor(find(r.from).price*.75)].includes(r.proceeds)&&(r.proceeds!==0||r.from==='garden');
}
/** Absent means legacy, not an added field: exact old profile serialization remains unchanged. */
export function copyLocation(v){return validLocation(v)?clone(v):null;}
export function locationOf(profile){return profile.location===undefined?initialLocation():copyLocation(profile.location);}
export function locationOffer(profile,to){
 const current=locationOf(profile),target=find(to);
 const proceeds=current?Math.floor(current.paid*.75):0,cost=target?.price||0;
 const finalBalance=profile.bank+proceeds-cost;
 const reason=!current||!int(profile.bank)?'This hotel location save needs attention.':!target?'Choose a location.':
 profile.activeShift?'Finish the current shift before moving.':profile.construction?.project?'Finish construction before moving.':
 current.id===to?'Your hotel is already here.':current.revision>=Number.MAX_SAFE_INTEGER?'No more move receipts are available.':
 !Number.isSafeInteger(profile.bank+proceeds)||!Number.isSafeInteger(finalBalance)?'The resulting balance is too large.':finalBalance<0?`Need ${-finalBalance} more coins.`:'';
 return {ok:!reason,reason,from:current?.id,to,revision:current?.revision,before:profile.bank,proceeds,cost,finalBalance};
}
/** Confirmation is bound to both location revision and exact quote; never mutates the original. */
export function prepareLocationMove(profile,quote){
 const current=locationOffer(profile,quote?.to);
 if(!current.ok)return current;
 if(!quote||['from','to','revision','before','proceeds','cost','finalBalance'].some(k=>quote[k]!==current[k]))return {ok:false,reason:'This offer changed. Review the new balance before confirming.'};
 const next=clone(profile),revision=current.revision+1;
 const receipt={revision,from:current.from,to:current.to,before:current.before,proceeds:current.proceeds,cost:current.cost,after:current.finalBalance};
 next.bank=current.finalBalance;next.location={version:1,id:current.to,paid:current.cost,revision,receipt};
 return {ok:true,profile:next,receipt};
}
/** Single-flight coordinator. Caller must freeze other input and pass the CURRENT slot at confirmation. */
export function createLocationMover({read,commit,adopt,validate=()=>true}){
 let busy=false,recoveryRequired=false;
 return {get busy(){return busy;},get recoveryRequired(){return recoveryRequired;},async confirm(quote){
  if(recoveryRequired)return {ok:false,recoveryRequired:true,reason:'Reload this hotel to verify the previous move before trying again.'};
  if(busy)return {ok:false,reason:'A move is already saving.'};
  busy=true;
  try{
   const before=read();if(!validate(before.profile))return {ok:false,reason:'This hotel save needs attention.'};
   if(quote.slot!==before.slot)return {ok:false,reason:'The selected hotel changed. Review this hotel first.'};
   const result=prepareLocationMove(before.profile,quote);if(!result.ok)return result;
   const candidate={...clone(before),profile:result.profile};
   if(!await commit(candidate))return {ok:false,reason:'The move was not saved. Your hotel has not changed.'};
   adopt(candidate);return result;
  }catch{recoveryRequired=true;return {ok:false,recoveryRequired:true,reason:'Could not verify the move. Reload this hotel before trying again.'};}
  finally{busy=false;}
 }};
}
