// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventImage } from "@/components/event-image";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fb = <span data-testid="fb">metin</span>;

describe("EventImage", () => {
  it("yol yoksa yalnızca yedek çizilir", () => {
    render(<EventImage src={null} alt="x" fallback={fb} />);
    expect(screen.getByTestId("fb")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("yol varsa görsel tembel yüklenir", () => {
    render(<EventImage src="/api/gorsel/event/a.webp" alt="Sanatçı" fallback={fb} />);
    expect(screen.getByRole("img", { name: "Sanatçı" })).toHaveAttribute("loading", "lazy");
    expect(screen.queryByTestId("fb")).toBeNull();
  });

  it("öncelikli görsel hemen yüklenir", () => {
    render(<EventImage src="/api/gorsel/event/a.webp" alt="Sanatçı" fallback={fb} priority />);
    expect(screen.getByRole("img", { name: "Sanatçı" })).toHaveAttribute("loading", "eager");
  });

  it("görsel yüklenemezse yedeğe düşer", () => {
    render(<EventImage src="/api/gorsel/event/a.webp" alt="x" fallback={fb} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByTestId("fb")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("hidrasyondan önce kırılmış görsel de yedeğe düşer", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    render(<EventImage src="/api/gorsel/event/a.webp" alt="x" fallback={fb} />);
    expect(await screen.findByTestId("fb")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("sabit görsel verilirse hareketli görsel azaltılmış harekette sabite döner", () => {
    render(
      <EventImage src="/api/gorsel/event/hero.webp" stillSrc="/api/gorsel/event/cover.webp" alt="Sanatçı" fallback={fb} />,
    );
    const img = screen.getByRole("img", { name: "Sanatçı" });
    expect(img).toHaveAttribute("src", "/api/gorsel/event/hero.webp");
    const picture = img.parentElement as HTMLElement;
    expect(picture.tagName).toBe("PICTURE");
    const source = picture.querySelector("source");
    expect(source).toHaveAttribute("media", "(prefers-reduced-motion: reduce)");
    expect(source).toHaveAttribute("srcset", "/api/gorsel/event/cover.webp");
  });

  it("sabit görsel yoksa picture sarmalayıcısı çizilmez", () => {
    render(<EventImage src="/api/gorsel/event/hero.webp" alt="x" fallback={fb} />);
    expect(screen.getByRole("img").parentElement?.tagName).not.toBe("PICTURE");
  });

  it("hareketli görsel yüklenemezse sabit görsele düşer", () => {
    render(
      <EventImage src="/api/gorsel/event/hero.webp" stillSrc="/api/gorsel/event/cover.webp" alt="x" fallback={fb} />,
    );
    fireEvent.error(screen.getByRole("img"));
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/gorsel/event/cover.webp");
    expect(img.parentElement?.tagName).not.toBe("PICTURE");
    fireEvent.error(img);
    expect(screen.getByTestId("fb")).toBeInTheDocument();
  });
});
