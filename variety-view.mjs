import {icon as baseIcon} from './rush-icons.mjs';
const art={
 outside:'<path d="m2 10 10-8 10 8M4 9v13h16V9M9 22V12h6v10M14 17h1" fill="#e5c88c"/>',
 lounge:'<path d="M9 4v12m0-10 10-3v11" stroke-width="2.4"/><ellipse cx="6" cy="17" rx="4" ry="3" fill="#b7874a"/><ellipse cx="16" cy="15" rx="4" ry="3" fill="#b7874a"/>',
 theater:'<path d="M2 3h20v18H2Z" fill="#d4b26c"/><path d="M3 4h8q0 9-8 12Zm18 0h-8q0 9 8 12Z" fill="#52775d"/><path d="M3 19h18M12 3v4"/>',
 performer:'<rect x="9" y="2" width="6" height="12" rx="3" fill="#c9a05c"/><path d="M6 9v2a6 6 0 0 0 12 0V9M12 17v5M7 22h10"/>',
 inspector:'<path d="M6 4h12v18H6Z" fill="#e5cf98"/><path d="M9 2h6v4H9Zm0 9 2 2 4-4m-6 8h6"/>',
 restaurant:'<path d="M3 11h18q-1 10-9 10T3 11Z" fill="#d79a58"/><path d="M2 11h20M5 7l14-4M6 9l14-3M8 15q4 4 8 0"/>',
 salon:'<path d="M6 4h12v11H6Z" fill="#bed2c1"/><path d="M12 15v6M7 21h10M9 7l6 5M15 7l-6 5"/><circle cx="6" cy="18" r="3"/>',
 spa:'<path d="M3 15h18v5H3Z" fill="#c4d7bc"/><path d="M5 20v2m14-2v2M6 12q6-8 12 0M8 10q-2-5 2-7m4 7q4-4 2-7"/>',
 family:'<path d="M2 10v11m20-11v11M2 17h20M3 10h8v7H3Zm10 1h8v6h-8ZM5 6h4v4m6-3h4v4" fill="#d7bd81"/>',
 luxury:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#e2bd63"/>',
 garden:'<path d="M3 8h18v12H3Z" fill="#d8a669"/><path d="M4 8q0-6 8-6t8 6"/><ellipse cx="12" cy="13" rx="5" ry="4" fill="#fff1c7"/><circle cx="12" cy="13" r="2" fill="#e4b45c"/>',
 tea:'<path d="M3 8h14v9q-7 6-14 0Z" fill="#e8d4aa"/><path d="M17 9h3q4 5-3 6M3 21h17M7 5q-3-2 0-4m6 4q-3-2 0-4"/>',
 pancake:'<ellipse cx="12" cy="17" rx="10" ry="4" fill="#c18c4f"/><ellipse cx="12" cy="13" rx="10" ry="4" fill="#e2b974"/><ellipse cx="12" cy="9" rx="10" ry="4" fill="#e9c88d"/><path d="m10 7 5-1 2 4-6 1Z" fill="#f2d96b"/>',
 feedback:'<path d="M3 7h18v14H3Z" fill="#42785f" stroke="#f2d397"/><path d="m2 7 3-4h14l3 4Z" fill="#d8ae64" stroke="#614b2c"/><path d="M7 8h10" stroke="#203e32" stroke-width="2"/><rect x="6" y="11" width="12" height="7" rx="1" fill="#fff2cb" stroke="#b58b4b"/><path d="m6 11 6 4 6-4" stroke="#ad8348"/><path d="m6 1 .5 1.2 1.3.1-1 .8.3 1.3-1.1-.7-1.1.7.3-1.3-1-.8 1.3-.1ZM12 0l.5 1.2 1.3.1-1 .8.3 1.3-1.1-.7-1.1.7.3-1.3-1-.8 1.3-.1ZM18 1l.5 1.2 1.3.1-1 .8.3 1.3-1.1-.7-1.1.7.3-1.3-1-.8 1.3-.1Z" fill="#ffe2a1" stroke="#936e31" stroke-width=".45"/>',
 chef:'<path d="M7 12C0 11 3 3 8 5c1-6 9-5 9 0 6-1 6 7 1 7v9H6v-9Z" fill="#eee6cd"/><path d="M7 16h10"/>',
 star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="currentColor"/>',
 room:'<path d="M4 22V3h16v19M9 15h1M2 22h20"/>',
 service:'<path d="m4 12 5 6L21 5" stroke-width="3"/>',wait:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>'
};
export const contentIcon=name=>art[name]?`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${art[name]}</svg>`:baseIcon(name);
// Shared visual anchor: beside the original desk, independent of simulation routes.
export const REVIEW_BOX_VIEW=Object.freeze({x:495,y:330});
export const reviewBoxSlotOffset=(width,height)=>height>width&&width<=650?38:width<=700?41:44;
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function stayReviews(state,profile,shiftId){
 const all=[...(profile.recentReviews||[]),...state.guests.filter(g=>g.review).map(g=>({shiftId,guestId:g.id,guestName:g.name,customerType:g.customerType,...g.review}))],out=[];const seen=new Set();
 for(const a of [...(profile.reputation?.articles||[]),...(state.reputation?.article?[state.reputation.article]:[])]){if(!all.some(r=>r.shiftId===a.shiftId&&r.guestId===a.guestId))all.push({...a,guestName:'Copperleaf Gazette',customerType:'critic',icons:['feedback']});}
 for(const review of all){const key=review.shiftId+':'+review.guestId;if(!seen.has(key)){out.push({...review,key});seen.add(key);}}
 return out.slice(-12);
}

// A read marker never changes the factual reviews or earned hotel state.
export function reviewInbox(reviews,lastReviewSeen,seenKeys){
 const seen=reviews.findIndex(review=>review.key===lastReviewSeen);
 const read=new Set(Array.isArray(seenKeys)?seenKeys.slice(-24).filter(key=>typeof key==='string'&&key.length<=80):reviews.slice(0,seen+1).map(review=>review.key));
 const unreadKeys=reviews.filter(review=>!read.has(review.key)).map(review=>review.key);
 return {unreadCount:unreadKeys.length,lastKey:reviews.at(-1)?.key||'',unreadKeys};
}

export function reviewDisplayOrder(reviews,lastReviewSeen,seenKeys){
 const unread=new Set(reviewInbox(reviews,lastReviewSeen,seenKeys).unreadKeys);
 return [...reviews].reverse().sort((a,b)=>Number(unread.has(b.key))-Number(unread.has(a.key)));
}
