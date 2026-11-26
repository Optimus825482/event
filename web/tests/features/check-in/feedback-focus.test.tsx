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
});
