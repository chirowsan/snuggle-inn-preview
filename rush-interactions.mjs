import {canRushCommand,rushCommand} from './rush.mjs';
const types={towel:'deliverTowel',meal:'deliverMeal',broom:'cleanRoom',wrench:'repairRoom'};
export function interactionCommand(selection,targetId){if(!selection)return null;if(selection.kind==='guest'&&targetId?.startsWith('room-'))return {type:'assignRoom',guestId:selection.id,roomId:targetId};if(types[selection.kind]&&targetId?.startsWith('room-'))return {type:types[selection.kind],roomId:targetId};if(selection.kind==='dirty'&&targetId==='washer')return {type:'loadWash'};return null;}
export function interactionTargets(state,selection){const candidates=[...state.rooms.map(r=>r.id),'washer'];return candidates.filter(id=>{const c=interactionCommand(selection,id);return c&&canRushCommand(state,c).ok;});}
export function commitInteraction(state,selection,targetId){const c=interactionCommand(selection,targetId);return c?rushCommand(state,c):{ok:false,message:'Choose the matching request'};}
