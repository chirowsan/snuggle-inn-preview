/** Read-only intent for tapping a room without an item or guest selected.
 * Commands are proposals, not reservations: the caller must commit once through
 * the engine (or open the cleaning activity) and revalidate at commit time.
 */
import { canRushCommand } from './rush.mjs';
import {isFacility,isLeisure} from './hotel-content.mjs';

const isVisit = id => isFacility(id) || isLeisure(id);
const SERVICE = Object.freeze({ towel: 'deliverTowel', meal: 'deliverMeal', repair: 'repairRoom' });
const none = () => ({ kind: 'none' });
const recovery = (target, reason) => ({ kind: 'recovery', target, reason });

function emptyTowels(state) {
  const laundry = state.laundry;
  if (laundry.status === 'ready') return recovery('washer', 'fold');
  if (laundry.loading || ['washing', 'loading'].includes(laundry.status)) {
    return recovery('washer', 'washing');
  }
  if (laundry.status !== 'idle') return none();
  if (laundry.dirty > 0) return recovery('used', 'load-wash');
  // Prefer a used towel over a room whose guest did not need one this stay.
  const room = state.rooms.find(room => room.status === 'dirty' && room.towelUsed)
    || state.rooms.find(room => room.status === 'dirty');
  return room ? recovery(room.id, 'clean-room') : none();
}

/** Recovery targets are station/control IDs or the ID of a dirty room.
 * The reason distinguishes a kitchen/washer clock from its next active step.
 */
export function requestPlan(state, roomId) {
  if (!state || state.status !== 'playing' || state.paused
    || typeof roomId !== 'string' || !Array.isArray(state.rooms)
    || !Array.isArray(state.guests) || !state.actors || !state.laundry || !state.kitchen) return none();

  // Invalid/incomplete checkpoints must not turn a UI hint into an exception.
  try {
    const room = state.rooms.find(room => room.id === roomId);
    if (!room) return none();
    if (room.status === 'available') {
      const guest = state.guests.find(guest => guest.status === 'waiting');
      if (!guest) return none();
      const validation = canRushCommand(state, { type: 'assignRoom', roomId, guestId: guest.id });
      if (validation.ok) return recovery('floor-0', 'waiting-guest');
      return validation.message === 'All staff are busy.' ? recovery('crew', 'staff-busy') : none();
    }

    if(room.status==='occupied'&&room.request==='visiting'&&isVisit(room.activeRequest))return recovery('facility-'+room.activeRequest,'facility-activity');
    const type = room.status === 'dirty' ? 'cleanRoom'
      : room.status === 'occupied' ? (isVisit(room.request)?'visitFacility':SERVICE[room.request]) : null;
    if (!type) return none();
    const command = { type, roomId, ...(type==='visitFacility'?{facilityId:room.request}:{}) };
    const validation = canRushCommand(state, command);
    if (validation.ok) return { kind: type === 'cleanRoom' ? 'activity' : 'command', command };

    // Follow the engine's actual rejection order: empty stock precedes busy
    // staff, and an expired/wrong request never points at an unrelated station.
    if (type==='visitFacility'&&validation.message==='This facility is busy.')return recovery('facility-'+room.request,'facility-busy');
    if (validation.message === 'All staff are busy.') return recovery('crew', 'staff-busy');
    if (type === 'deliverMeal' && validation.message === 'No meals. Start the kitchen.') {
      return recovery('kitchen', state.kitchen.status === 'cooking' ? 'cooking' : 'no-meals');
    }
    if (type === 'deliverTowel' && validation.message === 'No towels. Wash, then fold.') return emptyTowels(state);
    return none();
  } catch {
    return none();
  }
}

/** Keep a completed inspection readable briefly without extending its simulation. */
export function inspectionFeedbackVisible(state) {
  const inspection=state.inspection, actor=state.actors?.inspector;
  if(state.version<6||!inspection?.eligible||['won','lost'].includes(state.status))return false;
  const at=inspection.assessments?.at(-1)?.at;
  return !!actor?.visible || (!!inspection.outcome&&Number.isFinite(at)&&state.time>=at&&state.time<=at+12);
}
