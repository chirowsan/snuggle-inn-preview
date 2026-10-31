import {rankTitle,rankChange} from './hotel-reputation.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function newspaperArticles(state,profile) {
 const rows=[...(profile.reputation?.articles||[])],current=state.reputation?.article;
 if(current&&!rows.some(a=>a.shiftId===current.shiftId))rows.push(current);
 return rows.reverse();
}
export function newspaperMarkup(state,profile) {
 if(!profile.reputation&&!state.reputation)return '';
 const rep=profile.reputation||{rank:50,bookings:0},articles=newspaperArticles(state,profile);
 return `<div class="hotel-standing"><strong>${esc(rankTitle(rep.rank))}</strong><span>${rep.rank}/100 · ${rep.bookings} reader booking${rep.bookings===1?'':'s'} reserved</span><small>⭐ Happy guests and good news raise your rank</small></div>`+
 articles.map(newspaperArticleMarkup).join('')+
 (!articles.length?'<p class="press-coming">A secret critic checks in every few shifts, disguised as an ordinary guest. Their newspaper follows the stay they actually receive.</p>':'');
}
/** The critic is disguised: no badge. Only once their stay is written up does a tiny
 * notebook with a soft glint peek out, a hint you notice after the fact. */
export function drawPressAccessories(renderer,actor,revealed=false) {
 if(!actor.visible||!revealed)return;
 const p=renderer.point(actor.x,actor.y),c=renderer.ctx,scale=renderer.spriteScale,t=(renderer.now||0)*3;
 c.save();c.translate(p.x+20*scale,p.y-50*scale);c.rotate(-.12);c.fillStyle='#315c53';c.strokeStyle='#e3cc8e';c.lineWidth=1.5*scale;
 c.fillRect(-6*scale,-8*scale,12*scale,16*scale);c.strokeRect(-6*scale,-8*scale,12*scale,16*scale);
 c.fillStyle='#f7ecc7';c.fillRect(-3.5*scale,-5.5*scale,7*scale,10*scale);
 const a=.45+.45*Math.sin(t);c.globalAlpha=a;c.fillStyle='#fff6c8';c.beginPath();
 for(let i=0;i<8;i++){const r=i%2?2*scale:6*scale,ang=i*Math.PI/4;c.lineTo(8*scale+Math.cos(ang)*r,-10*scale+Math.sin(ang)*r);}c.closePath();c.fill();c.restore();
}
export function pestLabel(p) {return p.kind==='mouse'?(p.phase==='prepared'?'Relocate gently':'Set cozy carrier'):(p.phase==='prepared'?'Sweep into dustpan':'Pick up dustpan');}
export function pestMarkup(p) {
 const mouse='<svg viewBox="0 0 72 50" aria-hidden="true"><path d="M49 35Q70 48 65 27" fill="none" stroke="#b6999b" stroke-width="3"/><ellipse cx="32" cy="30" rx="22" ry="14" fill="#b3aca0"/><circle cx="17" cy="18" r="10" fill="#b3aca0"/><circle cx="17" cy="18" r="6" fill="#dabbb4"/><circle cx="17" cy="31" r="2" fill="#344a42"/><circle cx="8" cy="35" r="3" fill="#d8aba6"/></svg>';
 const roach='<svg viewBox="0 0 72 50" aria-hidden="true"><g stroke="#836443" stroke-width="3" fill="none"><path d="M25 23L15 16M25 30L13 30M25 36L16 43M46 23L57 16M46 30L59 30M46 36L56 43M30 13L24 5M40 13L46 5"/></g><ellipse cx="35" cy="29" rx="13" ry="17" fill="#b58b56"/><path d="M35 16V42" stroke="#8e6843" stroke-width="2"/><circle cx="30" cy="17" r="2" fill="#354b42"/><circle cx="40" cy="17" r="2" fill="#354b42"/></svg>';
 return `${p.kind==='mouse'?mouse:roach}<span><strong>Room ${String(p.roomId).replace('room-','').padStart(2,'0')}</strong><small>${pestLabel(p)}</small></span>`;
}

export function newspaperArticleMarkup(a){return `<article class="hotel-newspaper" aria-label="Copperleaf Gazette, ${esc(a.shiftId.replace('shift-','issue '))}"><header class="gazette-masthead"><div class="gazette-kicker">THE INDEPENDENT HOTEL &amp; TRAVEL PAPER</div><strong>Copperleaf Gazette</strong><div class="gazette-edition"><span>TRAVEL &amp; HOSPITALITY</span><span>${esc(a.shiftId.replace('shift-','ISSUE '))}</span></div></header><h3>${esc(a.headline)}</h3><div class="gazette-byline">From our visiting animal correspondent <span>◆</span> The hotel review</div><div class="gazette-columns"><figure><div class="gazette-photo"><img src="./assets/exterior/hotel-exterior.webp" alt="Illustrated hotel entrance"></div><figcaption>At the entrance · artist’s illustration</figcaption></figure><div class="gazette-story"><div class="press-rating" aria-label="${a.stars} out of 5 stars">${'★'.repeat(a.stars)}${'☆'.repeat(5-a.stars)} <small>${a.score}/100</small></div><p>${esc(a.phrase)}</p><aside><b>THE VERDICT</b><span>Shift-end influence: ${rankChange(a.stars,true)>=0?'+':''}${rankChange(a.stars,true)} rank${a.stars>=4?' · 2 future reader bookings (reserve capped at 2)':''}</span></aside></div></div><footer><span>COPPERLEAF GAZETTE</span><span>Recorded service report · ${esc(a.shiftId.replace('shift-','No. '))}</span></footer></article>`;}

export function newspaperArchivePages(state,profile,letters=''){
 const pages=newspaperArticles(state,profile).map(newspaperArticleMarkup),rep=profile.reputation||{rank:50,bookings:0};
 pages.push('<article class="guest-letters"><header>Letters to the hotel</header><p class="letters-note">Ordinary guest ratings · separate from the newspaper critic</p>'+letters+`<div class="hotel-standing"><strong>${esc(rankTitle(rep.rank))}</strong><span>${rep.rank}/100 · ${rep.bookings} reader bookings reserved</span><small>⭐ Happy guests and good news raise your rank</small></div></article>`);
 return pages;
}
