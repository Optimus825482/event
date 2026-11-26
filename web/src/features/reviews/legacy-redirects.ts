/**
 * Eski `/leader/*` yolları (F&B ekip modülünün `/fnb/team` altına taşınmadan önceki adresleri).
 * `next.config.ts` bunları kalıcı (308) yönlendirme olarak kaydeder; yer imleri ve eski bağlantılar çalışmaya devam eder.
 */
export const LEGACY_LEADER_REDIRECTS: readonly { source: string; destination: string; permanent: true }[] = [
  { source: "/leader", destination: "/fnb/team", permanent: true },
  { source: "/leader/events", destination: "/fnb/team/events", permanent: true },
  { source: "/leader/events/:eventId", destination: "/fnb/team/events/:eventId", permanent: true },
  { source: "/leader/team", destination: "/fnb/team/members", permanent: true },
  { source: "/leader/team/:staffId", destination: "/fnb/team/members/:staffId", permanent: true },
  { source: "/leader/reviews", destination: "/fnb/team/reviews", permanent: true },
  { source: "/leader/reviews/:eventId", destination: "/fnb/team/reviews/:eventId", permanent: true },
  { source: "/leader/reports", destination: "/fnb/team/reports", permanent: true },
];
