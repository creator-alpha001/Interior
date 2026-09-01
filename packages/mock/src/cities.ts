import type { City } from "@repo/types";

export const cities: City[] = [
  { id: "city-luc", name: "Lucknow", slug: "lucknow", state: "Uttar Pradesh", isActive: true },
  { id: "city-knp", name: "Kanpur", slug: "kanpur", state: "Uttar Pradesh", isActive: true },
  { id: "city-noi", name: "Noida", slug: "noida", state: "Uttar Pradesh", isActive: true },
  { id: "city-blr", name: "Bengaluru", slug: "bengaluru", state: "Karnataka", isActive: true },
  { id: "city-pun", name: "Pune", slug: "pune", state: "Maharashtra", isActive: true },
  { id: "city-hyd", name: "Hyderabad", slug: "hyderabad", state: "Telangana", isActive: true },
];

export const defaultCityId = "city-luc";
