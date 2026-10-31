import {PROJECTED_WORLD,buildingSilhouette,groundPoint} from './exterior-projection.mjs';
import {WORLD} from './exterior-model.mjs';
/** Cosmetic only. Never reads or writes the simulation, clocks, targets or save store. */
export const WEATHER_CHOICES=Object.freeze(['cycle','sunshine','overcast','rain','off']);
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export function restoreAtmosphereSettings(saved={}){
 saved=saved&&typeof saved==='object'?saved:{};
 return {atmosphereVersion:1,weather:WEATHER_CHOICES.includes(saved.weather)?saved.weather:'cycle',weatherVolume:Number.isFinite(saved.weatherVolume)?clamp(saved.weatherVolume):.3,weatherEnabled:typeof saved.weatherEnabled==='boolean'?saved.weatherEnabled:saved.effectsEnabled!==false&&saved.sound!==false};
}
export function weatherAt(seconds=0,mode='cycle',reducedMotion=false){
 if(mode==='off')return {mode:'off',sun:0,cloud:0,rain:0,time:0};
 const states={sunshine:[1,0,0],overcast:[0,1,0],rain:[0,1,1]};
 let v=states[mode];
 // A six-minute atmospheric cycle, with slow 24-second dissolves. No sudden flashes.
 if(!v){const t=Math.max(0,Number.isFinite(seconds)?seconds:0)%360,i=Math.floor(t/90),keys=['sunshine','overcast','rain','overcast'],a=states[keys[i]],b=states[keys[(i+1)%4]],u=Math.max(0,(t%90-66)/24),s=u*u*(3-2*u);v=a.map((n,j)=>n+(b[j]-n)*s);}
 return {mode,sun:v[0],cloud:v[1],rain:v[2],time:reducedMotion?0:seconds};
}
// Explicit masks follow approved art. The lobby's outdoor patio begins beyond x=748.
// Upper floors are fully enclosed: no rain is painted over their walls/ceilings.
export const LOBBY_RAIN_POLYGON=Object.freeze([[733,0],[1200,0],[1200,645],[753,645]].map(Object.freeze));
export function weatherRegions(exterior=false,floor=0,building=null){if(exterior&&building){const roof=Math.max(WORLD.y,building.roofY);return [[WORLD.x,WORLD.y,460,535-WORLD.y],[1040,WORLD.y,460,535-WORLD.y],[160,WORLD.y,880,roof-WORLD.y],[WORLD.x,535,WORLD.width,715]];}return exterior?[[0,0,160,510],[1040,0,160,510],[0,535,1200,165],[0,0,1200,12],[-300,535,300,715],[1200,535,300,715],[0,700,1200,550]]:floor===0?[[748,0,162,605]]:[];}
// Deterministic layers, allocated once. No simulation RNG, timers or accumulating particle state.
const fract=x=>x-Math.floor(x),hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
const DROPS=Object.freeze(Array.from({length:96},(_,i)=>Object.freeze({u:hash(i+1),v:hash(i+101),phase:hash(i+301),depth:i%3,period:1.7+hash(i+501)*1.4})));
export const RAIN_LIMITS=Object.freeze({lobby:64,exterior:96});
/** Surface impacts only: no fountain bowl, stairs, reception, wall or roof splashes. */
export function lobbyRainSurface(x,y){
 return x>=754&&x<=1190&&y>=225&&y<=620&&
  !(((x-850)/76)**2+((y-411)/100)**2<1)&&
  !(x>922&&x<1182&&y<653);
}
export function rainSample(index,time,{exterior=false,projected=false,reducedMotion=false}={}){
 const d=DROPS[index%DROPS.length],near=d.depth/2;
 const gx=exterior?WORLD.x+32+d.u*(WORLD.width-64):index<52?754+d.u*180:1184+d.u*14;
 const gy=exterior?550+d.v*670:235+d.v*380;
 const p=projected?groundPoint(gx,gy):{x:gx,y:gy};
 const phase=reducedMotion?.88:fract(time/d.period+d.phase),fall=Math.min(1,phase/.78);
 const wind=reducedMotion?0:Math.sin(time*.27)*2.5;
 const height=95+near*140,length=23+near*23,drift=12+near*10+wind,dx=-length*(.12+near*.04);
 return {x:p.x+(1-fall)*drift-dx,y:p.y-height*(1-fall)-length,dx,dy:length,
  groundX:p.x,groundY:p.y,groundLogicalX:gx,groundLogicalY:gy,depth:d.depth,
  width:1.5+near*1.3,alpha:.48+near*.34,falling:phase<.78,
  impact:phase>=.78?(phase-.78)/.22:-1,
  surface:exterior||lobbyRainSurface(gx,gy)};
}
function clipRain(c,{exterior,floor,building,projected,world}){
 c.beginPath();
 if(projected&&building){c.rect(world.x,world.y,world.width,world.height);const polygon=buildingSilhouette(building);c.moveTo(polygon[0].x,polygon[0].y);for(const p of polygon.slice(1))c.lineTo(p.x,p.y);c.closePath();c.clip('evenodd');}
 else if(!exterior){
  // Follow the open court, not an arbitrary vertical strip. Real stairs and fountain
  // are painted afterwards by RushRenderer, so their art remains in front of rain.
  c.moveTo(...LOBBY_RAIN_POLYGON[0]);for(const point of LOBBY_RAIN_POLYGON.slice(1))c.lineTo(...point);c.closePath();c.clip();
 }else{for(const r of weatherRegions(true,floor,building))c.rect(...r);c.clip();}
}
function groundSheen(c,rain,{exterior,projected}){
 c.save();c.beginPath();
 if(!exterior){c.moveTo(754,225);c.lineTo(922,225);c.lineTo(922,620);c.lineTo(754,620);c.closePath();
  // Exclude the fountain's stone bowl and falling water from painted ground sheen.
  c.moveTo(926,411);c.ellipse(850,411,76,100,0,0,Math.PI*2);c.clip('evenodd');
 }else if(projected){const p=[groundPoint(-300,550),groundPoint(1500,550),groundPoint(1500,1250),groundPoint(-300,1250)];c.moveTo(p[0].x,p[0].y);for(const q of p.slice(1))c.lineTo(q.x,q.y);c.closePath();c.clip();}
 else{c.rect(WORLD.x,550,WORLD.width,700);c.clip();}
 if(!exterior){c.fillStyle=`rgba(38,74,91,${.14*rain})`;c.fillRect(-4000,-4000,8000,8000);}
 const patches=exterior?6:3;
 for(let i=0;i<patches;i++){
  const x=exterior?-170+i*290:785+i*47,y=exterior?620+(i%3)*210:290+i*130,p=projected?groundPoint(x,y):{x,y};
  c.save();c.translate(p.x,p.y);c.scale(1,.28);
  const radius=exterior?105:64,g=c.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,`rgba(196,219,223,${.34*rain})`);g.addColorStop(1,'rgba(196,219,223,0)');c.fillStyle=g;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();
 }
 c.restore();
}
export function drawHotelWeather(c,weather,{exterior=false,floor=0,reducedMotion=false,building=null,projected=false}={}){
 if(!weather||(!exterior&&floor!==0))return;
 const {sun,cloud,rain}=weather,t=reducedMotion?0:weather.time,world=projected?PROJECTED_WORLD:WORLD;
 c.save();
 // A mild daylight shift unifies the scene; inside stays warm, never covered in rain.
 if(cloud&&!exterior){c.fillStyle=`rgba(59,82,101,${(exterior?.11:.06)*cloud})`;c.fillRect(exterior?world.x:0,exterior?world.y:0,exterior?world.width:1200,exterior?world.height:700);}
 clipRain(c,{exterior,floor,building,projected,world});
 if(sun&&!exterior){c.fillStyle=`rgba(255,225,155,${.045*sun})`;c.fillRect(world.x,world.y,world.width,world.height);}
 if(cloud&&!exterior){
  const grade=c.createLinearGradient(exterior?world.x:720,0,exterior?world.x+world.width:850,0);grade.addColorStop(0,`rgba(64,91,108,${exterior?.12*cloud:0})`);grade.addColorStop(1,`rgba(64,91,108,${.30*cloud})`);c.fillStyle=grade;c.fillRect(world.x,world.y,world.width,world.height);
 }
 if(rain){
  groundSheen(c,rain,{exterior,projected});
  const count=exterior?RAIN_LIMITS.exterior:RAIN_LIMITS.lobby;
  // Far/near layers have distinct speeds, widths, lengths and gentle wind. No white bars.
  for(let i=0;i<count;i++){
   const p=rainSample(i,t,{exterior,projected,reducedMotion});
   const edge=exterior?1:Math.min(1,Math.max(0,(p.x-738)/32));
   if(p.falling&&!reducedMotion){c.strokeStyle=`rgba(199,222,231,${p.alpha*rain*edge})`;c.lineWidth=p.width;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+p.dx,p.y+p.dy);c.stroke();}
   if(p.impact>=0&&p.surface){
    const u=p.impact,r=1+u*(p.depth===2?8:5),fade=(1-u)*rain;
    c.strokeStyle=`rgba(208,230,233,${.58*fade})`;c.lineWidth=.9;c.beginPath();c.ellipse(p.groundX,p.groundY,r,r*.29,projected?.18:0,0,Math.PI*2);c.stroke();
    if(u<.26&&!reducedMotion){c.strokeStyle=`rgba(224,239,237,${.45*fade})`;c.beginPath();c.moveTo(p.groundX-2,p.groundY-1);c.lineTo(p.groundX-3,p.groundY-4*(1-u));c.moveTo(p.groundX+2,p.groundY-1);c.lineTo(p.groundX+3,p.groundY-3*(1-u));c.stroke();}
   }
  }
 }
 c.restore();
}
/** Lazily attaches one bounded, non-interactive canvas to the existing exterior scene. */
export function drawExteriorWeather(view,weather,reducedMotion=false){
 if(!view?.scene||view.destroyed)return;
 const world=view.frontLayer?PROJECTED_WORLD:WORLD;
 if(!view.weatherCanvas){const canvas=view.doc.createElement('canvas');canvas.width=Math.ceil(world.width);canvas.height=Math.ceil(world.height);canvas.setAttribute('aria-hidden','true');canvas.style.cssText=`position:absolute;left:${world.x}px;top:${world.y}px;width:${world.width}px;height:${world.height}px;pointer-events:none;z-index:20`;view.scene.append(canvas);view.weatherCanvas=canvas;}
 const bucket=Math.floor(weather.time*20),choice=weather.mode+':'+reducedMotion+':'+(view.building?.roofY??'legacy');
 if(!reducedMotion&&view.weatherBucket===bucket&&view.weatherChoice===choice)return;view.weatherBucket=bucket;view.weatherChoice=choice;
 const signature=[choice,bucket,weather.sun.toFixed(3),weather.cloud.toFixed(3),weather.rain.toFixed(3),reducedMotion].join(':');if(view.weatherSignature===signature)return;view.weatherSignature=signature;
 const c=view.weatherCanvas.getContext('2d');if(!c)return;c.clearRect(0,0,Math.ceil(world.width),Math.ceil(world.height));c.save();c.translate(-world.x,-world.y);drawHotelWeather(c,weather,{exterior:true,reducedMotion,building:view.building,projected:!!view.frontLayer});c.restore();
}
