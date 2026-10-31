/** Rue uses the same atomic commands, stocks, routes and receipts as the player.
 * No background clocks, new worker system, wages or passive-income multiplier. */
export const STAFF_ROUTINES=Object.freeze({
 welcome:'Check-in',towel:'Towels',clean:'Room tidying',wash:'Washing',fold:'Folding',meal:'Meal delivery',repair:'Repairs',
 'cook:garden':'Garden breakfast','cook:tea':'Tea breakfast','cook:pancake':'Pancake breakfast',
 'visit:restaurant:ramen':'Ramen','visit:restaurant:sushi':'Sushi','visit:restaurant:stirfry':'Chinese kitchen',
 'visit:restaurant:crepe':'Crêpes','visit:restaurant:pasta':'Pasta','visit:restaurant:pizza':'Pizza',
 'visit:salon':'Salon','visit:spa':'Spa','visit:lounge':'Music lounge','visit:theater':'Theater',
});
const keys=Object.keys(STAFF_ROUTINES),own=(v,k)=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,k)?.value:undefined;
const list=raw=>Array.isArray(raw)&&raw.length<=keys.length&&Array.from({length:raw.length},(_,i)=>own(raw,String(i))).every((k,i)=>keys.includes(k)&&raw.indexOf(k)===i);
export function validStaffPlan(p){return !!p&&typeof p==='object'&&!Array.isArray(p)&&own(p,'version')===1&&typeof own(p,'enabled')==='boolean'&&list(own(p,'learned'));}
export function copyStaffPlan(p){return validStaffPlan(p)?{version:1,enabled:p.enabled,learned:[...p.learned]}:null;}
export function staffPlanForProfile(p){
 if(p.staffAutomation!==undefined)return copyStaffPlan(p.staffAutomation);
 if(!p.firstSteps&&p.staffCount!==3)return null;
 return {version:1,enabled:!!p.firstSteps,learned:p.guestsCompleted>0?['welcome','towel']:[]};
}
export function initializeStaffState(s,plan){s.staffAutomation={...copyStaffPlan(plan),nextAt:0};}
export function staffRoutineKey(s,kind){return kind==='restaurant'?`visit:restaurant:${s.config.restaurantCuisine}`:['salon','spa','lounge','theater'].includes(kind)?`visit:${kind}`:kind;}
export function learnStaffRoutine(s,kind){
 const plan=s.staffAutomation,key=staffRoutineKey(s,kind);
 if(plan&&keys.includes(key)&&!plan.learned.includes(key)&&staffDutyOpen(key,s.config?.completedShifts))plan.learned.push(key);
}
export function validateStaffState(s){
 const plan=s.config?.staffPlan,current=s.staffAutomation;
 if(plan===undefined)return current===undefined;
 return validStaffPlan(plan)&&validStaffPlan(current)&&current.enabled===plan.enabled&&plan.learned.every(k=>current.learned.includes(k))&&
  Number.isFinite(current.nextAt)&&current.nextAt>=0&&current.nextAt<=s.time+2.01;
}
export function settleStaffLearning(profile,state){if(state?.staffAutomation&&validStaffPlan(state.staffAutomation))profile.staffAutomation=copyStaffPlan(state.staffAutomation);}
/** R3: the first helper arrives only after real hands-on growth. Computed from the
 * profile, so saves need no migration; a hotel that already hired keeps Rue. */
export const STAFF_HIRE_REQUIREMENTS=Object.freeze({rooms:4,shifts:12,guests:30});
export function staffHireProgress(p){const R=STAFF_HIRE_REQUIREMENTS;return [
 {id:'rooms',icon:'🛏️',have:Math.min(R.rooms,p.openRooms|0),need:R.rooms},
 {id:'shifts',icon:'🌙',have:Math.min(R.shifts,p.shiftsCompleted|0),need:R.shifts},
 {id:'guests',icon:'💛',have:Math.min(R.guests,p.guestsCompleted|0),need:R.guests}];}
export function staffHireGate(p){
 if(p.staffCount>=3)return '';
 const left=staffHireProgress(p).filter(x=>x.have<x.need);
 return left.length?'🔒 Rue joins later: '+left.map(x=>x.icon+' '+x.have+'/'+x.need).join(' · '):'';
}
export function staffHirePrice(p,fallback=200){return fallback;}
/** Rue may only learn a duty once the hotel has grown this far (completed shifts).
 * Gates only block learning NEW duties; anything already learned is kept. */
