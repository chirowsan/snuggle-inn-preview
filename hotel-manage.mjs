/** R3 Wave 2 management layer: garden friends (bug-tap visits), Olive's tea visit,
 * monthly bills and the manager's desk. State lives in saved.manage with its own
 * version, and never touches the shift simulation or its checkpoint. Every
 * consequence is soft: no debt, no lost guests, no blocked rooms. */
import {defaultPress,migratePress,validPress} from './critic-press.mjs';
export const MANAGE_VERSION=1;
export const FRIENDS=Object.freeze([
 {id:'ladybug',name:'Ladybug',emoji:'🐞'},{id:'bee',name:'Bumblebee',emoji:'🐝'},
 {id:'snail',name:'Snail',emoji:'🐌'},{id:'butterfly',name:'Butterfly',emoji:'🦋'},{id:'firefly',name:'Firefly',emoji:'✨'}]);
export const FRIEND_IDS=Object.freeze(FRIENDS.map(f=>f.id));
export const BUG_VISIT_FROM_SHIFT=3;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,k)=>object(v)?Object.getOwnPropertyDescriptor(v,k)?.value:undefined;
const int=(v,min=0,max=1e9)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const keep=(v,fb,min=0,max=1e9)=>int(v,min,max)?v:fb;
export function defaultManage(){
 return {version:MANAGE_VERSION,friends:Object.fromEntries(FRIEND_IDS.map(id=>[id,0])),tips:0,bugShift:0,recorded:0,
  olive:{due:0,prep:0,seals:0,visits:0,last:null},month:{income:0,shifts:0,seen:1,last:null},press:defaultPress(),
  crew:{engineer:0,fixes:0},outage:{shift:0,fixed:0,last:null}};
}
/** Any old, missing or damaged value becomes a valid v1 record. Counts are kept
 * when readable; anything unreadable falls back to a fresh default. */
export function migrateManage(raw){
 const m=defaultManage();
 if(!object(raw))return m;
 const version=own(raw,'version');
 if(version!==undefined&&version!==0&&version!==1)return m; // unknown future format: start fresh, never crash
 const f=own(raw,'friends');for(const id of FRIEND_IDS)m.friends[id]=keep(own(f,id),0,0,99999);
 m.tips=keep(own(raw,'tips'),0,0,9999);m.bugShift=keep(own(raw,'bugShift'),0);m.recorded=keep(own(raw,'recorded'),0);
 const o=own(raw,'olive');
 if(object(o)){m.olive.due=keep(own(o,'due'),0);m.olive.prep=keep(own(o,'prep'),0,0,7);m.olive.seals=keep(own(o,'seals'),0,0,99999);m.olive.visits=keep(own(o,'visits'),0,0,99999);
  const l=own(o,'last');if(object(l)&&int(own(l,'shift'),1)&&int(own(l,'done'),0,3)&&int(own(l,'reward'),0,999))m.olive.last={shift:l.shift,done:l.done,reward:l.reward};}
 const mo=own(raw,'month');
 if(object(mo)){m.month.income=keep(own(mo,'income'),0,0,1e7);m.month.shifts=keep(own(mo,'shifts'),0,0,99);m.month.seen=own(mo,'seen')===0?0:1;
  const l=own(mo,'last');if(validBill(l))m.month.last={...l};}
 m.press=migratePress(own(raw,'press'));
 const cr=own(raw,'crew');if(object(cr)){m.crew.engineer=own(cr,'engineer')===1?1:0;m.crew.fixes=keep(own(cr,'fixes'),0,0,99999);}
 const ou=own(raw,'outage');if(object(ou)){m.outage.shift=keep(own(ou,'shift'),0);m.outage.fixed=keep(own(ou,'fixed'),0,0,99999);if(validOutageLast(own(ou,'last')))m.outage.last={...ou.last};}
 return m;
}
const BILL_KEYS=['month','income','wages','upkeep','bill','paid','waived','welcome'];
function validBill(l){return object(l)&&Object.keys(l).length===BILL_KEYS.length&&BILL_KEYS.every(k=>int(own(l,k),0,1e7))&&l.month>=1&&l.welcome<=1&&l.paid+l.waived===l.bill&&l.wages+l.upkeep===l.bill;}
export function validManage(m){
 if(!object(m)||own(m,'version')!==MANAGE_VERSION||!object(own(m,'friends')))return false;
 if(Object.keys(m.friends).some(k=>!FRIEND_IDS.includes(k))||!FRIEND_IDS.every(id=>int(own(m.friends,id),0,99999)))return false;
 if(!int(own(m,'tips'),0,9999)||!int(own(m,'bugShift'))||!int(own(m,'recorded')))return false;
 const o=own(m,'olive');if(!object(o)||!int(own(o,'due'))||!int(own(o,'prep'),0,7)||!int(own(o,'seals'),0,99999)||!int(own(o,'visits'),0,99999))return false;
 const l=own(o,'last');if(!(l===null||object(l)&&int(own(l,'shift'),1)&&int(own(l,'done'),0,3)&&int(own(l,'reward'),0,999)))return false;
 const cr=own(m,'crew'),ou=own(m,'outage');
 if(!object(cr)||!(cr.engineer===0||cr.engineer===1)||!int(own(cr,'fixes'),0,99999))return false;
 if(!object(ou)||!int(own(ou,'shift'))||!int(own(ou,'fixed'),0,99999)||!(own(ou,'last')===null||validOutageLast(ou.last)))return false;
 const mo=own(m,'month');return object(mo)&&int(own(mo,'income'),0,1e7)&&int(own(mo,'shifts'),0,99)&&(mo.seen===0||mo.seen===1)&&(own(mo,'last')===null||validBill(mo.last))&&validPress(own(m,'press'));
}
/** A garden-friend visit happens once per shift from the third shift on. The
 * shift ordinal (shiftsCompleted+1) makes the plan deterministic and replay-free. */
