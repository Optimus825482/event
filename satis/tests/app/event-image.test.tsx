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
});
