// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckoutSteps } from "@/components/checkout-steps";
import { TicketCard } from "@/features/ticket/ticket-card";

afterEach(cleanup);

const props = { index: 1, total: 2, tableLabel: "A1", qrSrc: "data:image/png;base64,AA==" };

describe("TicketCard ve CheckoutSteps", () => {
  it("sandalye numarası null değilse yazılır", () => {
    render(
      <ul>
        <TicketCard {...props} seatNo={7} />
      </ul>,
    );
    expect(screen.getByText("Masa A1")).toBeInTheDocument();
    expect(screen.getByText("Sandalye 7")).toBeInTheDocument();
  });

  it("bütün satılan masada (seatNo null) sandalye satırı yoktur", () => {
    render(
      <ul>
        <TicketCard {...props} seatNo={null} />
      </ul>,
    );
    expect(screen.queryByText(/Sandalye/)).toBeNull();
    expect(screen.getByRole("img", { name: "Bilet 1 QR kodu" })).toBeInTheDocument();
  });

  it("adımlar: geçerli adım aria-current taşır", () => {
    render(<CheckoutSteps current="odeme" />);
    expect(
      within(screen.getByRole("list", { name: "Satın alma adımları" }))
        .getAllByRole("listitem")
        .map((li) => [li.textContent?.replace(/^\d/, ""), li.getAttribute("aria-current")]),
    ).toEqual([
      ["Masa Seçimi", null],
      ["Ödeme", "step"],
      ["E-Bilet", null],
    ]);
  });
});
