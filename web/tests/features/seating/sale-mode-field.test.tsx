// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaleModeField } from "@/features/seating/components/sale-mode-field";

afterEach(cleanup);

describe("SaleModeField", () => {
  it("iki seçenek etiket ve açıklamasıyla çizilir; değer işaretlidir", () => {
    render(<SaleModeField value="seat" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Satış şekli" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: /Sandalye bazlı/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Masa bazlı/ }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Her masa bütün olarak satılır")).toBeTruthy();
  });

  it("seçim onChange'i yeni kiple çağırır", () => {
    const onChange = vi.fn();
    render(<SaleModeField value="seat" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Masa bazlı/ }));
    expect(onChange).toHaveBeenCalledWith("table");
  });

  it("kilitliyken seçenekler kapalıdır ve kilit notu görünür", () => {
    const onChange = vi.fn();
    render(<SaleModeField value="seat" onChange={onChange} locked />);
    expect((screen.getByRole("radio", { name: /Masa bazlı/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: /Sandalye bazlı/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Satış başladıktan sonra satış şekli değiştirilemez")).toBeTruthy();
  });

  it("kilitsizken kilit notu yoktur", () => {
    render(<SaleModeField value="seat" onChange={() => {}} />);
    expect(screen.queryByText("Satış başladıktan sonra satış şekli değiştirilemez")).toBeNull();
  });
});
