// R3: each dish gets its own small "finish" motion after it is dragged to its
// place. View-only: the engine still receives the same single place action,
// so rewards, timers and economy are unchanged. Motions are lenient and never fail.
export const FINISH_MOTIONS=Object.freeze({
 hold:{cue:'✋',label:'Hold to press',taps:0},
 tap2:{cue:'👆',label:'Tap twice',taps:2},
 sprinkle:{cue:'✨',label:'Tap 3 times to sprinkle',taps:3},
 slice:{cue:'↔',label:'Swipe across to slice',taps:0},
 stir:{cue:'🔄',label:'Circle to stir',taps:0},
 spread:{cue:'〰',label:'Zigzag to spread',taps:0},
 flick:{cue:'⬆',label:'Flick up to flip',taps:0},
 chop:{cue:'🔪',label:'Chop down twice',taps:2},
 pour:{cue:'🫗',label:'Slide down slowly to pour',taps:0},
});
export const FOOD_FINISH=Object.freeze({toast:'hold',egg:'tap2',apple:'slice',croissant:'drop',tea:'stir',jam:'spread',pancakes:'flick',banana:'chop',milk:'pour',pastry:'hold',cup:'pour',fruit:'slice',noodles:'drop',broth:'stir',toppings:'sprinkle'});
export const finishMotionFor=item=>{const m=FOOD_FINISH[item];return m&&m!=='drop'&&FINISH_MOTIONS[m]?m:null;};
// points: [{x,y,t}] of one gesture. Returns {done, count} where count is the
// progress to carry into the next gesture (taps/chops).
export function evaluateFinish(motion,points,count=0){
 if(!points?.length)return{done:false,count};
 const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,dur=(b.t??0)-(a.t??0);
 let travel=0,far=0;for(let i=1;i<points.length;i++){travel+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);far=Math.max(far,Math.hypot(points[i].x-a.x,points[i].y-a.y));}
 const tap=far<16&&dur<450;
 if(motion==='hold')return{done:dur>=480&&far<36,count};
 if(motion==='tap2'||motion==='sprinkle'){const n=tap?count+1:count;return{done:n>=FINISH_MOTIONS[motion].taps,count:n};}
 if(motion==='slice')return{done:Math.abs(dx)>=70&&Math.abs(dx)>Math.abs(dy)*1.3,count};
 if(motion==='flick')return{done:dy<=-55&&Math.abs(dy)>Math.abs(dx)*1.2,count};
 if(motion==='pour')return{done:dy>=45&&dur>=300&&Math.abs(dy)>Math.abs(dx),count};
 if(motion==='chop'){let n=count,seg=0;for(let i=1;i<points.length;i++){const step=points[i].y-points[i-1].y;if(step>0)seg+=step;else if(step<-2){if(seg>=35)n++;seg=0;}}if(seg>=35)n++;return{done:n>=2,count:n};}
 if(motion==='spread'){const revs=k=>{let rev=0,dir=0,run=0;for(let i=1;i<points.length;i++){const step=points[i][k]-points[i-1][k];if(!step)continue;const s=Math.sign(step);if(s===dir)run+=Math.abs(step);else{if(dir&&run>=14)rev++;dir=s;run=Math.abs(step);}}return rev;};return{done:Math.max(revs('x'),revs('y'))>=2&&travel>=80,count};}
 if(motion==='stir'){const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;let arc=0,last=null;for(const p of points){if(Math.hypot(p.x-cx,p.y-cy)<8)continue;const ang=Math.atan2(p.y-cy,p.x-cx);if(last!==null){let d=ang-last;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;arc+=d;}last=ang;}return{done:Math.abs(arc)>=Math.PI*1.5&&travel>=90,count};}
 return{done:true,count};
}
