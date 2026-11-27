// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckInFeedbackBanner } from "@/features/check-in/components/check-in-feedback";

vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => <a {...props} /> }));

afterEach(cleanup);

const batch = { kind: "batch", tally: { checkedIn: 2, already: 0, failed: 0, queued: 0 } } as const;

describe("check-in sonuç bandı odağı", () => {
  it("toplu gönderim bitince odak banta taşınır (gövdeye düşmez)", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    const { rerender } = render(<CheckInFeedbackBanner feedback={null} onClose={() => undefined} />);
    // Toplu gönderim düğmesi kaybolur: odak gövdeye düşer.
    button.remove();
    rerender(<CheckInFeedbackBanner feedback={batch} onClose={() => undefined} />);
    const banner = screen.getByTestId("check-in-feedback");
    expect(banner.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(banner);
  });

  it("tekil sonuçta odak başka bir öğedeyse yerinde kalır", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    render(<CheckInFeedbackBanner feedback={{ kind: "error", code: "error", message: "x" }} onClose={() => undefined} />);
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it("başarı bandı masa ve sandalyeyi gösterir", () => {
    render(
      <CheckInFeedbackBanner
        feedback={{
          kind: "success",
          result: {
            outcome: "checked_in",
            kind: "ticket",
            reservationId: null,
            ticketId: "t1",
            pnr: "ABCD2345",
            gate: null,
            seatNo: 5,
            eventId: "e1",
            guestName: "Deniz Yılmaz",
            guestCount: 1,
            tableId: "b1",
            tableLabel: "B1",
            checkedInAt: "2026-11-26T18:00:00.000Z",
            checkedInBy: null,
          },
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Masa B1 · Sandalye 5")).toBeTruthy();
  });

  it("seatNo null iken bant yalnızca masayı gösterir", () => {
    render(
      <CheckInFeedbackBanner
        feedback={{
          kind: "success",
          result: {
            outcome: "checked_in",
            kind: "ticket",
            reservationId: null,
            ticketId: "t1",
            pnr: "ABCD2345",
            gate: null,
            seatNo: null,
            eventId: "e1",
            guestName: "Deniz Yılmaz",
            guestCount: 1,
            tableId: "b1",
            tableLabel: "B1",
            checkedInAt: "2026-11-26T18:00:00.000Z",
            checkedInBy: null,
          },
        }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText("Masa B1")).toBeTruthy();
    expect(screen.queryByText(/Sandalye/)).toBeNull();
  });
});
