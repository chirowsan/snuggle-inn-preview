/** Grid landscape geometry only. No DOM, wall clock, money, profile or storage. */
export const GRID=Object.freeze({x:-280,y:590,cell:40,cols:44,rows:16,maxCells:704,maxEdges:256,undo:40});
export const FINISHES=Object.freeze(['stone','brick','gravel','grass','flowerbed']);
export const EDGE_KINDS=Object.freeze(['timber','hedge','gate']);
export const emptyLandscape=()=>({version:1,cells:[],edges:[]});
const clone=v=>JSON.parse(JSON.stringify(v));
const own=(v,k)=>{try{const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
const keys=(v,expected)=>{try{return Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k)&&Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));}catch{return false;}};
const tuple=(v,n)=>{try{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length===n&&Reflect.ownKeys(v).length===n+1&&Array.from({length:n},(_,i)=>i).every(i=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))||{},'value'));}catch{return false;}};
const list=(v,max)=>{try{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Number.isInteger(own(v,'length'))&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>i).every(i=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))||{},'value'));}catch{return false;}};
const int=(v,max)=>Number.isInteger(v)&&v>=0&&v<max;
export function validateLandscape(layout){
 if(!layout||!keys(layout,['version','cells','edges'])||own(layout,'version')!==1)return {ok:false,reason:'Unsupported landscape version or fields.'};
 const cells=own(layout,'cells'),edges=own(layout,'edges');if(!list(cells,GRID.maxCells)||!list(edges,GRID.maxEdges))return {ok:false,reason:'Landscape capacity exceeded or invalid list.'};
 const used=new Set();for(let i=0;i<cells.length;i++){const c=own(cells,String(i));if(!tuple(c,3)||!int(own(c,'0'),GRID.cols)||!int(own(c,'1'),GRID.rows)||!FINISHES.includes(own(c,'2')))return {ok:false,reason:'Invalid landscape surface.'};const key=c[0]+','+c[1];if(used.has(key))return {ok:false,reason:'Duplicate landscape cell.'};used.add(key);}
 used.clear();for(let i=0;i<edges.length;i++){const e=own(edges,String(i));if(!tuple(e,4)||!['h','v'].includes(own(e,'0'))||!int(own(e,'1'),e[0]==='h'?GRID.cols:GRID.cols+1)||!int(own(e,'2'),e[0]==='h'?GRID.rows+1:GRID.rows)||!EDGE_KINDS.includes(own(e,'3')))return {ok:false,reason:'Invalid fence or gate.'};const key=e.slice(0,3).join(',');if(used.has(key))return {ok:false,reason:'Duplicate landscape edge.'};used.add(key);}
 return {ok:true,reason:''};
}
export function worldToCell(x,y){if(typeof x==='object'){y=x.y;x=x.x;}return {col:Math.floor((x-GRID.x)/GRID.cell),row:Math.floor((y-GRID.y)/GRID.cell)};}
export function worldToVertex(x,y){if(typeof x==='object'){y=x.y;x=x.x;}return {col:Math.round((x-GRID.x)/GRID.cell),row:Math.round((y-GRID.y)/GRID.cell)};}
export function cellToWorld(col,row,center=false){if(typeof col==='object'){center=!!row;row=col.row;col=col.col;}return {x:GRID.x+(col+(center?.5:0))*GRID.cell,y:GRID.y+(row+(center?.5:0))*GRID.cell};}
const point=(p,vertex=false)=>p&&int(p.col,GRID.cols+(vertex?1:0))&&int(p.row,GRID.rows+(vertex?1:0));
const sortedCells=values=>[...values].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
const sortedEdges=values=>[...values].sort((a,b)=>a[0].localeCompare(b[0])||a[2]-b[2]||a[1]-b[1]);
const failed=(layout,reason)=>({ok:false,reason,layout:clone(layout)});
export function applyLandscapeRect(layout,start,end,finish){
 const valid=validateLandscape(layout);if(!valid.ok)return {ok:false,reason:valid.reason,layout:null};if(!point(start)||!point(end)||!['erase',...FINISHES].includes(finish))return failed(layout,'Choose two corners inside the garden grid.');
 const cells=new Map(layout.cells.map(c=>[c[0]+','+c[1],c]));for(let row=Math.min(start.row,end.row);row<=Math.max(start.row,end.row);row++)for(let col=Math.min(start.col,end.col);col<=Math.max(start.col,end.col);col++){const key=col+','+row;if(finish==='erase')cells.delete(key);else cells.set(key,[col,row,finish]);}
 return {ok:true,reason:'',layout:{version:1,cells:sortedCells(cells.values()),edges:clone(layout.edges)}};
}
export function applyLandscapeLine(layout,start,end,kind){
 const valid=validateLandscape(layout);if(!valid.ok)return {ok:false,reason:valid.reason,layout:null};if(!point(start,true)||!point(end,true)||!['erase',...EDGE_KINDS].includes(kind)||start.col!==end.col&&start.row!==end.row)return failed(layout,'Fence runs must follow one horizontal or vertical grid line.');
 if(start.col===end.col&&start.row===end.row)return failed(layout,'Choose a different end point.');
 const edges=new Map(layout.edges.map(e=>[e.slice(0,3).join(','),e])),horizontal=start.row===end.row,axis=horizontal?'h':'v',a=horizontal?'col':'row',fixed=horizontal?start.row:start.col;
 for(let n=Math.min(start[a],end[a]);n<Math.max(start[a],end[a]);n++){const col=horizontal?n:fixed,row=horizontal?fixed:n,key=[axis,col,row].join(',');if(kind==='erase')edges.delete(key);else edges.set(key,[axis,col,row,kind]);}
 if(edges.size>GRID.maxEdges)return failed(layout,`Fence limit reached: ${GRID.maxEdges} grid edges. Erase a run first.`);
 return {ok:true,reason:'',layout:{version:1,cells:clone(layout.cells),edges:sortedEdges(edges.values())}};
}
/** Select a connected same-finish region. Bounds are inclusive cell coordinates. */
export function connectedArea(layout,cell){
 if(!validateLandscape(layout).ok||!point(cell))return null;const map=new Map(layout.cells.map(c=>[c[0]+','+c[1],c[2]])),finish=map.get(cell.col+','+cell.row);if(!finish)return null;
 const visited=new Set([cell.col+','+cell.row]),queue=[{...cell}];for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]]){const col=p.col+dc,row=p.row+dr,key=col+','+row;if(visited.has(key)||map.get(key)!==finish)continue;visited.add(key);queue.push({col,row});}}
 const min={col:Math.min(...queue.map(p=>p.col)),row:Math.min(...queue.map(p=>p.row))},max={col:Math.max(...queue.map(p=>p.col)),row:Math.max(...queue.map(p=>p.row))};return {finish,cells:queue,min,max};
}
/** Resize the selected connected region to a rectangle anchored at its upper-left cell.
 * Only that component is erased; overlap is an explicit previewed finish replacement. */
