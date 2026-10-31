/** Hotel content. Pure catalogs/derivations; never advance a shift or book a receipt. */
import { normalizeVisitSeed, visitItinerary } from './hotel-visits.mjs';
const freeze = values => Object.freeze(values.map(value => Object.freeze(value)));
export const ROOM_TIERS = freeze([
  { id: 0, key: 'regular', name: 'Regular', capacity: 1, price: 40 },
  { id: 1, key: 'luxury', name: 'Luxury', capacity: 1, price: 55 },
  { id: 2, key: 'family', name: 'Family', capacity: 2, price: 70 },
]);
export const RECIPES = freeze([
  { id: 'garden', name: 'Garden breakfast', ingredients: Object.freeze(['toast', 'egg', 'apple']), icon: 'garden' },
  { id: 'tea', name: 'Tea tray', ingredients: Object.freeze(['croissant', 'tea', 'jam']), icon: 'tea' },
  { id: 'pancake', name: 'Pancake breakfast', ingredients: Object.freeze(['pancakes', 'banana', 'milk']), icon: 'pancake' },
]);
/** Restaurant upgrades are sequential, but every earned recipe remains selectable.
 * Typical successful shifts net 350–550 coins. Higher cuisines take roughly one
 * or two shifts to fund; their small actual-service bonus is not a passive grant.
 * Ramen keeps its existing facility unlock, price and payment rules. */
export const CUISINES = freeze([
  { id: 'ramen', name: 'Ramen restaurant', tier: 1, price: 300, activity: 'ramen', icon: 'ramen', reward: 0, requiredShifts: 1 },
  { id: 'sushi', name: 'Sushi restaurant', tier: 2, price: 350, activity: 'sushi', icon: 'sushi', reward: 3, requiredShifts: 2 },
  { id: 'stirfry', name: 'Chinese restaurant', tier: 3, price: 450, activity: 'stirfry', icon: 'stirfry', reward: 5, requiredShifts: 3 },
  { id: 'crepe', name: 'French crêperie', tier: 4, price: 550, activity: 'crepe', icon: 'crepe', reward: 7, requiredShifts: 4 },
  { id: 'pasta', name: 'Italian restaurant', tier: 5, price: 650, activity: 'pasta', icon: 'pasta', reward: 9, requiredShifts: 5 },
  { id: 'pizza', name: 'Pizzeria', tier: 6, price: 750, activity: 'pizza', icon: 'pizza', reward: 12, requiredShifts: 6 },
]);
export const CUISINE_IDS = Object.freeze(CUISINES.map(c => c.id));
export const cuisineById = id => CUISINES.find(c => c.id === id) ?? null;
export const isCuisine = id => CUISINE_IDS.includes(id);
/** Separate catalogs keep the exact v1–v5 facility/save shape unchanged. */
export const LEISURE_VENUES = freeze([
  { id: 'lounge', name: 'Music lounge', floor: 4, x: 285, y: -2380, activity: 'lounge', icon: 'lounge', price: 800, requiredShifts: 7, reward: 8 },
  { id: 'theater', name: 'Theater', floor: 4, x: 770, y: -2350, activity: 'theater', icon: 'theater', price: 950, requiredShifts: 9, reward: 12 },
]);
export const LEISURE_IDS = Object.freeze(LEISURE_VENUES.map(venue => venue.id));
export const leisureById = id => LEISURE_VENUES.find(venue => venue.id === id) ?? null;
export const isLeisure = id => LEISURE_IDS.includes(id);
export const PERFORMERS = freeze([
  { id: 'hedgehog', name: 'Hazel', role: 'House musician', level: 0, duration: 3.5, reward: 0, price: 0, requiredShifts: 7 },
  { id: 'deer', name: 'Celeste', role: 'Star singer', level: 1, duration: 2.8, reward: 6, price: 450, requiredShifts: 10 },
]);
export const performerForLevel = level => PERFORMERS[level === 1 ? 1 : 0];
export const performerForVenue = (venueId, level) => performerForLevel(venueId === 'theater' ? level : 0);
export const normalizeLeisure = leisure => ({ lounge: leisure?.lounge === 1 ? 1 : 0,
  theater: leisure?.lounge === 1 && leisure?.theater === 1 ? 1 : 0 });
