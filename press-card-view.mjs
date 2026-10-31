/** Morning paper card (end-of-shift) and the Desk's past reviews. DOM only, text via textContent. */
import {GRADE_WORD} from './critic-press.mjs';
const MOOD={good:'🌟',mixed:'🙂',bad:'🌧️'};
const ROWS=[['checkin','🛎️ Check-in'],['room','🛏️ Room ready'],['service','🧺 Requests'],['meal','🍜 Meal'],['tidy','✨ Tidy stay']];
function grades(doc,r){const ul=doc.createElement('ul');ul.className='press-grades';for(const [k,label] of ROWS){if(r[k]<0)continue;const li=doc.createElement('li');li.className='g'+r[k];li.textContent=label+': '+GRADE_WORD[r[k]];ul.append(li);}return ul;}
export function renderPressCard(el,{report,onOk=()=>{}}={}){
 if(!report)return null;const doc=el.ownerDocument;
 const card=doc.createElement('div');card.className='olive-card press-card verdict-'+report.verdict;card.id='press-paper';
 card.innerHTML='<span class="olive-owl" aria-hidden="true">📰</span><div class="press-body"><small class="press-kicker"></small><b class="press-headline"></b><span class="press-stars"></span><p class="press-quote"></p><small class="press-note"></small></div><button type="button" id="press-ok" class="secondary month-ok">Read it</button>';
 card.querySelector('.press-kicker').textContent='Copperleaf Gazette · morning edition · issue '+report.issue;
 card.querySelector('.press-headline').textContent=MOOD[report.verdict]+' “'+report.headline+'”';
 const st=card.querySelector('.press-stars');st.textContent='★'.repeat(report.stars)+'☆'.repeat(5-report.stars);st.setAttribute('aria-label',report.stars+' of 5 stars');
 card.querySelector('.press-quote').textContent='“'+report.quote+'” — our secret critic';
 card.querySelector('.press-body').append(grades(doc,report));
 card.querySelector('.press-note').textContent='🕵️ One of yesterday’s guests was a secret critic. Remember the one with the little notebook? '+(report.reward?(report.verdict==='mixed'?'A fair review still brings a few readers: 🪙 +':'Readers loved it: 🪙 +')+report.reward+' thank-you from the paper.':report.verdict==='bad'?'No harm done. Quick check-ins and ready rooms win them over next time.':'');
 card.querySelector('#press-ok').onclick=()=>{onOk();card.classList.add('seen');card.querySelector('#press-ok').remove();};
 el.prepend(card);el.hidden=false;return card;
}
export function renderPressArchive(body,press){
 const doc=body.ownerDocument,h=doc.createElement('h3');h.className='desk-h';h.textContent='Press clippings';body.append(h);
 if(!press?.issues?.length){const p=doc.createElement('div');p.className='olive-card desk-card';p.innerHTML='<span class="olive-owl" aria-hidden="true">🕵️</span><div><b>No reviews yet</b><p></p></div>';p.querySelector('p').textContent='A secret critic checks in every few shifts, disguised as an ordinary guest. Their paper arrives the next morning.';body.append(p);return;}
 for(const r of [...press.issues].reverse()){const c=doc.createElement('div');c.className='olive-card desk-card press-clip verdict-'+r.verdict;c.innerHTML='<span class="olive-owl" aria-hidden="true">📰</span><div><b></b><p></p><small></small></div>';
  c.querySelector('b').textContent='Issue '+r.issue+' · '+'★'.repeat(r.stars)+'☆'.repeat(5-r.stars);c.querySelector('p').textContent='“'+r.headline+'”';c.querySelector('small').textContent=r.quote;body.append(c);}
 const t=doc.createElement('small');t.className='press-total';t.textContent='Thank-you coins from the paper so far: 🪙 '+press.coins;body.append(t);
}