export function resizeLandscapeArea(layout,cell,newEnd){
 const area=connectedArea(layout,cell);if(!area)return {ok:false,reason:'Select a painted surface to resize.',layout:validateLandscape(layout).ok?clone(layout):null};
 if(!point(newEnd)||newEnd.col<area.min.col||newEnd.row<area.min.row)return failed(layout,'Choose the opposite corner at or beyond the fixed corner.');
 const removed=new Set(area.cells.map(p=>p.col+','+p.row)),base={version:1,cells:layout.cells.filter(c=>!removed.has(c[0]+','+c[1])),edges:clone(layout.edges)};return applyLandscapeRect(base,area.min,newEnd,area.finish);
}
/** Shared cell/fence rules for entrance validation and ambient garden routing.
 * Props and body clearance are intentionally layered by the routing consumer. */
export function landscapeGrid(layout){
 const valid=validateLandscape(layout);if(!valid.ok)return {...valid,passable:()=>false,edgeOpen:()=>false,connected:()=>false};
 const surfaces=new Map(layout.cells.map(c=>[c[0]+','+c[1],c[2]])),edges=new Map(layout.edges.map(e=>[e.slice(0,3).join(','),e[3]]));
 const passable=(col,row)=>int(col,GRID.cols)&&int(row,GRID.rows)&&surfaces.get(col+','+row)!=='flowerbed';
 const edgeOpen=(axis,col,row)=>!edges.has([axis,col,row].join(','))||edges.get([axis,col,row].join(','))==='gate';
 const connected=(a,b)=>passable(a.col,a.row)&&passable(b.col,b.row)&&Math.abs(a.col-b.col)+Math.abs(a.row-b.row)===1&&edgeOpen(a.col!==b.col?'v':'h',a.col!==b.col?Math.max(a.col,b.col):a.col,a.row!==b.row?Math.max(a.row,b.row):a.row);
 return {ok:true,reason:'',surfaces,edges,passable,edgeOpen,connected};
}
/** Each of the four existing entrance cells must reach a passable south-edge exit.
 * This is a one-cell (40 world-unit) route; it does not claim two-cell clearance. */
