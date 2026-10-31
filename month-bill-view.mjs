/** Result-screen "month in review" card: what the inn earned, the helpers'
 * wages and upkeep, what was paid and what was kindly waived. DOM only. */
export function renderMonthCard(el,{bill,onOk=()=>{}}={}){
 if(!bill)return null;const doc=el.ownerDocument;
 const card=doc.createElement('div');card.className='olive-card month-card';card.id='month-summary';
 card.innerHTML='<span class="olive-owl" aria-hidden="true">📒</span><div class="month-body"><b></b><p class="month-lines"></p><small class="month-note"></small></div><button type="button" id="month-ok" class="secondary month-ok">Lovely</button>';
 card.querySelector('b').textContent='Month '+bill.month+' in review';
 card.querySelector('.month-lines').textContent='Earned 🪙 '+bill.income+' · Helpers 🪙 '+bill.wages+' · Upkeep 🪙 '+bill.upkeep;
 card.querySelector('.month-note').textContent=bill.welcome?'🎁 Welcome month: bills are on the house!':'Paid 🪙 '+bill.paid+(bill.waived?' · 🪙 '+bill.waived+' waived (bills never take more than 30% of the month)':' · all settled. Thank you!');
 card.querySelector('#month-ok').onclick=()=>{onOk();card.classList.add('seen');card.querySelector('#month-ok').remove();};
 el.prepend(card);el.hidden=false;return card;
}
