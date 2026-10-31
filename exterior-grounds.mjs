// R3 outside overhaul: procedural, free, render-only. Never touches the saved
// exterior design, hit targets or anchors. Pure CSS animation (no timers).
import {groundPoint,frontPoint,PROJECTION} from './exterior-projection.mjs';
import {FACADE_GEOMETRY as G} from './hotel-building.mjs';
const svg=(body,w,h,box=`0 0 ${w} ${h}`)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`);
const rnd=seed=>()=>((seed=(seed*16807)%2147483647)/2147483647);
export function dayPhase(hour){return hour>=20||hour<5?'night':hour<7?'dawn':hour>=17?'dusk':'day';}
const ART='./assets/exterior/painted/';
export const PAINTED=Object.freeze({grass:ART+'ground-grass-tile.webp',flagstone:ART+'ground-flagstone-tile.webp',gravel:ART+'ground-gravel-tile.webp',
 tree1:ART+'tree-round-1.webp',tree2:ART+'tree-round-2.webp',pine:ART+'tree-pine-1.webp',shrubPink:ART+'shrub-pink.webp',shrubYellow:ART+'shrub-yellow.webp',
 flowerbed:ART+'flowerbed-long.webp',fence:ART+'fence-picket-segment.webp',awning:ART+'inn-awning.webp',lamp:ART+'lamp-post.webp',plot:ART+'plot-coming-soon.webp',
 restaurant:ART+'wing-restaurant.webp',spa:ART+'wing-spa.webp',theater:ART+'wing-theater.webp',concert:ART+'wing-concert.webp'});
// Width/height ratios of the painted sprites (from painted/manifest.json pixels).
const RATIO={tree1:426/512,tree2:462/512,pine:299/512,shrubPink:360/259,shrubYellow:300/270,flowerbed:640/209,fence:480/245,lamp:77/360,plot:640/408,restaurant:640/510,spa:640/523,theater:640/535,concert:600/646,awning:640/193};
// Ground coordinates: x -1700..2900, y 260..3460 (wider than the camera can reach).
const LAWN={W:4600,H:3200,ox:-1700,oy:260};
function groundShapes(){
 const {W,H,ox,oy}=LAWN,P=(x,y)=>`${x-ox} ${y-oy}`;
 const plaza=`M${P(390,552)}H${P(810,552).split(' ')[0]}Q${P(860,560)} ${P(850,640)}Q${P(830,735)} ${P(700,745)}H${P(500,745).split(' ')[0]}Q${P(370,735)} ${P(350,640)}Q${P(340,560)} ${P(390,552)}Z`;
 const main=`M${P(560,740)}C${P(540,860)} ${P(470,930)} ${P(480,1040)}S${P(560,1200)} ${P(540,1400)}`;
 const sides=[`M${P(850,650)}C${P(1000,700)} ${P(1150,690)} ${P(1300,760)}`,`M${P(350,650)}C${P(200,700)} ${P(40,690)} ${P(-120,770)}`];
 const flagMask=svg(`<path d="${plaza}"/><path d="${main}" fill="none" stroke="#000" stroke-width="112" stroke-linecap="round"/>`,W,H);
 const gravelMask=svg(sides.map(d=>`<path d="${d}" fill="none" stroke="#000" stroke-width="64" stroke-linecap="round"/>`).join(''),W,H);
 // Soft edges under the paving and a contact shadow along the building, on top of grass.
 const edges=svg(`<defs><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs><g filter="url(#b)" opacity=".45"><path d="${plaza}" fill="none" stroke="#3d4a2a" stroke-width="14"/><path d="${main}" fill="none" stroke="#3d4a2a" stroke-width="128" stroke-linecap="round"/>${sides.map(d=>`<path d="${d}" fill="none" stroke="#3d4a2a" stroke-width="76" stroke-linecap="round"/>`).join('')}</g>`,W,H);
 const shade=svg(`<defs><filter id="s"><feGaussianBlur stdDeviation="14"/></filter><radialGradient id="v" cx=".5" cy=".3" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1c2a12" stop-opacity=".35"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/><ellipse cx="${600-ox}" cy="${552-oy}" rx="520" ry="30" fill="#1f2b16" opacity=".45" filter="url(#s)"/>`,W,H);
 return {flagMask,gravelMask,edges,shade};
}
// Cheap, deterministic large-scale light/dark variation so the grass tile never reads as a grid.
function grassVariation(){const {W,H}=LAWN,r=rnd(23);let b='';for(let i=0;i<34;i++){const x=r()*W,y=r()*H,rx=220+r()*420,ry=140+r()*260;b+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${i%2?'#f7ffd0':'#1d3312'}" opacity="${(.06+r()*.07).toFixed(2)}"/>`;}
 return svg(`<defs><filter id="f"><feGaussianBlur stdDeviation="60"/></filter></defs><g filter="url(#f)">${b}</g>`,W,H);}
export function mountExteriorGrounds(view,{hour=new Date().getHours(),reducedMotion=false}={}){
 const model=view.building||{},layers=[];
 const phase=dayPhase(hour);view.root?.classList?.add('ex-r3','ex-phase-'+phase);
 // 1) Sky + distant hills behind everything, so no hard backdrop edge is ever visible.
 const sky=view.el('div','ex-sky');sky.setAttribute?.('aria-hidden','true');
 sky.append(view.image(svg(`<path d="M0 120Q120 40 260 96T540 80T820 100T1100 70T1400 96V200H0Z" fill="#a9c7a6" opacity=".75"/><path d="M0 150Q160 90 330 140T700 128T1060 146T1400 130V200H0Z" fill="#8fb48a"/><path d="M0 178Q200 150 420 172T860 166T1400 170V200H0Z" fill="#7ca673"/>`,1400,200,'0 0 1400 200'),'ex-hills'));
 for(let i=0;i<4;i++){const c=view.el('i','ex-cloud ex-cloud-'+i);sky.append(c);}
 for(let i=0;i<3;i++){const b=view.el('i','ex-bird ex-bird-'+i);b.append(view.image(svg('<path d="M2 10Q10 2 16 9Q22 2 30 10" fill="none" stroke="#3b3a40" stroke-width="2.6" stroke-linecap="round"/>',32,14),'ex-bird-img'));sky.append(b);}
 view.viewport.insertBefore?.(sky,view.viewport.firstChild);layers.push(sky);
 // 2) Lawn, plaza, paths, flower beds on the ground plane (under user paving).
 const {W,H,ox,oy}=LAWN,shapes=groundShapes(),box={left:ox+'px',top:oy+'px',width:W+'px',height:H+'px'};
 const plane=(cls,style)=>{const d=view.el('div',cls);d.setAttribute?.('aria-hidden','true');Object.assign(d.style,box,style);return d;};
 const masked=(src,url,size)=>({backgroundImage:`url("${src}")`,backgroundSize:size,webkitMaskImage:`url("${url}")`,maskImage:`url("${url}")`,webkitMaskSize:'100% 100%',maskSize:'100% 100%'});
 const far=view.el('div','ex-lawn-far');far.setAttribute?.('aria-hidden','true');Object.assign(far.style,{left:(ox-4200)+'px',top:oy+'px',width:(W+8400)+'px',height:(H+3000)+'px',backgroundImage:`url("${PAINTED.grass}")`,backgroundSize:'380px 380px'});
 const ground=plane('ex-lawn',{backgroundImage:`url("${grassVariation()}"),url("${PAINTED.grass}")`,backgroundSize:`100% 100%,380px 380px`});
 const grass2=plane('ex-lawn-tone',{backgroundImage:`url("${PAINTED.grass}")`,backgroundSize:'610px 610px',backgroundPosition:'173px 291px'});
 const edges=view.image(shapes.edges,'ex-ground-edges'),gravel=plane('ex-gravel',masked(PAINTED.gravel,shapes.gravelMask,'150px 150px')),flag=plane('ex-flagstone',masked(PAINTED.flagstone,shapes.flagMask,'190px 190px')),shade=view.image(shapes.shade,'ex-ground-shade');
 for(const im of [edges,shade])Object.assign(im.style,box);
 const first=view.groundLayer.querySelector?.('.ex-ground')?.nextSibling??null;
 for(const n of [far,ground,grass2,edges,gravel,flag,shade]){view.groundLayer.insertBefore?.(n,first);layers.push(n);}
 // 3) Upright trees, shrubs, lamps, fence (depth-sorted like props).
 const upright=(src,cls,x,y,w,h,z)=>{const p=groundPoint(x,y),im=view.image(src,'ex-up '+cls);Object.assign(im.style,{left:(p.x-w/2)+'px',top:(p.y-h)+'px',width:w+'px',height:h+'px',zIndex:String(z??(y<550?5:1000+Math.round(p.y)))});view.scene.append(im);layers.push(im);return im;};
 const sprite=(key,cls,x,y,h,z)=>upright(PAINTED[key],cls,x,y,Math.round(h*RATIO[key]),h,z);
 [[40,430,1.1],[-160,620,1],[-330,880,1.2],[1170,430,1.1],[1350,640,1],[1520,900,1.2],[-60,1240,1.3],[1250,1260,1.3]].forEach(([x,y,s],i)=>sprite(i%2?'tree2':'tree1','ex-tree',x,y,Math.round(250*s)));
 for(const [x,y] of [[-40,300],[1240,300],[-260,450]])sprite('pine','ex-tree ex-pine',x,y,250);
 [[130,600],[1070,600],[300,780],[900,780],[-40,760],[1240,770]].forEach(([x,y],i)=>sprite(i%2?'shrubYellow':'shrubPink','ex-shrub',x,y,i%2?78:76));
 for(const [x,y] of [[272,578],[927,578]])sprite('flowerbed','ex-flowerbed',x,y,64);
 for(const [x,y] of [[380,760],[820,760]])sprite('lamp','ex-lamp',x,y,140);
 // Picket fence: painted segments laid end to end along the line, each rotated to follow it.
 for(const [x0,x1] of [[-420,380],[700,1600]]){const a=groundPoint(x0,1130),b=groundPoint(x1,1130),len=Math.hypot(b.x-a.x,b.y-a.y),ang=Math.atan2(b.y-a.y,b.x-a.x),h=58,w=Math.round(h*RATIO.fence),step=w-6,n=Math.max(1,Math.ceil(len/step));
  for(let i=0;i<n;i++){const t=(i*step+w/2)/len,cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t,im=view.image(PAINTED.fence,'ex-up ex-fence');Object.assign(im.style,{left:(cx-w/2)+'px',top:(cy-h)+'px',width:w+'px',height:h+'px',transformOrigin:'50% 100%',transform:`rotate(${ang}rad)`,zIndex:String(1000+Math.round(cy))});view.scene.append(im);layers.push(im);}}
 // 4) Building: awning, chimney, string lights (front plane), wall lanterns.
 const front=view.frontLayer;if(front){
  const roofY=(model.roofY??150)+4;
  const awn=view.image(PAINTED.awning,'ex-awning');const aw=244,ah=Math.round(aw/RATIO.awning);
  Object.assign(awn.style,{left:(598-aw/2)+'px',top:'360px',width:aw+'px',height:ah+'px'});front.append(awn);layers.push(awn);
  for(const x of [500,692]){const l=view.image(svg('<path d="M10 0v8" stroke="#3e3a33" stroke-width="3"/><path d="M2 8h16l-2 22H4Z" fill="#3e3a33"/><rect x="5" y="11" width="10" height="15" rx="2" fill="#ffe7a8" class="lamp-glass"/>',20,32),'ex-wall-lamp');Object.assign(l.style,{left:(x-10)+'px',top:'430px',width:'20px',height:'32px'});front.append(l);layers.push(l);}
  const bulbs=Array.from({length:23},(_,i)=>{const x=10+i*40,y=12+Math.sin(Math.PI*((i%6)/5))*10;return `<circle cx="${x}" cy="${y}" r="4.5" class="bulb" fill="#ffe39a"/>`;}).join('');
  const string=view.image(svg(`<path d="M0 10${Array.from({length:4},(_,k)=>`Q${k*220+110} 34 ${k*220+220} 10`).join('')}" fill="none" stroke="#5b4a36" stroke-width="1.5"/>${bulbs}`,900,40),'ex-string-lights');Object.assign(string.style,{left:'150px',top:(roofY+2)+'px',width:'900px',height:'40px'});front.append(string);layers.push(string);
  const p=groundPoint(930,420,550-roofY);const chim=view.image(svg('<rect x="8" y="20" width="44" height="80" fill="#a5584a"/><path d="M8 34h44M8 50h44M8 66h44M8 82h44M30 20v14M20 34v16M40 50v16M24 66v16" stroke="#8c463b" stroke-width="2"/><rect x="2" y="12" width="56" height="12" rx="2" fill="#6e3a31"/>',60,100),'ex-chimney');Object.assign(chim.style,{left:(p.x-40)+'px',top:(p.y-130)+'px',width:'80px',height:'133px',zIndex:'9'});view.scene.append(chim);layers.push(chim);
  for(let i=0;i<3;i++){const s=view.el('i','ex-smoke ex-smoke-'+i);Object.assign(s.style,{left:(p.x-8)+'px',top:(p.y-150)+'px'});view.scene.append(s);layers.push(s);}
 }
 // 5) Venues live on the hotel's upper floors (3F services, 4F entertainment), never on the lawn.
 // The taller building gets lit venue windows, a tall blade sign and, with the music lounge, a rooftop concert terrace.
 const owned=new Set((model.levels||[]).filter(l=>l.floor>=3).flatMap(l=>l.bays||[]).filter(b=>b.owned).map(b=>b.id));
 const venues=(model.levels||[]).filter(l=>l.structural&&l.floor>=3).flatMap(l=>(l.bays||[]).filter(b=>b.status==='built').map(b=>({id:b.id,bay:b.bay,floor:l.floor})));
 if(front){
  for(const v of venues){const lit=view.el('div','ex-venue-lit');lit.dataset&&(lit.dataset.venue=v.id,lit.dataset.floor=String(v.floor));
   Object.assign(lit.style,{left:((G.bayCenters?.[v.bay]??(338+v.bay*258))-100)+'px',top:(G.lobbyTop-v.floor*G.floorHeight+30)+'px',width:'200px',height:(G.bayHeight+8)+'px'});front.append(lit);layers.push(lit);}
  if((model.topFloor|0)>=3){const top=(model.roofY??150)+24,bottom=G.lobbyTop+36,sign=view.el('div','ex-tall-sign');sign.setAttribute?.('aria-hidden','true');
   Object.assign(sign.style,{left:(G.left-18)+'px',top:top+'px',height:(bottom-top)+'px'});for(const ch of 'SNUGGLE INN'){const span=view.el('span',ch===' '?'ex-tall-gap':'ex-tall-letter');span.textContent=ch===' '?'':ch;sign.append(span);}front.append(sign);layers.push(sign);}
  if(owned.has('lounge')){const roofTop=(model.roofY??150)+4,t=view.image(svg('<path d="M10 92h280" stroke="#5b3d1f" stroke-width="6"/><rect x="40" y="60" width="220" height="30" rx="4" fill="#7a4b2a"/><path d="M30 62 150 18 270 62Z" fill="#c4473f"/><path d="M30 62 150 18 270 62" fill="none" stroke="#f6d27a" stroke-width="4"/><path d="M50 62v28M250 62v28" stroke="#3e2a1a" stroke-width="6"/><circle cx="110" cy="74" r="9" fill="#f3d2b5"/><rect x="103" y="82" width="14" height="10" fill="#6f9fd8"/><circle cx="190" cy="74" r="9" fill="#e9c39d"/><rect x="183" y="82" width="14" height="10" fill="#e9886f"/><path d="M60 40q90 30 180 0" fill="none" stroke="#5b4a36" stroke-width="1.5"/>'+[70,100,130,160,190,220].map((x,i)=>`<circle cx="${x}" cy="${44+Math.sin(i/5*Math.PI)*9}" r="4" class="bulb" fill="#ffe39a"/>`).join(''),300,96),'ex-roof-terrace');
   const rp=groundPoint(560,550-PROJECTION.depth*.45,550-roofTop);// sits on the roof plane itself
   Object.assign(t.style,{left:(rp.x-150)+'px',top:(rp.y-90)+'px',width:'300px',height:'96px',zIndex:'12'});view.scene.append(t);layers.push(t);
   if(!reducedMotion)for(let i=0;i<3;i++){const n=view.el('i','ex-note ex-note-'+i);n.textContent=['♪','♫','♪'][i];Object.assign(n.style,{left:(rp.x-60+i*50)+'px',top:(rp.y-110)+'px',zIndex:'12'});view.scene.append(n);layers.push(n);}}
 }
 // 6) Ambient life: butterflies over the beds, strolling guests on the path.
 if(!reducedMotion){
  for(let i=0;i<3;i++){const [x,y]=[[260,600],[930,610],[150,820]][i],p=groundPoint(x,y),b=view.el('i','ex-butterfly ex-butterfly-'+i);Object.assign(b.style,{left:p.x+'px',top:(p.y-40)+'px',zIndex:'1990'});b.append(view.image(svg(`<path d="M10 10C2 0 0 12 9 12C0 16 6 22 10 13C14 22 20 16 11 12C20 12 18 0 10 10Z" fill="${['#ffb3c7','#ffe07a','#c9b2ff'][i]}" stroke="#6b4a6b" stroke-width=".8"/>`,20,22),'ex-bf-img'));view.scene.append(b);layers.push(b);}
  const route=[[540,1260],[480,1040],[540,860],[600,700]].map(([x,y])=>groundPoint(x,y)),d='M'+route.map(p=>`${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join(' L');
  for(let i=0;i<2;i++){const g=view.el('i','ex-walker ex-walker-'+i);g.style.offsetPath=`path('${d}')`;g.style.zIndex='1600';g.append(view.image(svg(`<ellipse cx="14" cy="50" rx="10" ry="3" fill="#000" opacity=".25"/><rect x="7" y="18" width="14" height="24" rx="6" fill="${['#e9886f','#6f9fd8'][i]}"/><circle cx="14" cy="11" r="8" fill="#f3d2b5"/><path d="M6 9q8-10 16 0" fill="${['#5a3b2a','#2e2a28'][i]}"/><path d="M10 42v8M18 42v8" stroke="#3b3330" stroke-width="3" stroke-linecap="round" class="legs"/>`,28,54),'ex-walker-img'));view.scene.append(g);layers.push(g);}
 }
 // 7) Day–night tint inside the scene, with warm light pools drawn above it at dusk/night.
 const tint=view.el('div','ex-daylight ex-daylight-'+phase);tint.setAttribute?.('aria-hidden','true');view.scene.append(tint);layers.push(tint);
 if(phase==='night'||phase==='dusk'){
  const spots=[[frontPoint(596,455),150],[groundPoint(380,760,120),70],[groundPoint(820,760,120),70]];
  for(const x of [500,692])spots.push([frontPoint(x,446),60]);
  for(const level of (model.levels||[]).filter(l=>l.structural))for(const bay of [0,1,2]){const item=level.floor===0?{status:'built'}:level.bays?.find(b=>b.bay===bay);if(item?.status!=='built')continue;const y=level.floor===0?(G.lobbyTop+G.lobbyBottom)/2:G.lobbyTop-level.floor*G.floorHeight+G.floorHeight/2;spots.push([frontPoint(G.bayCenters?.[bay]??(250+bay*345),y),110]);}
  for(const [p,r] of spots){const g=view.el('i','ex-glow');Object.assign(g.style,{left:(p.x-r)+'px',top:(p.y-r)+'px',width:2*r+'px',height:2*r+'px'});view.scene.append(g);layers.push(g);}
 }
 return {phase,layers,owned:[...owned],venues:venues.map(v=>v.id)};
}
