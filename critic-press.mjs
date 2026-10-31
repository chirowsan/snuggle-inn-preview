/** R3 secret critic: a richer, family-friendly write-up layered on top of the existing
 * Copperleaf Gazette article. Pure functions; the sim article (and its rank effect)
 * stays the single source of truth for the stars. State lives in saved.manage.press. */
export const PRESS_KEEP=6;
export const PRESS_REWARD=Object.freeze({good:15,great:20,mixed:5,bad:0});
const HEADLINES=Object.freeze({
 good:['Snuggle Inn: the cosiest secret in town','Fluffy towels, faster smiles','Our critic did not want to check out','Five-paw service on a quiet street','Tea, towels and a perfect pillow'],
 mixed:['Charming inn, still finding its rhythm','Warm hearts, a few slow bells','Lovely rooms, worth a second visit','A sweet stay with room to grow'],
 bad:['A gentle inn on a busy day','Kind staff, long waits','Good bones, sleepy service','We will try again next season'],
});
const LINES={
 checkin:['I was greeted almost before I set down my bag.','Check-in took a little while, but the lobby was pleasant.','I waited a long time at the front desk.'],
 room:['My room was spotless and ready.','','My room was not quite ready when I arrived.'],
 service:['Every request arrived promptly.','Most of my requests were looked after.','Several of my requests went unanswered.'],
 meal:['Dinner came hot and quickly. Delicious!','My meal came, if a touch slowly.','I never did get my dinner.'],
};
export const verdictFor=stars=>stars>=4?'good':stars===3?'mixed':'bad';
const grade=(ok,mid)=>ok?2:mid?1:0;
/** Build a report from the finished shift. Returns null when no critic article exists. */
export function pressReport(state){
 const a=state?.reputation?.article;if(!a)return null;
 const g=state.guests?.find(x=>x.id===a.guestId);const issue=Number(String(a.shiftId).slice(6))||0;if(!g||!issue)return null;
 const pat=Math.max(1,state.config?.waitingPatience||1),wait=Math.max(0,g.waitElapsed||0)/pat;
 const kinds=(g.serviceProof||[]).map(p=>p.kind),wantsMeal=(g.itinerary||[]).includes('meal');
 const checkin=a.kind==='welcome'?0:grade(wait<.35,wait<.75);
 const room=a.kind==='welcome'?0:a.clean?2:0;
 const service=a.kind==='welcome'?0:grade(a.completed===a.requested&&!a.longWait,a.completed*2>=a.requested);
 const meal=!wantsMeal?-1:kinds.includes('meal')?(a.longWait?1:2):0;
 const tidy=a.clean&&a.finished?2:a.clean||a.finished?1:0;
 const verdict=verdictFor(a.stars),pool=HEADLINES[verdict];
 const headline=pool[issue%pool.length];
 const parts=[LINES.checkin[2-checkin],LINES.room[2-room],LINES.service[2-service],meal>=0?LINES.meal[2-meal]:''].filter(Boolean);
 if(a.kind==='welcome')parts.splice(0,parts.length,'I waited at the front desk and slipped away before checking in. I hope to return on a calmer day.');
 const quote=parts.join(' ');
 const reward=verdict==='good'?(a.stars===5?PRESS_REWARD.great:PRESS_REWARD.good):verdict==='mixed'?PRESS_REWARD.mixed:0;
 return {issue,stars:a.stars,verdict,checkin,room,service,meal,tidy,headline,quote,reward};
}
const KEYS=['issue','stars','verdict','checkin','room','service','meal','tidy','headline','quote','reward'];
const int=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
export function validPressReport(r){
 return !!r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).length===KEYS.length&&KEYS.every(k=>Object.hasOwn(r,k))
  &&int(r.issue,1,1e9)&&int(r.stars,1,5)&&['good','mixed','bad'].includes(r.verdict)&&r.verdict===verdictFor(r.stars)
  &&int(r.checkin,0,2)&&int(r.room,0,2)&&int(r.service,0,2)&&int(r.meal,-1,2)&&int(r.tidy,0,2)
  &&typeof r.headline==='string'&&r.headline.length<=80&&typeof r.quote==='string'&&r.quote.length<=400&&int(r.reward,0,50);
}
export function defaultPress(){return {issues:[],seen:1,coins:0};}
export function validPress(p){return !!p&&typeof p==='object'&&!Array.isArray(p)&&Array.isArray(p.issues)&&p.issues.length<=PRESS_KEEP&&p.issues.every(validPressReport)
 &&p.issues.every((r,i,all)=>!i||all[i-1].issue<r.issue)&&(p.seen===0||p.seen===1)&&int(p.coins,0,1e7);}
export function migratePress(raw){
 const p=defaultPress();if(!raw||typeof raw!=='object')return p;
 if(Array.isArray(raw.issues))for(const r of raw.issues)if(validPressReport(r)&&(!p.issues.length||p.issues.at(-1).issue<r.issue))p.issues.push({...r});
 p.issues=p.issues.slice(-PRESS_KEEP);p.seen=raw.seen===0&&p.issues.length?0:1;p.coins=int(raw.coins,0,1e7)?raw.coins:0;return p;
}
/** Idempotent per issue. Adds the reward to the bank between shifts and stages the morning paper. */
export function recordPress(profile,press,state){
 const r=pressReport(state);if(!r||!press||profile?.activeShift)return null;
 if(press.issues.length&&press.issues.at(-1).issue>=r.issue)return null;
 press.issues=[...press.issues,r].slice(-PRESS_KEEP);press.seen=0;
 if(r.reward&&Number.isSafeInteger(profile.bank+r.reward)){profile.bank+=r.reward;press.coins+=r.reward;}
 return r;
}
export function markPressSeen(press){if(press)press.seen=1;}
export const GRADE_WORD=['Needs care','Fine','Lovely'];