export const FACILITIES = freeze([
  { id: 'restaurant', name: 'Ramen restaurant', floor: 3, x: 240, y: -1850, activity: 'ramen', icon: 'restaurant' },
  { id: 'salon', name: 'Salon', floor: 3, x: 530, y: -1850, activity: 'salon', icon: 'salon' },
  { id: 'spa', name: 'Massage spa', floor: 3, x: 820, y: -1850, activity: 'spa', icon: 'spa' },
]);
export const CUSTOMER_TYPES = freeze([
  { id: 'traveler', name: 'Traveler', spriteKind: 'guest', partySize: 1, preferredRoomTier: 0 },
  { id: 'gourmet', name: 'Gourmet', spriteKind: 'cat', partySize: 1, preferredRoomTier: 1 },
  { id: 'family', name: 'Family', spriteKind: 'family', partySize: 2, preferredRoomTier: 2 },
]);
export const FACILITY_IDS = Object.freeze(FACILITIES.map(f => f.id));
export const RECIPE_IDS = Object.freeze(RECIPES.map(r => r.id));
export const isFacility = id => FACILITY_IDS.includes(id);
export const isRecipe = id => RECIPE_IDS.includes(id);
export const roomCapacity = tier => tier === 2 ? 2 : 1;
export const normalizeRoomTiers = tiers => Array.from({ length: 6 }, (_, i) => [0, 1, 2].includes(tiers?.[i]) ? tiers[i] : 0);
export const normalizeFacilities = facilities => Object.fromEntries(FACILITY_IDS.map(id => [id, facilities?.[id] === 1 ? 1 : 0]));
export function guestContent(config, guestIndex = 0) {
  if(config.firstStepsRules===1)return {customerType:CUSTOMER_TYPES[0].id,spriteKind:CUSTOMER_TYPES[0].spriteKind,partySize:1,preferredRoomTier:0,roomPreferenceAvailable:true,preferredRecipe:'garden'};
  const seed = normalizeVisitSeed(config.visitSeed), ordinal = (seed - 1 + guestIndex) % 12;
  const supply=config.roomSupplyAtStart||config;
  const tiers = normalizeRoomTiers(supply.roomTiers).slice(0, supply.openRooms ?? 3);
  const familyAvailable = tiers.includes(2);
  const type = ordinal % 3 === 1 ? CUSTOMER_TYPES[1] : ordinal % 3 === 2 && familyAvailable ? CUSTOMER_TYPES[2] : CUSTOMER_TYPES[0];
  return { customerType: type.id, spriteKind: type.spriteKind, partySize: type.partySize,
    preferredRoomTier: type.preferredRoomTier, roomPreferenceAvailable: tiers.includes(type.preferredRoomTier),
    preferredRecipe: RECIPE_IDS[ordinal % RECIPE_IDS.length] };
}
/** Replace one existing stage for every other guest, never add chores to a stay. */
export function contentItinerary(config, guestIndex = 0) {
  if(config.firstStepsRules===1)return Object.freeze(['towel']);
  if(config.firstStepsRules===2)return Object.freeze(guestIndex===1?['towel','meal']:['towel']);
  const itinerary = [...visitItinerary(config.visitSeed, guestIndex)];
  const unlocked = FACILITY_IDS.filter(id => config.facilities?.[id] === 1);
  const ordinal = (normalizeVisitSeed(config.visitSeed) - 1 + guestIndex) % 12;
  if (unlocked.length && ordinal % 2 === 1) {
    const facility = unlocked[Math.floor(ordinal / 2) % unlocked.length];
    // Restaurant replaces hunger when present. Other facilities use the last
    // existing task, keeping the number and order of the remaining requests.
    const stage = facility === 'restaurant' && itinerary.includes('meal') ? itinerary.indexOf('meal') : itinerary.length - 1;
    itinerary[stage] = facility;
  }
  return Object.freeze(itinerary);
}
/** v6 replaces the same optional stage, never lengthens a visit or changes pace. */
export function leisureItinerary(config, guestIndex = 0) {
  const itinerary = [...contentItinerary(config, guestIndex)];
  const owned = LEISURE_IDS.filter(id => config.leisure?.[id] === 1);
  const ordinal = (normalizeVisitSeed(config.visitSeed) - 1 + guestIndex) % 12;
  // Alternate the new experiences with the existing earned facilities. The
  // original ordinal-odd slot was optional before leisure, and stays optional.
  if (owned.length && ordinal % 4 === 3) {
    const replaced = itinerary.findIndex(isFacility);
    itinerary[replaced < 0 ? itinerary.length - 1 : replaced] = owned[Math.floor(ordinal / 4) % owned.length];
  }
  return Object.freeze(itinerary);
}
export function roomMatchesGuest(guest, room) {
  return !!guest && !!room && roomCapacity(room.tier ?? 0) >= (guest.partySize ?? 1);
}
/** Only actual delivered meals and completed check-in earn preferences. */
export function contentPayment(guest) {
  if (!guest.roomProof) return 0;
  const roomBonus = guest.roomPreferenceAvailable && guest.roomProof.tier === guest.preferredRoomTier ? 5 : 0;
  const mealBonus = guest.deliveredRecipes?.includes(guest.preferredRecipe) ? 5 : 0;
  // v4 proofs have no cuisine. Buying/selecting a venue never earns a receipt.
  const cuisineBonus = cuisineById(guest.serviceProof?.find(entry => entry.kind === 'restaurant')?.cuisine)?.reward ?? 0;
  const leisureBonus = (guest.serviceProof ?? []).reduce((total, proof) => total +
    (isLeisure(proof.kind) && ['hedgehog', 'deer'].includes(proof.performer)
      ? leisureById(proof.kind).reward + PERFORMERS.find(performer => performer.id === proof.performer).reward : 0), 0);
  return 40 + 15 * guest.roomProof.tier + (guest.partySize === 2 ? 10 : 0)
    + (guest.tipEligible ? 10 : 0) + roomBonus + mealBonus + cuisineBonus + leisureBonus;
}
/** No preview stars: a review exists only after an actual feedback-box drop.
 * Every icon/phrase is explained by service proof, room fit, and retained tip. */