export function bugVisitPlan(profile,manage){
 const n=(profile?.shiftsCompleted|0)+1;
 if(n<BUG_VISIT_FROM_SHIFT||!manage||manage.bugShift>=n)return null;
 const count=3+(n%2),first=n%FRIEND_IDS.length;
 const species=Array.from({length:count},(_,i)=>FRIEND_IDS[(first+(i%2))%FRIEND_IDS.length]);
 return {shift:n,at:3+(n%3),species};
}
export function markBugVisit(manage,shift){if(int(shift,1)&&shift>manage.bugShift)manage.bugShift=shift;return manage;}
export function helpFriend(manage,species){
 if(!FRIEND_IDS.includes(species))return {ok:false,first:false,amount:0};
 manage.friends[species]=Math.min(99999,manage.friends[species]+1);manage.tips=Math.min(9999,manage.tips+1);
 return {ok:true,first:manage.friends[species]===1,amount:1,species};
}
/** Tips are paid into the bank only between shifts (like a purchase), never mid-shift. */
export function payTips(profile,manage){
 if(!profile||profile.activeShift||!manage?.tips)return 0;
 const amount=manage.tips;if(!Number.isSafeInteger(profile.bank+amount))return 0;
 profile.bank+=amount;manage.tips=0;return amount;
}
export function friendsMet(manage){return FRIENDS.filter(f=>manage?.friends?.[f.id]>0).length;}

/* ---- Olive's tea visit (Wave 2 item 2) ----
 * From the 4th shift on, after the 2nd shift of each five-shift month a letter
 * says Olive the owl drops by for tea next shift. Between shifts the player may
 * get ready with three different gentle actions. The visit is always friendly:
 * every task done adds a little tip, all three earn a Cozy Seal; zero is fine. */
export const OLIVE_FROM_SHIFT=4;
export const OLIVE_TASKS=Object.freeze([
 {id:'pillows',bit:1,name:'Fluff the pillows',hint:'Tap 3 times',icon:'🛏️'},
 {id:'bell',bit:2,name:'Polish the desk bell',hint:'Rub it back and forth',icon:'🛎️'},
 {id:'plants',bit:4,name:'Water the plants',hint:'Press and hold',icon:'🪴'}]);
