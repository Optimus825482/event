// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PartyPicker } from "@/components/event/party-picker";

afterEach(cleanup);

describe("PartyPicker", () => {
  it("form JS'siz GET ile masa seçimine gider", () => {
    render(<PartyPicker eventId="e1" maxSeatsPerOrder={12} />);
    const form = document.getElementById("bilet-al") as HTMLFormElement;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/etkinlik/e1#masa-secimi");
    expect(screen.getByRole("group", { name: "Kaç kişilik bilet alacaksınız?" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("radio").map((r) => [r.getAttribute("name"), (r as HTMLInputElement).value]),
    ).toEqual(Array.from({ length: 12 }, (_, i) => ["kisi", String(i + 1)]));
    expect(screen.getByRole("button", { name: "Masa Seçimine Geç →" })).toHaveAttribute("type", "submit");
  });

  it("varsayılan 2 kişi; seçili değer korunur; sınır üstü seçili değer en büyük seçeneğe iner", () => {
    const { rerender } = render(<PartyPicker eventId="e1" maxSeatsPerOrder={12} />);
    expect(screen.getByRole("radio", { name: "2 Kişi" })).toBeChecked();
    rerender(<PartyPicker eventId="e1" maxSeatsPerOrder={12} selected={5} />);
    expect(screen.getByRole("radio", { name: "5 Kişi" })).toBeChecked();
    rerender(<PartyPicker eventId="e1" maxSeatsPerOrder={1} />);
    expect(screen.getByRole("radio", { name: "1 Kişi" })).toBeChecked();
  });

  it("seçenekler maxSeatsPerOrder'ı aşmaz", () => {
    render(<PartyPicker eventId="e1" maxSeatsPerOrder={4} />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });
});
