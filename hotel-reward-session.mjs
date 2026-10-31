/** Reward + claim flag + checkpoint are saved in one existing fenced slot write.
 * No live mutation or success animation occurs before durable acknowledgement. */
import {motionSessionEnvelope,restoreMotionSession} from './hotel-motion-session.mjs';
import {validProfile} from './rush-economy.mjs';
import {reserveReward} from './hotel-rewards.mjs';
const clone=v=>JSON.parse(JSON.stringify(v));
const fail=code=>({ok:false,code});
export function prepareRewardClaim(profile,session,kind,now=new Date()){
 try{
  if(!validProfile(profile))return fail('invalid-profile');
  const before=motionSessionEnvelope(profile,session),checked=restoreMotionSession(before);
  if(!checked.ok)return fail('invalid-session');
  const next=clone(before),p=next.profile,s=next.checkpoint,award=reserveReward(p,kind,now);
  if(!award.ok)return award;
  if(!Number.isSafeInteger(p.bank+award.coins))return fail('balance-limit');
  p.bank+=award.coins;
  if(p.activeShift){
   // An outside contribution is not a guest payment. Rebase the bound starting
   // balance atomically; guest earnings, tips, costs and every actor stay exact.
   if(!['playing','paused'].includes(s.status)||!Number.isSafeInteger(s.money+award.coins)||!Number.isSafeInteger(s.startingMoney+award.coins))return fail('finish-checkpoint');
   p.activeShift.startingBank+=award.coins;s.startingMoney+=award.coins;s.config.startingMoney+=award.coins;s.money+=award.coins;
  }
  const restored=restoreMotionSession(next);if(!restored.ok)return fail('invalid-reward-checkpoint');
  return {...award,profile:restored.profile,session:restored.session};
 }catch{return fail('invalid-session');}
}
export function createRewardClaimer({guard,getCurrent,getData,freeze,adopt}){
 let busy=false;
 return {get busy(){return busy;},async claim(kind,now=new Date()){
  if(busy||!guard.active||guard.transitioning)return fail('not-writable');
  const current=getCurrent();if(!current?.profile||!current.session)return fail('not-writable');
  const candidate=prepareRewardClaim(current.profile,current.session,kind,now);if(!candidate.ok)return candidate;
  busy=true;freeze(true);
  try{
   const data=getData(),envelope=motionSessionEnvelope(candidate.profile,candidate.session,data.envelope);
   const ok=await guard.write({...data,envelope});if(!ok)return fail('save-failed');
   const latest=getCurrent();
   if(!guard.active||latest?.profile!==current.profile||latest?.session!==current.session)return {...candidate,adopted:false};
   adopt(candidate);return {...candidate,adopted:true};
  }catch{return fail('save-failed');}finally{busy=false;freeze(false);}
 }};
}
