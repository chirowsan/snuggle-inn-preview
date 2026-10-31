/** Explicit pickup is one fenced slot transaction. No optimistic cash, sound,
 * receipt consumption or live mutation before durable acknowledgement. */
import {motionSessionEnvelope,restoreMotionSession} from './hotel-motion-session.mjs';
import {coinCash,collectDoorCoins,pendingDoorCoins} from './hotel-coin-pickups.mjs';
const fail=code=>({ok:false,code});
export function prepareCoinCollection(profile,session,roomId){
 try{
  const checked=restoreMotionSession(motionSessionEnvelope(profile,session));
  if(!checked.ok)return fail('invalid-session');
  const p=checked.profile,s=checked.session.state,result=collectDoorCoins(s,roomId);
  if(!result.ok)return result;
  if(!p.activeShift){
   if(!Number.isSafeInteger(p.bank+result.amount))return fail('balance-limit');
   p.bank+=result.amount;p.doorCoins=pendingDoorCoins(s);
   p.lastResult.bank=s.money;p.lastResult.coinCash=coinCash(s);p.lastResult.net=s.money-s.startingMoney;
  }
  const restored=restoreMotionSession(motionSessionEnvelope(p,checked.session));
  if(!restored.ok)return fail('invalid-coin-checkpoint');
  return {...result,profile:restored.profile,session:restored.session};
 }catch{return fail('invalid-session');}
}
export function createCoinCollector({guard,getCurrent,getData,freeze,adopt}){
 let busy=false;
 return {get busy(){return busy;},async collect(roomId){
  if(busy||!guard.active||guard.transitioning)return fail('not-writable');
  const current=getCurrent();if(!current?.profile||!current.session)return fail('not-writable');
  const candidate=prepareCoinCollection(current.profile,current.session,roomId);if(!candidate.ok)return candidate;
  busy=true;freeze(true);
  try{
   const data=getData(),envelope=motionSessionEnvelope(candidate.profile,candidate.session,data.envelope);
   const ok=await guard.write({...data,envelope});if(!ok)return fail('save-failed');
   const latest=getCurrent();
   if(!guard.active||guard.transitioning||latest?.profile!==current.profile||latest?.session!==current.session)return {...candidate,adopted:false};
   adopt(candidate);return {...candidate,adopted:true};
  }catch{return fail('save-failed');}finally{busy=false;freeze(false);}
 }};
}
