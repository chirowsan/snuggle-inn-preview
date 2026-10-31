/** Render-only 2.5D camera. Saved v1/v2/v3 coordinates and placement constraints are untouched. */
export const PROJECTION=Object.freeze({a:.9,b:.18,c:-.5,d:.65,x:600,y:550,depth:230});
const {a,b,c,d,x:ox,y:oy}=PROJECTION;
export function groundPoint(x,y,z=0){return {x:ox+a*(x-600)+c*(y-550),y:oy+b*(x-600)+d*(y-550)-z};}
export function groundInverse(x,y){const X=x-ox,Y=y-oy,det=a*d-b*c;return {x:600+(d*X-c*Y)/det,y:550+(-b*X+a*Y)/det};}
export function frontPoint(x,y){return groundPoint(x,550,550-y);}
export function frontInverse(x,y){const X=600+(x-ox)/a;return {x:X,y:y-b*(X-600)};}
export const GROUND_MATRIX=`matrix(${a},${b},${c},${d},${ox-a*600-c*550},${oy-b*600-d*550})`;
export const FRONT_MATRIX=`matrix(${a},${b},0,1,${ox-a*600},${-b*600})`;
export function bounds(points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
export function projectRect(rect,project=groundPoint){return bounds([[rect.x,rect.y],[rect.x+rect.width,rect.y],[rect.x+rect.width,rect.y+rect.height],[rect.x,rect.y+rect.height]].map(([x,y])=>project(x,y)));}
export function buildingSilhouette(model){const top=model.roofY+4,depth=PROJECTION.depth;return [groundPoint(160,550,550-top),groundPoint(160,550-depth,550-top),groundPoint(1040,550-depth,550-top),groundPoint(1040,550-depth),groundPoint(1040,550),groundPoint(160,550)];}
export function homeBounds(model){return bounds([...buildingSilhouette(model),groundPoint(80,730),groundPoint(1120,730)]);}
export const PROJECTED_WORLD=Object.freeze(bounds([groundPoint(-300,-400),groundPoint(1500,-400),groundPoint(1500,1250),groundPoint(-300,1250),{x:-300,y:-650}]));
