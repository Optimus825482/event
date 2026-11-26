/** F&B ekip modülü rota sözlüğü (eski `/leader/*` yolları buraya yönlenir). */
export const REVIEW_ROUTES = {
  home: "/fnb/team",
  events: "/fnb/team/events",
  event: (eventId: string) => `/fnb/team/events/${eventId}`,
  members: "/fnb/team/members",
  member: (staffId: string) => `/fnb/team/members/${staffId}`,
  reviews: "/fnb/team/reviews",
  reviewBoard: (eventId: string) => `/fnb/team/reviews/${eventId}`,
  reports: "/fnb/team/reports",
} as const;