export function deriveGuestReview(guest) {
  if (!guest || guest.reviewDropped !== true || !guest.paid && !guest.abandoned) return null;
  const proof = Array.isArray(guest.serviceProof) ? guest.serviceProof : [];
  if (guest.abandoned && (!guest.roomProof || !proof.length)) return null;
  if (guest.abandoned) return { stars: proof.length ? 2 : 1, icons: proof.length ? ['service', 'wait'] : ['wait'],
    phrase: proof.length ? 'Some help, but the wait was too long.' : 'I waited too long.' };
  if (!guest.served || !guest.roomProof || !Array.isArray(guest.itinerary)
    || proof.length !== guest.itinerary.length || !proof.every((entry, i) => entry.kind === guest.itinerary[i])) return null;
  const matchedRoom = guest.roomPreferenceAvailable && guest.roomProof.tier === guest.preferredRoomTier;
  const favoriteMeal = guest.deliveredRecipes?.includes(guest.preferredRecipe);
  const icons = ['service'];
  if (guest.tipEligible) icons.push('heart');
  if (matchedRoom) icons.push('room');
  if (favoriteMeal) icons.push(guest.preferredRecipe);
  for (const entry of proof) if (isFacility(entry.kind) || isLeisure(entry.kind)) {
    icons.push(entry.kind);
    if (entry.kind === 'restaurant' && isCuisine(entry.cuisine)) icons.push(cuisineById(entry.cuisine).icon);
    if (isLeisure(entry.kind) && entry.performer === 'deer') icons.push('star');
  }
  return { stars: guest.tipEligible ? 5 : 4, icons,
    phrase: favoriteMeal ? 'My favorite meal, made for me!' : matchedRoom ? 'Just the room I hoped for!'
      : proof.some(entry => isLeisure(entry.kind)) ? 'What a lovely performance!'
      : proof.some(entry => isFacility(entry.kind)) ? 'A lovely little extra during my stay.'
        : guest.tipEligible ? 'Everything arrived with a smile.' : 'Thank you for taking care of my stay.' };
}
