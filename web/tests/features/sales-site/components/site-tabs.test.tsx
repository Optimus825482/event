// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteTabs } from "@/features/sales-site/components/site-tabs";
import { parseSiteTab } from "@/features/sales-site/tabs";

afterEach(cleanup);

describe("SiteTabs ve parseSiteTab", () => {
  it("sipariş yetkisi yokken Siparişler bağlantısı çizilmez", () => {
    render(<SiteTabs eventId="ev-1" active="icerik" canSeeOrders={false} />);
    expect(screen.getByRole("link", { name: "Site içeriği" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "Siparişler" })).toBeNull();
  });

  it("sipariş yetkisi varken iki sekme çizilir", () => {
    render(<SiteTabs eventId="ev-1" active="siparisler" canSeeOrders={true} />);
    expect(screen.getByRole("link", { name: "Site içeriği" }).getAttribute("href")).toBe("/sales-site/ev-1");
    expect(screen.getByRole("link", { name: "Siparişler" }).getAttribute("aria-current")).toBe("page");
  });

  it.each([
    ["siparisler", true, "siparisler"],
    ["siparisler", false, "icerik"],
    [undefined, true, "icerik"],
    ["x", true, "icerik"],
    [["siparisler", "icerik"], true, "icerik"],
  ] as const)("parseSiteTab(%o, %s) = %s", (raw, can, out) => {
    expect(parseSiteTab(raw, can)).toBe(out);
  });
});
