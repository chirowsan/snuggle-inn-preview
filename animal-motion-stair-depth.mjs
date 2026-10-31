// Painted occluders only. No actor mask, bitmap edits, or motion clock.
export const STAIR_DEPTH_PARTS=Object.freeze([
 {id:'front-rail',base:[620,1336],polygon:[[560,1317],[685,1330],[707,1205],[660,1110],[641,1020],[691,850],[761,670],[830,480],[910,276],[967,242],[982,101],[960,53],[930,45],[907,80],[882,133],[851,240],[820,345],[785,466],[746,590],[706,720],[661,843],[618,955],[572,973],[554,1030],[569,1120],[550,1230]]},
 // Upper-left post plus its short rear balustrade is in front of the upper
 // landing, but behind actors already down on the lower treads.
 {id:'upper-left-post',base:[695,195],polygon:[[690,0],[737,0],[744,196],[697,228],[651,304],[604,390],[553,416],[534,393],[576,311],[612,236],[648,161],[683,97],[686,53]]}
]);
export function stairDepthItems(layout,viewFloor,lastFlight=2){
 const items=[];
 for(let f=lastFlight;f>=0;f--){const matrix={x:layout.m0.x,y:layout.m0.y+(viewFloor-f)*layout.stageHeight,k:layout.k};
  for(const part of STAIR_DEPTH_PARTS){const foot={x:matrix.x+part.base[0]*matrix.k,y:matrix.y+part.base[1]*matrix.k};items.push({id:`stair-${f}-${part.id}`,type:'stairOccluder',lowerFloor:f,part:part.id,polygon:part.polygon,matrix,screenDepth:foot.y,x:foot.x/layout.sx,y:(foot.y-layout.top)/layout.sy-viewFloor*700});}
 }
 return items;
}
export function drawStairDepthItem(ctx,image,item){const m=item.matrix;ctx.save();try{ctx.beginPath();item.polygon.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](m.x+x*m.k,m.y+y*m.k));ctx.closePath();ctx.clip();ctx.drawImage(image,m.x,m.y,1024*m.k,1536*m.k);}finally{ctx.restore();}}
