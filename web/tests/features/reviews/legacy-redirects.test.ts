import { describe, expect, it } from "vitest";
import { LEGACY_LEADER_REDIRECTS } from "@/features/reviews/legacy-redirects";

describe("LEGACY_LEADER_REDIRECTS", () => {
  it("eski /leader yolları yeni /fnb/team yollarına kalıcı yönlenir", () => {
    expect(LEGACY_LEADER_REDIRECTS).toEqual([
      { source: "/leader", destination: "/fnb/team", permanent: true },
      { source: "/leader/events", destination: "/fnb/team/events", permanent: true },
      { source: "/leader/events/:eventId", destination: "/fnb/team/events/:eventId", permanent: true },
      { source: "/leader/team", destination: "/fnb/team/members", permanent: true },
      { source: "/leader/team/:staffId", destination: "/fnb/team/members/:staffId", permanent: true },
      { source: "/leader/reviews", destination: "/fnb/team/reviews", permanent: true },
      { source: "/leader/reviews/:eventId", destination: "/fnb/team/reviews/:eventId", permanent: true },
      { source: "/leader/reports", destination: "/fnb/team/reports", permanent: true },
    ]);
  });
});
