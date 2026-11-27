// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGHTLINE_CAPTION } from "@/features/plan/sightline";
import { SightlinePanel } from "@/features/plan/sightline-panel";

afterEach(cleanup);

describe("SightlinePanel", () => {
  it("etiket kurala uyuyorsa fotoğraf, masa başlığı ve temsili görünüm etiketi gösterilir; 3B'de masadan bak da sunulur", () => {
    const onLookIn3d = vi.fn();
    render(<SightlinePanel set="diamond" table={{ label: "M-12", isLoca: false }} canLookIn3d onLookIn3d={onLookIn3d} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/sightline/diamond/M-12.webp");
    expect(img.getAttribute("alt")).toContain("Masa M-12");
    expect(screen.getByText("Masa M-12 · Sahne görüşü")).toBeTruthy();
    expect(screen.getByText(SIGHTLINE_CAPTION)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "3B'de masadan bak" }));
    expect(onLookIn3d).toHaveBeenCalledTimes(1);
  });

  it("loca için başlık Loca ile yazılır", () => {
    render(<SightlinePanel set="diamond" table={{ label: "L-3A", isLoca: true }} canLookIn3d={false} onLookIn3d={() => {}} />);
    expect(screen.getByText("Loca L-3A · Sahne görüşü")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toBe("/sightline/diamond/L-3A.webp");
  });

  it("fotoğraf yüklenemezse (404) yerine 3B'de masadan bak düğmesi gelir", () => {
    const onLookIn3d = vi.fn();
    render(<SightlinePanel set="diamond" table={{ label: "M-12", isLoca: false }} canLookIn3d onLookIn3d={onLookIn3d} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    const btn = screen.getByRole("button", { name: "3B'de masadan bak" });
    fireEvent.click(btn);
    expect(onLookIn3d).toHaveBeenCalledTimes(1);
  });

  it("set boşsa ya da etiket kurala uymuyorsa fotoğraf istenmez, düğme gösterilir", () => {
    const { rerender } = render(
      <SightlinePanel set={null} table={{ label: "M-12", isLoca: false }} canLookIn3d onLookIn3d={() => {}} />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: "3B'de masadan bak" })).toBeTruthy();

    rerender(<SightlinePanel set="diamond" table={{ label: "A1", isLoca: false }} canLookIn3d onLookIn3d={() => {}} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: "3B'de masadan bak" })).toBeTruthy();
  });

  it("3B yoksa düğme yerine açıklama metni çıkar; etiket yine görünür", () => {
    render(
      <SightlinePanel set={null} table={{ label: "M-12", isLoca: false }} canLookIn3d={false} onLookIn3d={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "3B'de masadan bak" })).toBeNull();
    expect(screen.getByText("Bu masa için sahne görüşü fotoğrafı yok.")).toBeTruthy();
    expect(screen.getByText(SIGHTLINE_CAPTION)).toBeTruthy();
  });

  it("masa seçili değilken genel görünüm fotoğrafı gösterilir", () => {
    render(<SightlinePanel set="diamond" table={null} canLookIn3d onLookIn3d={() => {}} />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("/sightline/diamond/overview.webp");
    expect(screen.getByText("Salon ortasından sahne görüşü")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "3B'de masadan bak" })).toBeNull();
  });

  it("masa değişince önceki hata durumu sıfırlanır", () => {
    const { rerender } = render(
      <SightlinePanel set="diamond" table={{ label: "M-12", isLoca: false }} canLookIn3d onLookIn3d={() => {}} />,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<SightlinePanel set="diamond" table={{ label: "M-13", isLoca: false }} canLookIn3d onLookIn3d={() => {}} />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("/sightline/diamond/M-13.webp");
  });
});
