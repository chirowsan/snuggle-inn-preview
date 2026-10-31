/** Presentation-only crowd spacing and exit tails. Never changes simulation state.
 * Waiting hit targets and every renderer use anchor(), so an offset cannot leave
 * the tappable guest behind. Offsets ease out through pickup rather than snap.
 */
import { floorRoute } from './rush-floors.mjs';
import { conservativeFloorRoute } from './hotel-motion-route.mjs';
const ENTRY = { x: 600, y: 640 }, EXIT = { x: 600, y: 900 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = a => ({ x: a.x, y: a.y });
export function queueCrowdOffset(guest, guests) {
  if (guest.status !== 'waiting' || !guest.visible) return { x: 0, y: 0 };
  const blocked = guests.some(other => other.id !== guest.id && other.visible && other.status !== 'waiting'
    && Math.abs(other.x - guest.x) < 90 && Math.abs(other.y - guest.y) < 95);
  return blocked ? { x: 80, y: 100 } : { x: 0, y: 0 };
}
export class GuestPresentation {
  constructor() { this.reset(null); }
  reset(state) {
    this.state = state; this.time = state?.time || 0; this.previous = new Map();
    if (state) for (const guest of state.guests || []) this.previous.set(guest.id, { status: guest.status, visible: guest.visible });
    this.offsets = new Map(); this.departures = new Map();
  }
  anchor(guest) {
    const offset = this.offsets.get(guest.id) || { x: 0, y: 0 };
    return { x: guest.x + offset.x, y: guest.y + offset.y };
  }
  update(state, dt = 0) {
    if (this.state !== state || state.time < this.time) this.reset(state);
    // Modal/portrait/hidden-tab pauses do not advance engine time. Cosmetic
    // exit tails may finish behind an already-final result, never delay it.
    const elapsed = ['won', 'lost'].includes(state.status) ? Math.max(0, dt) : Math.max(0, state.time - this.time);
    this.time = state.time;
    const guests = state.guests || [];
    for (const guest of guests) {
      const previous = this.previous.get(guest.id);
      const resolved = ['abandoned', 'departed'].includes(guest.status) && !guest.visible;
      const newlyResolved = previous && (previous.status !== guest.status || previous.visible);
      if (resolved && newlyResolved) {
        const reason = guest.status === 'abandoned' ? (guest.intent === 'Lobby full' ? 'Lobby full' : 'Leaving') : '';
        const departure = { guestId: guest.id, name: guest.name, species: guest.species, spriteKind: guest.spriteKind,
          partySize: guest.partySize, customerType: guest.customerType, facing: guest.facing, reason };
        const start = this.anchor(guest);
        // A rejected arrival never had an on-screen position. Separate a same-
        // tick burst at the entrance instead of drawing one opaque pile there.
        if (reason === 'Lobby full') for (const offset of [0, 90, -90, 180, -180, 270, -270, 360, -360]) {
          const candidate = { x: start.x + offset, y: start.y };
          if (![...this.departures.values()].some(other => distance(candidate, other) < 85)) { start.x = candidate.x; break; }
        }
        const route = start.y >= 0
          ? (start.y < ENTRY.y ? [{ x: start.x, y: 610 }, { x: ENTRY.x, y: 610 }, ENTRY, EXIT] : [EXIT])
          : [...(state.version===7?conservativeFloorRoute(start,ENTRY,state.config?.motionRouteRevision||1):floorRoute(start, ENTRY)), EXIT];
        const path = [start, ...route].filter((p, i, all) => !i || distance(p, all[i - 1]) > .01);
        const length = path.slice(1).reduce((n, p, i) => n + distance(path[i], p), 0);
        this.departures.set(guest.id, { ...departure, id: `exit-${guest.id}`,
          ...start, visible: true, moving: true, phase: 'leaving', action: 'walking', status: 'visual-departure',
          route: path, path: path.slice(1), distance: 0, length, speed: Math.min(state.version===7?350:700, Math.max(260, length / 1.8)), age: 0 });
      }
      this.previous.set(guest.id, { status: guest.status, visible: guest.visible });
    }
    const exiting = [...this.departures.values()];
    for (const guest of guests) {
      if (!guest.visible && !this.offsets.has(guest.id)) continue;
      const target = queueCrowdOffset(guest, [...guests, ...exiting]);
      const previous = this.offsets.get(guest.id);
      if (!previous) this.offsets.set(guest.id, target);
      else {
        const max = 420 * elapsed, delta = distance(previous, target), fraction = delta > 0 ? Math.min(1, max / delta) : 1;
        this.offsets.set(guest.id, { x: previous.x + (target.x - previous.x) * fraction, y: previous.y + (target.y - previous.y) * fraction });
      }
    }
    for (const [id, guest] of this.departures) {
      guest.age += elapsed; guest.distance += guest.speed * elapsed;
      if (guest.distance >= guest.length) { this.departures.delete(id); continue; }
      let remaining = guest.distance;
      for (let i = 1; i < guest.route.length; i++) {
        const a = guest.route[i - 1], b = guest.route[i], length = distance(a, b);
        if (remaining > length) { remaining -= length; continue; }
        const t = remaining / length;
        guest.x = a.x + (b.x - a.x) * t; guest.y = a.y + (b.y - a.y) * t;
        guest.facing = b.x < a.x ? -1 : 1; guest.target = point(b); guest.path = guest.route.slice(i); break;
      }
    }
    return [...this.departures.values()];
  }
}
