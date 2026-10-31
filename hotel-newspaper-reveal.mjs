/** Presentation-only ledger. Never changes service evidence, rank or coins. */
import {validArticle} from './hotel-reputation.mjs';
export const issueNumber=a=>Number(a?.shiftId?.slice(6))||0;
export function criticHasExited(state,article=state?.reputation?.article){
 if(!article)return false;
 const g=state.guests.find(g=>g.id===article.guestId);
 return !!g&&!g.visible&&(g.status==='departed'&&g.departed&&g.phase==='departed'||g.status==='abandoned'&&g.phase==='abandoned');
}
export function validNewspaperReveal(v){return !!v&&v.version===1&&Number.isSafeInteger(v.shownThrough)&&v.shownThrough>=0&&(v.pending===null||validArticle(v.pending)&&issueNumber(v.pending)>v.shownThrough);}
export function initialNewspaperReveal(state,profile){
 // Do not replay old reports on first adoption of the feature.
 return {version:1,shownThrough:Math.max(0,...(profile.reputation?.articles||[]).map(issueNumber),criticHasExited(state)?issueNumber(state.reputation?.article):0),pending:null};
}
export function observeNewspaperReveal(ledger,state){
 const a=state.reputation?.article;
 if(!validNewspaperReveal(ledger)||ledger.pending||!a||issueNumber(a)<=ledger.shownThrough||!criticHasExited(state,a))return ledger;
 return {...ledger,pending:structuredClone(a)};
}
export function canRevealNewspaper(c){return !['modal','gesture','selection','heldInput','applyingSave','mainMenu','exterior','portrait','hidden','recovery','paused'].some(k=>c[k])&&c.ready&&c.active&&c.quiet;}
export function createNewspaperRevealer({guard,getCurrent,getData,freeze,adopt,show}){
 let busy=false;
 return {get busy(){return busy;},async reveal(){
  if(busy||!guard.active||guard.transitioning)return {ok:false,code:'not-writable'};
  const current=getCurrent(),ledger=current?.saved?.newspaperReveal;
  if(!validNewspaperReveal(ledger)||!ledger.pending)return {ok:false,code:'no-report'};
  const article=structuredClone(ledger.pending),next={version:1,shownThrough:issueNumber(article),pending:null};
  busy=true;freeze(true);
  try{
   const data=getData(),candidate={...data,saved:{...data.saved,newspaperReveal:next}};
   if(!await guard.write(candidate))return {ok:false,code:'save-failed'};
   const latest=getCurrent();
   if(!guard.active||guard.transitioning||latest.saved!==current.saved||latest.session!==current.session)return {ok:false,code:'ownership-changed'};
   adopt(next);show(article);return {ok:true};
  }catch{return {ok:false,code:'save-failed'};}finally{busy=false;freeze(false);}
 }};
}
