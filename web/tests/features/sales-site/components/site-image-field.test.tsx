// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/sales-site/actions", () => ({
  uploadSiteImageAction: vi.fn(),
  removeSiteImageAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { SiteImageField } from "@/features/sales-site/components/site-image-field";

afterEach(cleanup);

const EVENT = "11111111-1111-4111-8111-111111111111";
const WEBP = "event/00000000-0000-4000-8000-000000000001.webp";
const WEBM = "event/00000000-0000-4000-8000-000000000002.webm";

describe("SiteImageField", () => {
  it("hero alanı WebM videoyu da kabul eder ve yardım metninde söyler", () => {
    render(<SiteImageField eventId={EVENT} slot="hero" path={null} canEdit />);
    const input = screen.getByLabelText("Hero görseli yükle");
    expect(input.getAttribute("accept")).toBe("image/jpeg,image/png,image/webp,video/webm");
    expect(screen.getByText("JPG, PNG, WebP veya WebM video, en fazla 5 MB görsel / 8 MB video")).toBeTruthy();
  });

  it.each(["cover", "artist"] as const)("%s alanı yalnızca görüntü kabul eder", (slot) => {
    render(<SiteImageField eventId={EVENT} slot={slot} path={null} canEdit />);
    const input = screen.getByLabelText(/görseli yükle$/);
    expect(input.getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    expect(screen.getByText("JPG, PNG veya WebP, en fazla 5 MB")).toBeTruthy();
  });

  it("hero WebM ise önizleme sessiz, döngülü video olarak çizilir", () => {
    const { container } = render(<SiteImageField eventId={EVENT} slot="hero" path={WEBM} canEdit={false} />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.getAttribute("src")).toBe(`/api/uploads/${WEBM}`);
    expect(video!.getAttribute("aria-label")).toBe("Hero görseli");
    expect(video!.muted).toBe(true);
    expect(video!.loop).toBe(true);
    expect(container.querySelector("img")).toBeNull();
  });

  it("WebP önizlemesi görsel olarak çizilir", () => {
    render(<SiteImageField eventId={EVENT} slot="hero" path={WEBP} canEdit={false} />);
    expect(screen.getByRole("img", { name: "Hero görseli" }).getAttribute("src")).toBe(`/api/uploads/${WEBP}`);
  });
});
