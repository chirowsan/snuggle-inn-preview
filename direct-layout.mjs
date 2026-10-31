import { SERVICE_CONFIG } from './service.mjs';

const near = (a, b) => Math.abs(a - b) < 1e-7;
const offset = (room, x = 0, y = 0) => ({ x: room.x + x, y: room.y + y });

function place(actor, destination) {
  if (!actor) return;
  actor.x = destination.x;
  actor.y = destination.y;
  actor.target = actor.path?.[0] || null;
}

function retarget(actor, before, after) {
  if (!actor || !Array.isArray(actor.path)) return;
  if (actor.path.length) {
    actor.path = actor.path.map(point => {
      if (near(point.x, before.x) && near(point.y, before.y)) return { ...after };
      if (near(point.x, before.x) && near(point.y, SERVICE_CONFIG.hallwayY)) {
        return { x: after.x, y: SERVICE_CONFIG.hallwayY };
      }
      return point;
    });
  } else if (near(actor.x, before.x) && near(actor.y, before.y)) {
    // One escort may have arrived while its partner is still walking.
    place(actor, after);
  }
  actor.target = actor.path[0] || null;
}

/**
 * Re-anchor doors after a viewport change without advancing the simulation.
 * Only room-bound routes and at-door poses move; jobs and resources are untouched.
 * Unknown/non-finite anchors are ignored. Repeating the same anchors is a no-op.
 */
export function setRoomAnchors(state, anchors) {
  if (!state || !Array.isArray(state.rooms) || !Array.isArray(anchors)) return state;
  const requested = new Map();
  for (const anchor of anchors) {
    if (anchor && typeof anchor.id === 'string'
      && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) requested.set(anchor.id, anchor);
  }
  const changed = new Map();
  for (const room of state.rooms) {
    const next = requested.get(room.id);
    if (!next || (room.x === next.x && room.y === next.y)) continue;
    changed.set(room.id, { before: offset(room), after: offset(next) });
    room.x = next.x;
    room.y = next.y;
  }
  if (!changed.size) return state;

  const guests = Array.isArray(state.guests) ? state.guests : [];
  const forGuest = (id, update) => {
    const guest = guests.find(value => value.id === id);
    if (!guest) return;
    update(guest);
    // JSON snapshots may not yet have had their guest/actor aliases restored.
    const actor = state.actors?.[id];
    if (actor && actor !== guest) update(actor);
  };
  const courier = state.actors?.courier, courierJob = courier?.job;
  const courierRoom = changed.get(courierJob?.roomId);
  if (courierRoom) {
    const { before, after } = courierRoom;
    if (courierJob.type === 'assignRoom') {
      if (courierJob.phase === 'guide') {
        retarget(courier, offset(before, 90, 25), offset(after, 90, 25));
        forGuest(courierJob.guestId, guest => retarget(guest, before, after));
      } else if (courierJob.phase === 'welcome') {
        place(courier, offset(after, 90, 25));
        forGuest(courierJob.guestId, guest => place(guest, after));
      }
    } else if (courierJob.type === 'deliverTowel') {
      if (courierJob.phase === 'deliver') {
        retarget(courier, offset(before, 25, 18), offset(after, 25, 18));
      } else if (courierJob.phase === 'give') {
        place(courier, offset(after, 25, 18));
      }
    }
  }

  const mechanic = state.actors?.mechanic, mechanicJob = mechanic?.job;
  const mechanicRoom = changed.get(mechanicJob?.roomId);
  if (mechanicRoom && mechanicJob.type === 'cleanRoom') {
    if (mechanicJob.phase === 'room') retarget(mechanic, mechanicRoom.before, mechanicRoom.after);
    else if (mechanicJob.phase === 'tidy') place(mechanic, mechanicRoom.after);
  }

  for (const guest of guests) {
    const destination = changed.get(guest.roomId)?.after;
    if (destination && !guest.visible && ['occupied', 'served'].includes(guest.status)) {
      forGuest(guest.id, actor => place(actor, destination));
    }
  }
  return state;
}
