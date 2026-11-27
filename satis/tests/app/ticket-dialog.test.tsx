// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { openTicketDialog, salonPath, TicketDialog, ticketDialogNoscriptCss } from "@/components/event/ticket-dialog";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const props = { eventId: "e1", eyebrow: "LEVENT YÜKSEL · 12 ARALIK 2026", maxSeatsPerOrder: 12 };

function dialog() {
  return screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
}

describe("TicketDialog", () => {
  it("Bilet Al pencereyi açar; başlık 'Kişi sayısı', üstte sanatçı · tarih, yardım metni", () => {
    render(<TicketDialog {...props} />);
    expect(dialog()).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("link", { name: "Bilet Al" }));
    const d = screen.getByRole("dialog", { name: "Kişi sayısı" });
    expect(d).toHaveAttribute("open");
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(within(d).getByText("LEVENT YÜKSEL · 12 ARALIK 2026")).toBeInTheDocument();
    expect(within(d).getByRole("heading", { level: 2, name: "Kişi sayısı" })).toBeInTheDocument();
    expect(
      within(d).getByText("Kişi sayısına uygun masalar gösterilir. Müsait localar bütün olarak rezerve edilir."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Kaç kişisiniz?")).toBeNull();
  });

  it("form JS'siz GET ile masa seçimine gider; seçim adı kisi, 1..max seçenek '2 kişi' biçiminde", () => {
    render(<TicketDialog {...props} />);
    const form = dialog().querySelector("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/etkinlik/e1/salon");
    const select = within(dialog()).getByRole("combobox", { name: "Kişi sayısı", hidden: true }) as HTMLSelectElement;
    expect(select.name).toBe("kisi");
    expect(Array.from(select.options).map((o) => [o.value, o.text])).toEqual(
      Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1} kişi`]),
    );
    expect(within(dialog()).getByRole("button", { name: "Masa seçimine geç →", hidden: true })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("varsayılan 2 kişi; seçili değer korunur; sınır üstü değer en büyük seçeneğe iner", () => {
    const value = () =>
      (within(dialog()).getByRole("combobox", { name: "Kişi sayısı", hidden: true }) as HTMLSelectElement).value;
    const { rerender } = render(<TicketDialog {...props} />);
    expect(value()).toBe("2");
    rerender(<TicketDialog {...props} selected={5} />);
    expect(value()).toBe("5");
    rerender(<TicketDialog {...props} maxSeatsPerOrder={1} />);
    expect(value()).toBe("1");
  });

  it("seçenekler maxSeatsPerOrder'ı aşmaz", () => {
    render(<TicketDialog {...props} maxSeatsPerOrder={4} />);
    expect(within(dialog()).getAllByRole("option", { hidden: true })).toHaveLength(4);
  });

  it("kapat düğmesi ve Esc pencereyi kapatır", () => {
    render(<TicketDialog {...props} />);
    fireEvent.click(screen.getByRole("link", { name: "Bilet Al" }));
    fireEvent.click(screen.getByRole("button", { name: "Pencereyi kapat" }));
    expect(dialog()).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("link", { name: "Bilet Al" }));
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(dialog()).not.toHaveAttribute("open");
  });

  it("açılınca odak kişi sayısı seçimine gelir", () => {
    render(<TicketDialog {...props} />);
    fireEvent.click(screen.getByRole("link", { name: "Bilet Al" }));
    expect(screen.getByRole("combobox", { name: "Kişi sayısı" })).toHaveFocus();
  });

  it("#bilet-al adresiyle gelinince ve openTicketDialog ile (üst menü) açılır", () => {
    window.history.replaceState(null, "", "/etkinlik/e1#bilet-al");
    const { unmount } = render(<TicketDialog {...props} />);
    expect(dialog()).toHaveAttribute("open");
    unmount();

    window.history.replaceState(null, "", "/etkinlik/e1");
    expect(openTicketDialog()).toBe(false);
    render(<TicketDialog {...props} />);
    expect(dialog()).not.toHaveAttribute("open");
    let opened = false;
    act(() => {
      opened = openTicketDialog();
    });
    expect(opened).toBe(true);
    expect(dialog()).toHaveAttribute("open");
  });

  it("JS kapalı yedeği: :target kuralı CSP nonce'unu taşır; nonce kaçışsız öznitelik üretemez", () => {
    expect(ticketDialogNoscriptCss("abc+/=")).toMatch(/^<style nonce="abc\+\/=">dialog#bilet-al:target\{display:block/);
    expect(ticketDialogNoscriptCss('x" onload="y')).toContain('nonce="xonload=y"');
    expect(ticketDialogNoscriptCss(null)).toMatch(/^<style>/);
    expect(salonPath("e1")).toBe("/etkinlik/e1/salon");
  });
});
