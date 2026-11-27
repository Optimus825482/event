// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventCard } from "@/features/plan/event-card";
import type { EventCard as EventCardData } from "@/lib/core/contract";
import { FAKE_IMAGES } from "../helpers/fake-core";

afterEach(cleanup);

const base: EventCardData = {
  id: "e1",
  name: "Yılbaşı Galası",
  startsAt: "2027-01-15T18:00:00.000Z",
  endsAt: null,
  artistName: "Demo Sanatçı",
  eventType: null,
  currency: "TRY",
  minPrice: "1500.00",
  saleState: "open",
  coverImage: FAKE_IMAGES.cover,
  artistImage: null,
  isDemo: false,
};

describe("EventCard", () => {
  it("kapak görseli vekil rotadan gelir", () => {
    render(<EventCard event={base} />);
    expect(screen.getByRole("img", { name: "Demo Sanatçı" })).toHaveAttribute(
      "src",
      `/api/gorsel/${FAKE_IMAGES.cover}`,
    );
  });

  it("kapak yoksa sanatçı görseli, o da yoksa metin kartı", () => {
    const { container, rerender } = render(
      <EventCard event={{ ...base, coverImage: null, artistImage: FAKE_IMAGES.artist }} />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", `/api/gorsel/${FAKE_IMAGES.artist}`);
    rerender(<EventCard event={{ ...base, coverImage: null, artistImage: null }} />);
    expect(container.querySelector('[data-variant="text"]')).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("desene uymayan görsel yolu metin kartına düşer", () => {
    const { container } = render(
      <EventCard event={{ ...base, coverImage: "https://evil.example/a.webp", artistImage: null }} />,
    );
    expect(container.querySelector('[data-variant="text"]')).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("tarih, fiyat ve bağlantılar", () => {
    render(<EventCard event={base} />);
    expect(screen.getByText("15 Ocak 2027 Cuma · 20:00")).toBeInTheDocument();
    expect(screen.getByText("Başlangıç: 1.500,00 ₺")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Detaylar" })).toHaveAttribute("href", "/etkinlik/e1");
    expect(screen.getByRole("link", { name: "Bilet Al" })).toHaveAttribute("href", "/etkinlik/e1#bilet-al");
  });

  it("satış açık değilken Bilet Al yoktur, durum yazılır", () => {
    render(<EventCard event={{ ...base, saleState: "not_started" }} />);
    expect(screen.queryByRole("link", { name: "Bilet Al" })).toBeNull();
    expect(screen.getByText("Satış yakında")).toBeInTheDocument();
  });

  it("demo etkinlik DEMO rozeti taşır; gerçek etkinlik taşımaz", () => {
    const { rerender } = render(<EventCard event={{ ...base, isDemo: true }} />);
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    rerender(<EventCard event={{ ...base, isDemo: false }} />);
    expect(screen.queryByText("DEMO")).toBeNull();
  });

  it("başlık düzeyi verilebilir", () => {
    render(<EventCard event={base} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Yılbaşı Galası" })).toBeInTheDocument();
  });
});