export const oliveReward=done=>done>0?2+4*done+(done===3?4:0):2;
const bits=n=>(n&1)+(n>>1&1)+(n>>2&1);
export function olivePrepCount(manage){return bits(manage?.olive?.prep|0);}
export function oliveDue(manage){return manage?.olive?.due|0;}
export function prepOlive(manage,id){
 const t=OLIVE_TASKS.find(x=>x.id===id);if(!t||!manage?.olive?.due)return false;
 if(manage.olive.prep&t.bit)return false;manage.olive.prep|=t.bit;return true;
}
/** Called once a shift has been settled (between shifts). Idempotent per
 * shiftsCompleted, so a re-shown result never pays twice. Returns what happened. */
export function recordShift(profile,manage,{net=0}={}){
 const out={letter:false,visit:null,bill:null};
 if(!profile||profile.activeShift||!manage)return out;
 const c=profile.shiftsCompleted|0;if(c<=manage.recorded)return out;manage.recorded=c;
 const o=manage.olive;
 if(o.due&&c>=o.due){
  const done=bits(o.prep),reward=oliveReward(done);
  if(Number.isSafeInteger(profile.bank+reward))profile.bank+=reward;
  o.visits=Math.min(99999,o.visits+1);if(done===3)o.seals=Math.min(99999,o.seals+1);
  o.last={shift:c,done,reward};o.due=0;o.prep=0;out.visit=o.last;
 }else if(!o.due&&c>=OLIVE_FROM_SHIFT&&c%5===2){o.due=c+1;o.prep=0;out.letter=true;}
 const mo=manage.month;mo.income=Math.min(1e7,mo.income+Math.max(0,Number.isSafeInteger(net)?net:0));mo.shifts=Math.min(99,mo.shifts+1);
 if(c%MONTH_SHIFTS===0)out.bill=closeMonth(profile,manage,c/MONTH_SHIFTS);
 return out;
}
export function oliveVisitWords(done){
 return ['“What a calm little inn. Thank you for the tea!”','“Fluffy and friendly. Lovely tea!”','“So tidy and warm. I’ll be back!”','“Perfectly cozy! A Cozy Seal for you.”'][done]||'';
}

/* ---- Monthly bills (Wave 2 item 3) ----
 * A month is five shifts. At its end helpers get a small wage and the inn pays
 * a little upkeep. Bills are gentle: the first month is on the house, a bill
 * never takes more than 30% of that month's takings or more than the bank, and
 * whatever is left over is simply waived. No debt, ever. */
export const MONTH_SHIFTS=5,BILL_SHARE=.3;
export const WAGES=Object.freeze({pip:10,bramble:10,rue:20,tink:15});
export const UPKEEP=Object.freeze({room:4,venue:10});
export function monthBill(profile,manage=null){
 const team=[{id:'pip',name:'Pip',job:'deliveries',wage:WAGES.pip},{id:'bramble',name:'Bramble',job:'fixes & laundry',wage:WAGES.bramble}];
 if((profile?.staffCount|0)>=3)team.push({id:'rue',name:'Rue',job:'routine chores',wage:WAGES.rue});
 if(manage?.crew?.engineer===1)team.push({id:'tink',name:'Tink',job:'engineer · fixes breakages',wage:WAGES.tink});
 const rooms=Math.max(0,profile?.openRooms|0);
 const venues=[...Object.values(profile?.facilities||{}),...Object.values(profile?.leisure||{})].filter(v=>Number.isSafeInteger(v)&&v>0).length;
 const wages=team.reduce((a,t)=>a+t.wage,0),upkeep=rooms*UPKEEP.room+venues*UPKEEP.venue;
 return {team,rooms,venues,wages,upkeep,bill:wages+upkeep};
}
function closeMonth(profile,manage,month){
 const mo=manage.month,b=monthBill(profile,manage),welcome=month===1?1:0;
 const cap=welcome?0:Math.max(0,Math.min(Math.floor(mo.income*BILL_SHARE),profile.bank|0));
 const paid=Math.min(b.bill,cap);profile.bank-=paid;
 mo.last={month,income:mo.income,wages:b.wages,upkeep:b.upkeep,bill:b.bill,paid,waived:b.bill-paid,welcome};
 mo.income=0;mo.shifts=0;mo.seen=0;return mo.last;
}
export function monthProgress(profile,manage){const c=profile?.shiftsCompleted|0;return {month:Math.floor(c/MONTH_SHIFTS)+1,shift:c%MONTH_SHIFTS,of:MONTH_SHIFTS,income:manage?.month?.income|0};}
export function markMonthSeen(manage){if(manage?.month)manage.month.seen=1;}

