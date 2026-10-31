/** Shared physical hotel coordinates. Each floor is one 1200 × 700 viewport. */
export const FLOOR_HEIGHT = 700;
export const MAX_FLOOR = 4;
export const HALLWAY_Y = 300;
export const STAIR_LOWER = Object.freeze({ x: 1010, y: 530 });
export const STAIR_UPPER = Object.freeze({ x: 1110, y: 600 });
export const floorOf = p => Math.max(0, Math.min(MAX_FLOOR, Math.ceil(-p.y / FLOOR_HEIGHT)));
export const toFloorPoint = (p, floor = floorOf(p)) => ({ x: p.x, y: p.y + floor * FLOOR_HEIGHT });
export const toWorldPoint = (p, floor) => ({ x: p.x, y: p.y - floor * FLOOR_HEIGHT });
export const ROOM_LAYOUT = Object.freeze(Array.from({ length: 6 }, (_, i) => Object.freeze({
  id: `room-${i + 1}`, name: `Room ${i + 1}`, floor: 1 + Math.floor(i / 3),
  ...toWorldPoint({ x: [240, 530, 820][i % 3], y: 250 }, 1 + Math.floor(i / 3)),
})));
export const stairFlight = lowerFloor => ({
  lower: toWorldPoint(STAIR_LOWER, lowerFloor),
  upper: toWorldPoint(STAIR_UPPER, lowerFloor + 1),
  lowerFloor, upperFloor: lowerFloor + 1,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** Only points on a real diagonal flight count as being on stairs. */
export function stairAt(p) {
  for (let floor = 0; floor < MAX_FLOOR; floor++) {
    const flight = stairFlight(floor), { lower, upper } = flight;
    const dx = upper.x - lower.x, dy = upper.y - lower.y;
    const t = ((p.x - lower.x) * dx + (p.y - lower.y) * dy) / (dx * dx + dy * dy);
    if (t > 1e-7 && t < 1 - 1e-7 && distance(p, { x: lower.x + t * dx, y: lower.y + t * dy }) < .1)
      return { ...flight, progress: t };
  }
  return null;
}
/** Walk to hallways and landings, then the continuous diagonal stair flights.
 * A worker redirected mid-flight must finish/reverse that flight, never cut
 * sideways into a different floor. Routes never alter an actor's position.
 */
export function floorRoute(origin, destination) {
  const points = [], targetFloor = floorOf(destination);
  let current = { x: origin.x, y: origin.y }, currentFloor = floorOf(origin);
  const push = p => { if (distance(current, p) > .01) { current = { x: p.x, y: p.y }; points.push(current); } };
  const hallTo = (p, floor) => {
    const y = HALLWAY_Y - floor * FLOOR_HEIGHT;
    push({ x: current.x, y }); push({ x: p.x, y }); push(p);
  };
  const flight = stairAt(origin);
  if (flight) {
    const up = targetFloor >= flight.upperFloor;
    push(up ? flight.upper : flight.lower);
    currentFloor = up ? flight.upperFloor : flight.lowerFloor;
  }
  while (currentFloor < targetFloor) {
    const next = stairFlight(currentFloor);
    // At an upper landing, the short connector stays in the stairwell.
    if (current.x >= STAIR_LOWER.x && toFloorPoint(current, currentFloor).y >= STAIR_LOWER.y)
      push(next.lower);
    else hallTo(next.lower, currentFloor);
    push(next.upper); currentFloor += 1;
  }
  while (currentFloor > targetFloor) {
    const next = stairFlight(currentFloor - 1);
    if (current.x >= STAIR_LOWER.x && toFloorPoint(current, currentFloor).y >= STAIR_LOWER.y)
      push(next.upper);
    else hallTo(next.upper, currentFloor);
    push(next.lower); currentFloor -= 1;
  }
  hallTo(destination, targetFloor);
  return points;
}