export const STAFF_DUTY_GATES=Object.freeze({welcome:12,towel:16,wash:16,fold:16,clean:20,meal:26,cook:26,restaurant:30,repair:34,salon:38,spa:42,lounge:48,theater:54});
export function staffDutyGate(key){const k=key.startsWith('cook:')?'cook':key.startsWith('visit:restaurant')?'restaurant':key.startsWith('visit:')?key.slice(6):key;return STAFF_DUTY_GATES[k]??0;}
export function staffDutyOpen(key,completedShifts){return !Number.isInteger(completedShifts)||completedShifts>=staffDutyGate(key);}
export function setStaffEnabled(p,enabled){
 if(p.activeShift||p.staffCount!==3||typeof enabled!=='boolean')return false;
 const plan=staffPlanForProfile(p);if(!plan)return false;plan.enabled=enabled;p.staffAutomation=plan;return true;
}
export const staffCanStart=s=>!!(s.actors?.helper&&s.staffAutomation?.enabled&&s.staffAutomation.learned.includes('welcome'));
const liveGuests=s=>s.guests.some(g=>!['pending','departed','abandoned'].includes(g.status));
/** Read-only prioritization. Supply spending needs a waiting request and a learned
 * operation; it never fills stock speculatively or opens a new venue/activity. */
export function staffCandidates(s){
 const learned=new Set(s.staffAutomation?.learned||[]),out=[],workerId='helper';
 if(s.paused||s.status!=='playing'||!s.staffAutomation?.enabled||!s.actors?.helper)return out;
 const helper=s.actors.helper;
 // Venue service belongs to the worker already escorting this exact guest.
 if(helper.job?.type==='visitFacility'&&helper.job.phase==='waiting'){
  const id=helper.job.facilityId;if(learned.has(staffRoutineKey(s,id)))out.push({type:'serveFacility',facilityId:id});
  return out;
 }
 if(helper.job)return out;
 const rooms=[...s.rooms].filter(r=>r.status==='occupied').sort((a,b)=>a.patience-b.patience);
 for(const r of rooms){
  if(r.request==='towel'&&learned.has('towel'))out.push({type:'deliverTowel',roomId:r.id,workerId});
  if(r.request==='meal'&&learned.has('meal'))out.push({type:'deliverMeal',roomId:r.id,workerId});
  if(r.request==='repair'&&learned.has('repair'))out.push({type:'repairRoom',roomId:r.id,workerId});
  if(learned.has(staffRoutineKey(s,r.request))&&s.facilities?.[r.request]?.level)out.push({type:'visitFacility',roomId:r.id,facilityId:r.request,workerId});
 }
 const towelDemand=rooms.some(r=>r.request==='towel'),mealRoom=rooms.find(r=>r.request==='meal');
 if(towelDemand&&learned.has('towel')&&s.laundry.clean===0){
  if(learned.has('fold'))out.push({type:'finishFold'});
  if(learned.has('wash'))out.push({type:'loadWash',workerId});
 }
 if(mealRoom&&learned.has('meal')&&s.kitchen.meals===0){
  const favorite=s.guests.find(g=>g.id===mealRoom.guestId)?.preferredRecipe;
  const recipe=[favorite,'garden','tea','pancake'].find(r=>learned.has(`cook:${r}`));
  if(recipe)out.push({type:'prepFood',recipe});
 }
 if(learned.has('welcome'))for(const g of s.guests.filter(g=>g.status==='waiting'))for(const r of s.rooms.filter(r=>r.status==='available'))out.push({type:'assignRoom',guestId:g.id,roomId:r.id,workerId});
 // A learned tidy can run during checkout, but never after the shift has ended.
 if(learned.has('clean')&&liveGuests(s))for(const r of s.rooms.filter(r=>r.status==='dirty'))out.push({type:'cleanRoom',roomId:r.id,workerId});
 return out;
}
export function dispatchStaff(s,canCommand,command){
 const plan=s.staffAutomation;
 if(!plan||s.paused||s.status!=='playing'||s.time+1e-9<plan.nextAt)return null;
 for(const input of staffCandidates(s)){
  if(!canCommand(s,input).ok)continue;
  const result=command(s,input);
  if(result.ok){plan.nextAt=s.time+1;return {...result,input};}
 }
 return null;
}
