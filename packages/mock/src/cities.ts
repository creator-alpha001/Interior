import type { City, State } from "@repo/types";

export const states: State[] = [
  { id: "state-up", name: "Uttar Pradesh", slug: "uttar-pradesh", isActive: true },
  { id: "state-ka", name: "Karnataka", slug: "karnataka", isActive: true },
  { id: "state-mh", name: "Maharashtra", slug: "maharashtra", isActive: true },
  { id: "state-tg", name: "Telangana", slug: "telangana", isActive: true },
];

/** Districts. See `City` in `@repo/types` for why the name has not changed. */
export const cities: City[] = [
  { id: "city-luc", name: "Lucknow", slug: "lucknow", state: "Uttar Pradesh", stateId: "state-up", isActive: true },
  { id: "city-knp", name: "Kanpur", slug: "kanpur", state: "Uttar Pradesh", stateId: "state-up", isActive: true },
  { id: "city-noi", name: "Noida", slug: "noida", state: "Uttar Pradesh", stateId: "state-up", isActive: true },
  { id: "city-blr", name: "Bengaluru", slug: "bengaluru", state: "Karnataka", stateId: "state-ka", isActive: true },
  { id: "city-pun", name: "Pune", slug: "pune", state: "Maharashtra", stateId: "state-mh", isActive: true },
  { id: "city-hyd", name: "Hyderabad", slug: "hyderabad", state: "Telangana", stateId: "state-tg", isActive: true },
];

export const defaultCityId = "city-luc";