export function landscapeAccess(layout){
 const grid=landscapeGrid(layout);if(!grid.ok)return {ok:false,reason:grid.reason,path:[]};
 const seen=new Set(),queue=[],prev=new Map();for(let c=0;c<GRID.cols;c++)if(grid.passable(c,GRID.rows-1)&&grid.edgeOpen('h',c,GRID.rows)){const key=c+','+(GRID.rows-1);seen.add(key);queue.push([c,GRID.rows-1]);}
 for(let at=0;at<queue.length;at++){const [c,r]=queue[at];for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]]){const nc=c+dc,nr=r+dr,key=nc+','+nr;if(seen.has(key)||!grid.connected({col:c,row:r},{col:nc,row:nr}))continue;seen.add(key);queue.push([nc,nr]);prev.set(key,c+','+r);}}
 for(const c of [20,21,22,23])if(!grid.edgeOpen('h',c,0)||!seen.has(c+',0'))return {ok:false,reason:'Keep the hotel entrance connected to the bottom of the garden. Add a gate or erase a fence/flowerbed.',path:[],blockedEntrance:c};
 const path=[];let key='21,0';while(key){const [col,row]=key.split(',').map(Number);path.push({col,row});key=prev.get(key);}return {ok:true,reason:'Entrance route clear · 1 grid cell minimum.',path};
}
export function createLandscapeDraft(raw=emptyLandscape()){
 const check=validateLandscape(raw);if(!check.ok)throw new TypeError(check.reason);let baseline=clone(raw),layout=clone(raw);const undo=[],redo=[];
 const api={get layout(){return clone(layout);},get dirty(){return JSON.stringify(layout)!==JSON.stringify(baseline);},get canUndo(){return undo.length>0;},get canRedo(){return redo.length>0;},get access(){return landscapeAccess(layout);},
 edit(result){if(!result?.ok||!validateLandscape(result.layout).ok)return false;if(JSON.stringify(result.layout)===JSON.stringify(layout))return false;undo.push(layout);if(undo.length>GRID.undo)undo.shift();layout=clone(result.layout);redo.length=0;return true;},
 undo(){if(!undo.length)return false;redo.push(layout);layout=undo.pop();return true;},redo(){if(!redo.length)return false;undo.push(layout);layout=redo.pop();return true;},
 reset(){layout=clone(baseline);undo.length=redo.length=0;},apply(){const access=landscapeAccess(layout);if(!access.ok)return {...access,layout:null};baseline=clone(layout);undo.length=redo.length=0;return {ok:true,reason:'',layout:clone(layout)};}};return api;
}
