import { availableServiceActions, serviceCommand } from './service.mjs';

// Selection is UI state only. The engine remains the source of truth for
// availability, staff ownership, and inventory reservations at drop time.
function hasServiceState(state) {
  return !!state && Array.isArray(state.rooms) && Array.isArray(state.guests)
    && !!state.actors?.courier && !!state.actors?.mechanic
    && !!state.actors?.thief && !!state.laundry;
}

/** Read-only highlighted target IDs for a guest, clean towel, or dirty bundle. */
export function interactionTargets(state, selection) {
  if (!hasServiceState(state) || !selection) return [];
  let actions;
  switch (selection.kind) {
    case 'guest':
      if (typeof selection.id !== 'string') return [];
      actions = availableServiceActions(state, selection.id);
      return actions.filter(action => action.enabled && action.type === 'assignRoom'
        && action.guestId === selection.id).map(action => action.roomId);
    case 'towel':
      return availableServiceActions(state).filter(action => action.enabled
        && action.type === 'deliverTowel').map(action => action.roomId);
    case 'dirty':
      return availableServiceActions(state, 'laundry').some(action => action.enabled
        && action.type === 'loadWash') ? ['washer'] : [];
    default:
      return [];
  }
}

/** Commit once on drop; stale targets are revalidated atomically by the engine. */
export function commitInteraction(state, selection, targetId) {
  if (!hasServiceState(state)) return { ok: false, message: 'No hotel shift is loaded.' };
  if (!selection || typeof targetId !== 'string') {
    return { ok: false, message: 'Drop on a highlighted target.' };
  }

  let input;
  if (selection.kind === 'guest' && typeof selection.id === 'string') {
    input = { type: 'assignRoom', guestId: selection.id, roomId: targetId };
  } else if (selection.kind === 'towel') {
    input = { type: 'deliverTowel', roomId: targetId };
  } else if (selection.kind === 'dirty' && targetId === 'washer') {
    input = { type: 'loadWash' };
  } else {
    return { ok: false, message: 'Drop on a highlighted target.' };
  }
  return serviceCommand(state, input);
}
