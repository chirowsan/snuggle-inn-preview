/** Pointer-only transient progress. No timers, currency, or save writes. */
export const isMotionActivity=kind=>['scrub','tray','ramen','sushi','stirfry','crepe','pasta','pizza'].includes(kind);
export const motionCue=stage=>({drop:'Drag ingredients into place',pour:'Drag the jug to pour',plate:'Drag the wok to the plate',spread:'Sweep across the rice',roll:'Roll the mat upward',fold:'Fold across the fruit',flip:'Lift upward to flip',toss:'Sweep up and right',stretch:'Pull the dough outward',stir:'Stir around the pan',swirl:'Circle to spread sauce'}[stage?.gesture]||'Follow the motion');
/** Require broad alternating strokes, not jitter, taps, or one-way coverage.
 * Each completed return earns one third. Starting elsewhere never joins a stroke.
 * Coordinates are normalized to each stain for forgiving phone-sized play. */
export function scrubCoverage(points,rect){
 if(!rect||rect.width<=0||rect.height<=0||!Array.isArray(points))return [];
 let anchor=null,extreme=null,direction=0,returns=0;
 for(const point of points){const x=(point.x-rect.left)/rect.width,y=(point.y-rect.top)/rect.height;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<-.08||x>1.08||y<-.1||y>1.1){anchor=extreme=null;direction=0;continue;}
  if(anchor===null){anchor=extreme=x;continue;}
  if(!direction){if(Math.abs(x-anchor)>=.42){direction=Math.sign(x-anchor);extreme=x;}continue;}
  if(direction*(x-extreme)>0)extreme=x;
  else if(direction*(extreme-x)>=.42){returns++;direction=-direction;extreme=x;}
 }
 return Array.from({length:Math.min(3,returns)},(_,i)=>i);
}
