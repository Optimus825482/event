// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartySizeField } from "@/features/plan/party-step";

afterEach(cleanup);

describe("PartySizeField", () => {
  it("1..max seçenek sunar ve değişikliği sayı olarak bildirir", () => {
    const onChange = vi.fn();
    render(<PartySizeField value={2} max={8} onChange={onChange} />);
    const select = screen.getByLabelText("Kişi sayısı") as HTMLSelectElement;
    expect(select.options).toHaveLength(8);
    expect(select.value).toBe("2");
    fireEvent.change(select, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
