import { describe, expect, it } from "vitest";
import { FIND_TABLE_METADATA } from "@/features/find-table/page-meta";
import { GET } from "@/app/masam/limited/route";

describe("/masam/limited", () => {
  it("429, Retry-After ve no-store döner", () => {
    const res = GET(new Request("http://localhost/masam/limited?r=120"));
    expect([res.status, res.headers.get("retry-after"), res.headers.get("cache-control")]).toEqual([429, "120", "no-store"]);
  });
  it("bozuk r değeri 60 sn sayılır", () => {
    expect(GET(new Request("http://localhost/masam/limited?r=abc")).headers.get("retry-after")).toBe("60");
  });
  it("sayfa üst verisi arama motoruna ve yönlendirene kapalıdır", () =>
    expect(FIND_TABLE_METADATA).toMatchObject({ robots: { index: false, follow: false }, referrer: "no-referrer" }));
});
