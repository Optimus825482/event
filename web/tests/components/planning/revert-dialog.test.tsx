// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevertDialog } from "@/features/planning/components/revert-dialog";

afterEach(cleanup);

describe("RevertDialog", () => {
  it("üst bileşen kodla kapatıp yeniden açınca yazılan neden temizlenir", () => {
    const props = { onOpenChange: vi.fn(), pending: false, onSubmit: vi.fn() };
    const { rerender } = render(<RevertDialog open {...props} />);
    fireEvent.change(screen.getByLabelText("Neden"), { target: { value: "Eski neden" } });
    expect((screen.getByLabelText("Neden") as HTMLTextAreaElement).value).toBe("Eski neden");

    rerender(<RevertDialog open={false} {...props} />);
    rerender(<RevertDialog open {...props} />);

    expect((screen.getByLabelText("Neden") as HTMLTextAreaElement).value).toBe("");
  });
});
