/** A bounded, deterministic mix: four short, four medium and four full stays.
 * Each service appears at most once, so the original towel/meal ledger remains
 * exact. A seed rotates only this pattern, never arrival or patience settings. */
const VISITS = Object.freeze([
  ['towel'], ['towel', 'meal'], ['meal', 'towel', 'repair'],
  ['meal'], ['meal', 'towel'], ['towel', 'meal', 'repair'],
  ['towel'], ['meal', 'towel'], ['towel', 'meal', 'repair'],
  ['meal'], ['towel', 'meal'], ['meal', 'towel', 'repair'],
].map(Object.freeze));

export function normalizeVisitSeed(seed) {
  return Number.isSafeInteger(seed) && seed > 0 ? seed : 1;
}

/** Detached read-only itinerary for a zero-based guest ordinal. */
export function visitItinerary(seed = 1, guestIndex = 0) {
  const offset = (normalizeVisitSeed(seed) - 1) % VISITS.length;
  const index = Number.isSafeInteger(guestIndex) && guestIndex >= 0 ? guestIndex % VISITS.length : 0;
  return Object.freeze([...VISITS[(index + offset) % VISITS.length]]);
}

/** UI preview only. Old guests keep their original towel → meal → repair needs. */
export function guestItinerary(guest) {
  return Object.freeze(Array.isArray(guest?.itinerary) ? [...guest.itinerary]
    : ['towel', 'meal', ...(guest?.requiresRepair ? ['repair'] : [])]);
}
