/** One real orthographic ground-plane projection; never skew upright sprites or UI. */
export const ISO_AXES=Object.freeze({x:.8660254037844386,y:.5,z:1});
export function projectRoomPoint(p,{scale=1,x=0,y=0}={}){return {x:x+(p.x-p.y)*ISO_AXES.x*scale,y:y+(p.x+p.y)*ISO_AXES.y*scale-(p.z||0)*scale};}
export function unprojectRoomPoint(p,camera={}){const scale=camera.scale||1,dx=(p.x-(camera.x||0))/(ISO_AXES.x*scale),dy=(p.y-(camera.y||0))/(ISO_AXES.y*scale);return {x:(dx+dy)/2,y:(dy-dx)/2};}
export function fitRoomCamera(bounds,width,height,padding=30){
 const points=[];for(const x of [bounds.x,bounds.x+bounds.w])for(const y of [bounds.y,bounds.y+bounds.h])for(const z of [0,bounds.wallHeight||110])points.push(projectRoomPoint({x,y,z}));
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const scale=Math.max(.1,Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxY-minY)));
 return {scale,x:(width-(maxX-minX)*scale)/2-minX*scale,y:(height-(maxY-minY)*scale)/2-minY*scale};
}
export function roomGroundPolygon(rect,camera,z=0){return [{x:rect.x,y:rect.y,z},{x:rect.x+rect.w,y:rect.y,z},{x:rect.x+rect.w,y:rect.y+rect.h,z},{x:rect.x,y:rect.y+rect.h,z}].map(p=>projectRoomPoint(p,camera));}
export function hitRoomGround(point,rect,camera){const p=unprojectRoomPoint(point,camera);return p.x>=rect.x&&p.x<=rect.x+rect.w&&p.y>=rect.y&&p.y<=rect.y+rect.h;}
