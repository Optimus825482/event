// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartySizeField, PartyStep } from "@/features/plan/party-step";

afterEach(cleanup);

describe("PartyStep", () => {
  it("1..max seçenek sunar, varsayılanı seçili getirir ve gönderince sayıyı bildirir", () => {
    const onConfirm = vi.fn();
    render(<PartyStep max={8} initial={2} onConfirm={onConfirm} />);
    const select = screen.getByLabelText("Kaç kişisiniz?") as HTMLSelectElement;
    expect(select.options).toHaveLength(8);
    expect(select.value).toBe("2");
    fireEvent.submit(select.closest("form")!);
    expect(onConfirm).toHaveBeenCalledWith(2);
  });

  it("PartySizeField değişikliği sayı olarak bildirir", () => {
    const onChange = vi.fn();
    render(<PartySizeField value={2} max={8} onChange={onChange} />);
    const select = screen.getByLabelText("Kişi sayısı") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