/* ---- Tink the engineer + gentle outages (R3 item 8) ----
 * Tink is a later unlock hired once on the Desk. Once hired he spots breakages
 * (room repair requests) and fixes them through the normal repair command, and
 * he sorts out outages too. An outage (blackout or leak) is soft: the shift keeps
 * running, it clears by itself, and fixing it yourself earns a small thank-you
 * paid between shifts with the garden tips. */
export const ENGINEER=Object.freeze({id:'tink',name:'Tink',emoji:'🦫',fromShift:15,price:250,spotDelay:2.5});
export const OUTAGE_FROM_SHIFT=8,OUTAGE_EVERY=4,OUTAGE_REWARD=6,OUTAGE_SELF_CLEAR=25;
export const OUTAGE_KINDS=Object.freeze({
 blackout:{id:'blackout',name:'Blackout',icon:'💡',hint:'Swipe the breaker lever up',done:'Lights back on. Cozy again!'},
 leak:{id:'leak',name:'Leaky pipe',icon:'💧',hint:'Turn the valve around once',done:'Drip stopped. All dry!'}});
const OUT_BY=['you','tink','self'];
function validOutageLast(l){return object(l)&&Object.keys(l).length===4&&int(own(l,'shift'),1)&&Object.hasOwn(OUTAGE_KINDS,own(l,'kind'))&&OUT_BY.includes(own(l,'by'))&&int(own(l,'reward'),0,99);}
export const engineerHired=m=>m?.crew?.engineer===1;
export function engineerGate(profile,manage){
 if(engineerHired(manage))return {state:'hired',text:''};
 const c=profile?.shiftsCompleted|0;
 if(c<ENGINEER.fromShift)return {state:'locked',text:'🔒 Joins from shift '+ENGINEER.fromShift+' ('+c+'/'+ENGINEER.fromShift+')'};
 if((profile?.bank|0)<ENGINEER.price)return {state:'short',text:'Needs 🪙 '+ENGINEER.price};
 return {state:'ready',text:'Hire · 🪙 '+ENGINEER.price};
}
export function hireEngineer(profile,manage){
 if(!profile||profile.activeShift||!manage||engineerGate(profile,manage).state!=='ready')return false;
 profile.bank-=ENGINEER.price;manage.crew.engineer=1;return true;
}
export function noteEngineerFix(manage){if(engineerHired(manage))manage.crew.fixes=Math.min(99999,manage.crew.fixes+1);}
/** Deterministic per shift ordinal: from shift 8, every 4th shift, alternating kinds. */
export function outagePlan(profile,manage){
 const n=(profile?.shiftsCompleted|0)+1;
 if(n<OUTAGE_FROM_SHIFT||n%OUTAGE_EVERY!==0||!manage||manage.outage.shift>=n)return null;
 return {shift:n,kind:(n/OUTAGE_EVERY)%2?'leak':'blackout',at:20+(n%7)};
}
export function startOutage(manage,shift){if(int(shift,1)&&shift>manage.outage.shift)manage.outage.shift=shift;return manage;}
export function resolveOutage(manage,{shift,kind,by}){
 if(!manage||!int(shift,1)||!Object.hasOwn(OUTAGE_KINDS,kind)||!OUT_BY.includes(by))return null;
 if(manage.outage.last?.shift===shift)return null; // once per shift
 const reward=by==='you'?OUTAGE_REWARD:0;
 if(by!=='self')manage.outage.fixed=Math.min(99999,manage.outage.fixed+1);
 if(by==='tink')noteEngineerFix(manage);
 if(reward)manage.tips=Math.min(9999,manage.tips+reward);
 manage.outage.last={shift,kind,by,reward};return manage.outage.last;
}
