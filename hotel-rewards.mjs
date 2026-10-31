/** Small, device-local rewards. No timers, storage, streaks or network authority. */
export const REWARD_RULES = Object.freeze({version:1,missionCoins:20,dailyCoins:25});
const own=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.getOwnPropertyDescriptor(v,k)?.value:undefined;
const states=['todo','earned','claimed','legacy'];
const keys=['welcome','care'];
const dateKey=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='0001-01-01'&&v<='9999-12-31'&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function localRewardDay(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||now.getFullYear()<1||now.getFullYear()>9999)return null;
 return `${String(now.getFullYear()).padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function freshRewards(intro=true){return {version:1,missions:{welcome:intro?'todo':'legacy',care:intro?'todo':'legacy'},daily:{lastClaimDay:null,latestDay:null}};}
export function validRewards(raw){
 const missions=own(raw,'missions'),daily=own(raw,'daily'),last=own(daily,'lastClaimDay'),latest=own(daily,'latestDay');
 return own(raw,'version')===1&&keys.every(k=>states.includes(own(missions,k)))&&
  (own(missions,'welcome')==='legacy')===(own(missions,'care')==='legacy')&&
  (last===null||dateKey(last))&&(latest===null||dateKey(latest))&&(!last||!!latest&&latest>=last);
}
export function copyRewards(raw){
 if(!validRewards(raw))return freshRewards(false); // Never turn corrupt/older data into a fresh payout.
 return {version:1,missions:Object.fromEntries(keys.map(k=>[k,own(own(raw,'missions'),k)])),daily:{lastClaimDay:own(own(raw,'daily'),'lastClaimDay'),latestDay:own(own(raw,'daily'),'latestDay')}};
}
/** Read actual engine proof after work succeeds, not the click that requests it.
 * A reload may observe the same proof: monotone flags make that harmless. */
export function observeMissionProgress(profile,state){
 const rewards=profile?.rewards;if(!validRewards(rewards)||!state||profile.activeShift?.id!==state.shiftId)return [];
 const completed=[];
 const welcomed=state.guests?.some(g=>g.roomProof&&g.roomProof.roomId===g.roomId&&Number.isFinite(g.roomProof.checkedInAt)&&g.roomProof.checkedInAt<=state.time);
 const cared=state.guests?.some(g=>g.paid===true&&g.payment>0&&g.roomProof&&g.towelsReceived>0);
 for(const [id,done] of [['welcome',welcomed],['care',cared]])if(done&&rewards.missions[id]==='todo'){rewards.missions[id]='earned';completed.push(id);}
 return completed;
}
/** Observing a future date raises a high-water mark; moving backward never reopens a gift. */
export function observeRewardDay(profile,now=new Date()){
 const r=profile?.rewards,day=localRewardDay(now);if(!validRewards(r)||!day)return false;
 if(!r.daily.latestDay||day>r.daily.latestDay){r.daily.latestDay=day;return true;}return false;
}
export function rewardSummary(profile,now=new Date()){
 const r=profile?.rewards,day=localRewardDay(now),valid=validRewards(r);
 const pending=valid?keys.filter(k=>r.missions[k]==='earned'):[];
 const rollback=valid&&!!day&&!!r.daily.latestDay&&day<r.daily.latestDay;
 const dailyAvailable=valid&&!!day&&!rollback&&(!r.daily.lastClaimDay||day>r.daily.lastClaimDay);
 return {pending,missionCoins:pending.length*REWARD_RULES.missionCoins,dailyCoins:REWARD_RULES.dailyCoins,dailyAvailable,rollback,
  dailyNote:!valid||!day?'🎁 No gift on this device.':rollback?'📅 Date moved back. Gift waits a day.':!dailyAvailable?'🌙 See you tomorrow!':'🎁 One free gift each day.'};
}
export function missionObjectiveSuffix(profile,taskId){
 const key=taskId==='check-in'?'welcome':taskId==='payment'?'care':null;
 return key&&profile?.rewards?.missions?.[key]==='todo'?' · +20 coins':'';
}
/** Called only on a private transaction candidate; the session layer commits it. */
export function reserveReward(profile,kind,now=new Date()){
 if(!validRewards(profile?.rewards))return {ok:false,code:'invalid-rewards'};
 observeRewardDay(profile,now);const summary=rewardSummary(profile,now);
 if(kind==='missions'){
  if(!summary.pending.length)return {ok:false,code:'already-collected'};
  for(const id of summary.pending)profile.rewards.missions[id]='claimed';
  return {ok:true,kind,coins:summary.missionCoins,label:'Mission thank-you'};
 }
 if(kind==='daily'){
  if(!summary.dailyAvailable)return {ok:false,code:summary.rollback?'clock-rollback':'already-collected'};
  profile.rewards.daily.lastClaimDay=localRewardDay(now);
  return {ok:true,kind,coins:summary.dailyCoins,label:'A little daily gift'};
 }
 return {ok:false,code:'unknown-reward'};
}
