// R3 inside polish: render-only canvas layers (no state, no save, no hit targets).
// Every call is guarded so a minimal canvas mock simply skips the extras.
const has=(c,...k)=>k.every(n=>typeof c?.[n]==='function');
function world(r,fn){const c=r.ctx;if(!has(c,'save','restore','translate','scale','beginPath','fill'))return;c.save();try{c.translate(0,r.top);c.scale(r.sx,r.sy);fn(c);}catch{}finally{c.restore();}}
function plant(c,x,y,s=1,t=0){c.fillStyle='#00000026';c.beginPath();c.ellipse?.(x,y+2,24*s,7*s,0,0,Math.PI*2);c.fill();
 c.fillStyle='#b4683f';c.beginPath();c.moveTo(x-17*s,y-30*s);c.lineTo(x+17*s,y-30*s);c.lineTo(x+12*s,y);c.lineTo(x-12*s,y);c.closePath();c.fill();c.fillStyle='#cf8352';c.fillRect(x-19*s,y-34*s,38*s,7*s);
 const sway=Math.sin(t*.9+x)*2;for(const [dx,dy,r,col] of [[-12,-52,16,'#4f7f45'],[12,-56,17,'#5f9150'],[0,-72,18,'#6fa35a'],[-4,-58,13,'#86b866']]){c.fillStyle=col;c.beginPath();c.arc(x+(dx+sway*(-dy/70))*s,y+dy*s,r*s,0,Math.PI*2);c.fill();}}
function bench(c,x,y){c.fillStyle='#00000024';c.beginPath();c.ellipse?.(x,y+3,62,9,0,0,Math.PI*2);c.fill();c.fillStyle='#6d4a31';c.fillRect(x-54,y-14,8,16);c.fillRect(x+46,y-14,8,16);c.fillStyle='#9a6a43';c.fillRect(x-60,y-24,120,12);c.fillStyle='#c98f9a';c.fillRect(x-56,y-32,112,10);c.fillStyle='#e2b0b8';c.fillRect(x-56,y-32,112,3);c.fillStyle='#7f5a3a';c.fillRect(x-60,y-56,120,8);c.fillRect(x-58,y-50,6,26);c.fillRect(x+52,y-50,6,26);}
function table(c,x,y,t){c.fillStyle='#00000024';c.beginPath();c.ellipse?.(x,y+2,26,7,0,0,Math.PI*2);c.fill();c.fillStyle='#7b5638';c.fillRect(x-3,y-30,6,30);c.fillStyle='#a97a4f';c.beginPath();c.ellipse?.(x,y-32,24,7,0,0,Math.PI*2);c.fill();
 c.fillStyle='#f3efe4';c.fillRect(x-8,y-48,16,16);c.fillStyle='#e9c46a';c.beginPath();c.arc(x,y-54,6+Math.sin(t*2)*.6,0,Math.PI*2);c.fill();c.fillStyle='#f6a6c0';c.beginPath();c.arc(x-6,y-50,4,0,Math.PI*2);c.arc(x+6,y-51,4,0,Math.PI*2);c.fill();}
/** Guest floors (1F/2F): runner rug, plants, benches, lamp light pools, wall shadow. */
export function drawInsideDecor(r,state){
 if(!(r.floor===1||r.floor===2))return;const t=r.settings?.reducedMotion?0:r.now||0;
 world(r,c=>{
  if(has(c,'createLinearGradient')){const g=c.createLinearGradient(0,282,0,330);g.addColorStop(0,'rgba(60,38,20,.30)');g.addColorStop(1,'rgba(60,38,20,0)');c.fillStyle=g;c.fillRect(0,282,800,48);}
  c.fillStyle='rgba(255,226,150,.16)';for(const x of [123,328,416,615,697]){c.beginPath();c.ellipse?.(x,312,70,20,0,0,Math.PI*2);c.fill();}
  // runner rug down the corridor
  const a0=c.globalAlpha;c.globalAlpha=a0*.88;c.fillStyle='#00000018';c.fillRect(64,456,696,64);c.fillStyle='#8e3f3f';c.fillRect(60,450,700,62);c.fillStyle='#c9a24a';c.fillRect(60,450,700,5);c.fillRect(60,507,700,5);
  c.fillStyle='#a85b4f';for(let x=90;x<740;x+=60){c.beginPath();c.moveTo(x,481);c.lineTo(x+14,466);c.lineTo(x+28,481);c.lineTo(x+14,496);c.closePath();c.fill();}c.globalAlpha=a0;
  for(const x of [92])plant(c,x,330,1.1,t);for(const x of [372,656])plant(c,x,318,.9,t);
  bench(c,372,610);table(c,656,600,t);plant(c,140,640,1.25,t);
 });
}
/** All floors: soft sun shafts, drifting dust motes, gentle vignette. */
export function drawInsideAmbience(r,state){
 const calm=!!r.settings?.reducedMotion,t=r.now||0;
 world(r,c=>{
  if(has(c,'createLinearGradient')){
   const pulse=calm?.5:.5+Math.sin(t*.35)*.5;c.globalAlpha=.10+pulse*.06;c.fillStyle='#fff3cf';
   for(const x of [80,520]){c.beginPath();c.moveTo(x,0);c.lineTo(x+110,0);c.lineTo(x+330,700);c.lineTo(x+150,700);c.closePath();c.fill();}
   c.globalAlpha=1;
   const top=c.createLinearGradient(0,0,0,90);top.addColorStop(0,'rgba(20,40,32,.28)');top.addColorStop(1,'rgba(20,40,32,0)');c.fillStyle=top;c.fillRect(0,0,1200,90);
   const bot=c.createLinearGradient(0,610,0,700);bot.addColorStop(0,'rgba(20,40,32,0)');bot.addColorStop(1,'rgba(20,40,32,.22)');c.fillStyle=bot;c.fillRect(0,610,1200,90);
  }
  if(!calm){for(let i=0;i<16;i++){const x=(i*97+t*(6+i%5))%1200,y=120+((i*173)%420)+Math.sin(t*.8+i)*14;c.globalAlpha=.25+.25*Math.sin(t*1.3+i*2);c.fillStyle='#fff6da';c.beginPath();c.arc(x,y,1.6+(i%3)*.6,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
 });
}
/** Mood for a waiting guest bubble: happy → ok → worried. */
export function guestMood(patience,max){const r=max>0?patience/max:1;return r>.6?'happy':r>.28?'ok':'worried';}
