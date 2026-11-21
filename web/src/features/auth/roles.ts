export const ROLES = [
  "admin",
  "organizer",
  "staff",
  "leader",
  "controller",
  "venue_owner",
] as const;

export type Role = (typeof ROLES)[number];
