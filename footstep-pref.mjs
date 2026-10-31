// R3: footsteps are off by default. A separate tiny device preference so the
// hotel save format is untouched. Soft footsteps play only when turned on.
const KEY='snuggle-inn-footsteps';
export function readFootsteps(storage=globalThis.localStorage){try{return storage?.getItem(KEY)==='soft';}catch{return false;}}
export function writeFootsteps(on,storage=globalThis.localStorage){try{storage?.setItem(KEY,on?'soft':'off');}catch{}return !!on;}
