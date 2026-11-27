// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/sales-site/actions", () => ({
  uploadSiteImageAction: vi.fn(),
  removeSiteImageAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { uploadSiteImageAction } from "@/features/sales-site/actions";
import { SiteImageField } from "@/features/sales-site/components/site-image-field";

afterEach(cleanup);

const EVENT = "11111111-1111-4111-8111-111111111111";
const WEBP = "event/00000000-0000-4000-8000-000000000001.webp";
const WEBM = "event/00000000-0000-4000-8000-000000000002.webm";

describe("SiteImageField", () => {
  it("hero alanı WebM/MP4/MOV videoyu da kabul eder ve yardım metninde söyler", () => {
    render(<SiteImageField eventId={EVENT} slot="hero" path={null} canEdit />);
    const input = screen.getByLabelText("Hero görseli yükle");
    expect(input.getAttribute("accept")).toBe("image/jpeg,image/png,image/webp,video/webm,video/mp4,video/quicktime");
    expect(
      screen.getByText(
        "JPG, PNG, WebP görsel (en fazla 5 MB) ya da WebM/MP4/MOV video (en fazla 50 MB, 60 sn; otomatik sıkıştırılır)",
      ),
    ).toBeTruthy();
  });

  it("video yüklenirken 'Video sıkıştırılıyor…' durumu gösterilir, bitince kalkar", async () => {
    let finish!: (v: { ok: true; data: unknown }) => void;
    vi.mocked(uploadSiteImageAction).mockReturnValueOnce(new Promise((r) => (finish = r)) as never);
    render(<SiteImageField eventId={EVENT} slot="hero" path={null} canEdit />);
    const input = screen.getByLabelText("Hero görseli yükle");
    fireEvent.change(input, { target: { files: [new File(["x"], "a.mp4", { type: "video/mp4" })] } });
    expect((await screen.findByRole("status")).textContent).toBe("Video sıkıştırılıyor…");
    await act(async () => finish({ ok: true, data: {} }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("görsel yüklenirken sıkıştırma durumu gösterilmez", async () => {
    vi.mocked(uploadSiteImageAction).mockReturnValueOnce(new Promise(() => undefined) as never);
    render(<SiteImageField eventId={EVENT} slot="hero" path={null} canEdit />);
    fireEvent.change(screen.getByLabelText("Hero görseli yükle"), {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadSiteImageAction).toHaveBeenCalled());
    expect(screen.queryByText("Video sıkıştırılıyor…")).toBeNull();
  });

  it("50 MB üstü video sunucuya gönderilmeden reddedilir", () => {
    vi.mocked(uploadSiteImageAction).mockClear();
    render(<SiteImageField eventId={EVENT} slot="hero" path={null} canEdit />);
    const big = new File(["x"], "b.mov", { type: "video/quicktime" });
    Object.defineProperty(big, "size", { value: 50 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText("Hero görseli yükle"), { target: { files: [big] } });
    expect(screen.getByRole("alert").textContent).toBe("Video boyutu en fazla 50 MB olabilir");
    expect(uploadSiteImageAction).not.toHaveBeenCalled();
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
