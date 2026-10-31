/** Newspaper/rank rules 1. Pure, bounded, opt-in; old checkpoints are unchanged.
 * No random verdicts, currency charges or wall-clock timers. */
export const REPUTATION_RULES = 1;
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const integer = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const ordinal = id => typeof id === 'string' && /^shift-[1-9]\d*$/.test(id) ? Number(id.slice(6)) : 0;
const own=(v,k)=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,k)?.value:undefined;
export function copyReputationPlan(raw){return Object.fromEntries(['version','taught','critic','booking','pest'].map(k=>[k,own(raw,k)]));}
export function copyReputation(raw){
 const keys=['kind','shiftId','guestId','completed','requested','clean','longWait','finished','score','stars','headline','phrase'];
 const articles=own(raw,'articles');
 const result={version:own(raw,'version'),rank:own(raw,'rank'),bookings:own(raw,'bookings'),lastAppliedShift:own(raw,'lastAppliedShift'),articles:Array.isArray(articles)&&articles.length<=6?Array.from({length:articles.length},(_,i)=>Object.fromEntries(keys.map(k=>[k,own(own(articles,String(i)),k)]))):null};
 return validReputation(result)?result:null;
}
export function freshReputation() { return { version: 1, rank: 50, bookings: 0, lastAppliedShift: 0, articles: [] }; }
export function rankTitle(rank) { return rank < 30 ? 'Growing hotel' : rank < 60 ? 'Welcoming hotel' : rank < 80 ? 'Recommended stay' : 'Neighborhood favorite'; }
export const rankChange = (stars, critic = false) => (critic ? [-8,-4,0,4,8] : [-2,-1,0,1,2])[stars - 1] ?? 0;
export function validReputation(value) {
  return !!value && value.version === 1 && integer(value.rank,0,100) && integer(value.bookings,0,2)
    && integer(value.lastAppliedShift,0,Number.MAX_SAFE_INTEGER) && Array.isArray(value.articles) && value.articles.length <= 6
    && value.articles.every((a,i,all) => validArticle(a) && ordinal(a.shiftId) <= value.lastAppliedShift && (!i || ordinal(all[i-1].shiftId) < ordinal(a.shiftId)));
}
export function validArticle(a) {
  return !!a && ['stay','welcome'].includes(a.kind) && ordinal(a.shiftId)>0 && /^guest-[1-9]\d*$/.test(a.guestId) && integer(a.stars,1,5)
    && integer(a.score,0,100) && integer(a.completed,0,8) && integer(a.requested,1,8) && a.completed<=a.requested
    && typeof a.clean === 'boolean' && typeof a.longWait === 'boolean' && typeof a.finished === 'boolean'
    && a.stars === starsFor(a.score) && a.score === scoreFor(a) && a.headline === headlineFor(a.stars)
    && a.phrase === phraseFor(a);
}
const starsFor = score => score >= 85 ? 5 : score >= 70 ? 4 : score >= 50 ? 3 : score >= 25 ? 2 : 1;
const scoreFor = a => a.kind==='welcome' ? 0 : Math.max(0, Math.round(40*a.completed/a.requested) + (a.clean ? 30 : 0) + (a.longWait ? 0 : 30) - (a.finished ? 0 : 20));
const headlineFor = stars => stars>=4 ? 'A little hotel worth a visit' : stars===3 ? 'A promising stay, with room to grow' : 'A warm welcome needs a little work';
const phraseFor = a => a.kind==='welcome' ? 'I waited through the full welcome window without being checked in. I could not assess the rooms or service.' : `${a.completed}/${a.requested} requested services completed. ${a.clean ? 'My room was clean at check-in.' : 'I did not reach a clean room.'} ${a.longWait ? 'A long wait interrupted my stay.' : 'My requests received timely attention.'}`;
export function reputationPlan(profile,mode='relaxed') {
  const completed = profile.shiftsCompleted;
  const critic = completed >= 2 && completed % 3 === 2;
  return { version:1, taught:completed>=2, critic, booking:mode==='relaxed'&&!!profile.reputation?.bookings,
    pest: !critic && completed>=5 ? (Math.floor((completed-5)/3)%2 ? 'roach' : 'mouse') : null };
}
export function validReputationPlan(p) { return !!p && p.version===1 && ['taught','critic','booking'].every(k=>typeof p[k]==='boolean') && [null,'mouse','roach'].includes(p.pest) && !(p.critic&&p.pest) && (!p.critic||p.taught); }
export function initializeReputationState(state,plan) {
  if(!validReputationPlan(plan))throw new TypeError('Invalid newspaper policy');
  const guest = plan.critic ? state.guests.slice(1).find(g=>g.spriteKind==='guest') || state.guests[1] : null;
  state.reputation = { version:1, criticGuestId:guest?.id??null, cleanAdmission:false, peakWait:0, article:null,
    pest: { kind:plan.pest, phase:'dormant', roomId:null, startedAt:null, resolvedAt:null } };
}
export function pestBlocksRoom(state,id) { const p=state.reputation?.pest;return !!p&&p.roomId===id&&['noticed','prepared'].includes(p.phase); }
export function recordCleanAdmission(state,guest,room) {
  if(state.reputation?.criticGuestId===guest.id)state.reputation.cleanAdmission=['available','checking-in'].includes(room.status)&&!pestBlocksRoom(state,room.id);
}
export function deriveArticle(state) {
  const rep=state.reputation,g=state.guests.find(g=>g.id===rep?.criticGuestId);
  const unwelcomed=g?.abandoned&&!g.roomProof&&g.waitElapsed>=state.config.waitingPatience-1e-6;
  if(!unwelcomed&&(!g?.review||!g.roomProof||!g.serviceProof?.length))return null;
  const a={kind:unwelcomed?'welcome':'stay',shiftId:state.shiftId,guestId:g.id,completed:g.serviceProof.length,requested:g.itinerary.length,
    clean:rep.cleanAdmission,longWait:rep.peakWait>=.5,finished:g.paid===true};
  // An abandoned stay is always a long wait, including legacy request pauses.
  if(g.abandoned)a.longWait=true;
  a.score=scoreFor(a);a.stars=starsFor(a.score);a.headline=headlineFor(a.stars);a.phrase=phraseFor(a);
  return a;
}
export function updateReputation(state) {
  const rep=state.reputation;if(!rep)return;
  const g=state.guests.find(g=>g.id===rep.criticGuestId);
  if(g&&!rep.article) {
    rep.peakWait=Math.max(rep.peakWait,g.waitElapsed/state.config.waitingPatience,g.roomElapsed/state.config.requestPatience);
    rep.article=deriveArticle(state);
  }
  const p=rep.pest;
  // A pest only occupies an empty room, leaves two rooms usable, and never
  // competes with a critic, waiting guest, service request or active thief.
  if(p.kind&&p.phase==='dormant'&&state.time>=60&&state.completed>=1&&!state.receptionClosed
    &&!state.guests.some(g=>g.status==='waiting'||g.status==='checking-in'||g.status==='occupied'&&g.request!=='rest')
    &&!state.actors.thief.visible) {
    const room=state.rooms.filter(r=>r.status==='available').at(-1);
    if(room&&state.rooms.filter(r=>r.status!=='locked').length>=3){p.phase='noticed';p.roomId=room.id;p.startedAt=state.time;}
  }
}
export function handlePest(state) {
  if(!state||state.paused||state.status!=='playing')return {ok:false,message:'Resume the hotel first.'};
  const p=state.reputation?.pest;
  if(!p||!['noticed','prepared'].includes(p.phase))return {ok:false,message:'No room needs pest care.'};
  if(p.phase==='noticed'){p.phase='prepared';return {ok:true,message:p.kind==='mouse'?'Cozy carrier ready. Tap to relocate.':'Dustpan ready. Tap to sweep.'};}
  p.phase='resolved';p.resolvedAt=state.time;
  return {ok:true,message:p.kind==='mouse'?'Mouse safely relocated to the garden. Room ready.':'All swept up. Room ready.'};
}
export function settleReputation(profile,state,shiftId,abandoned=false) {
  if(!state.reputation||!state.config.reputationPlan)return;
  const rep=profile.reputation;
  const n=ordinal(shiftId);
  if(!validReputation(rep)||!n||n<=rep.lastAppliedShift)return;
  const plan=state.config.reputationPlan, article=deriveArticle(state);
  let delta=0;
  if(plan.taught)for(const g of state.guests){if(g.id===state.reputation.criticGuestId)continue;if(g.review)delta+=rankChange(g.review.stars);}
  if(article)delta+=rankChange(article.stars,true);
  rep.rank=clamp(rep.rank+clamp(abandoned?Math.min(0,delta):delta,-10,10),0,100);
  // A reserved booking is spent only when its guest actually arrives. Closing
  // after the normal goal does not oblige a longer shift or consume the credit.
  if(plan.booking&&state.guests.at(-1)?.status!=='pending')rep.bookings=Math.max(0,rep.bookings-1);
  if(article){rep.articles=[...rep.articles,article].slice(-6);if(!abandoned&&article.stars>=4)rep.bookings=Math.min(2,rep.bookings+2);}
  rep.lastAppliedShift=n;
}
export function validateReputationState(state) {
  const plan=state.config.reputationPlan,rep=state.reputation;
  if(!plan)return rep===undefined;
  if(state.version!==7||state.config.motionRules!==3||!validReputationPlan(plan)||!rep||rep.version!==1)return false;
  const expected={guests:state.guests};initializeReputationState(expected,plan);
  if(rep.criticGuestId!==expected.reputation.criticGuestId||typeof rep.cleanAdmission!=='boolean'
    ||!Number.isFinite(rep.peakWait)||rep.peakWait<0||rep.peakWait>2)return false;
  const g=state.guests.find(g=>g.id===rep.criticGuestId);
  if(rep.cleanAdmission&&(!g||!g.roomProof))return false;
  if(JSON.stringify(rep.article)!==JSON.stringify(deriveArticle(state)))return false;
  const p=rep.pest;if(!p||p.kind!==plan.pest||!['dormant','noticed','prepared','resolved'].includes(p.phase))return false;
  if(p.phase==='dormant')return p.roomId===null&&p.startedAt===null&&p.resolvedAt===null;
  const room=state.rooms.find(r=>r.id===p.roomId);
  return !!p.kind&&!!room&&Number.isFinite(p.startedAt)&&p.startedAt>=60&&p.startedAt<=state.time
    &&(p.phase==='resolved'?Number.isFinite(p.resolvedAt)&&p.resolvedAt>=p.startedAt&&p.resolvedAt<=state.time:p.resolvedAt===null&&room.status==='available');
}
