// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderDetailView } from "@/features/ticketing/components/order-detail";
import type { OrderDetail } from "@/features/ticketing/queries";

afterEach(cleanup);

function makeDetail(seatNo: number | null): OrderDetail {
  return {
    orderId: "00000000-0000-4000-8000-000000000010",
    eventId: "00000000-0000-4000-8000-000000000001",
    status: "paid",
    pnr: "ABCD2345",
    buyerName: "Ayşe Yılmaz",
    buyerEmail: "ayse@example.com",
    buyerPhone: null,
    seatCount: 1,
    tableLabels: ["A1"],
    total: "1500.00",
    currency: "TRY",
    isDemo: false,
    paidAt: "2027-01-10T10:00:00.000Z",
    holdExpiresAt: "2027-01-10T10:15:00.000Z",
    eticketSentAt: null,
    createdAt: "2027-01-10T09:55:00.000Z",
    tickets: [
      {
        ticketId: "t-1",
        tableLabel: "A1",
        seatNo,
        category: "standard",
        unitPrice: "1500.00",
        status: "issued",
        qrPayload: "qr-1",
        checkedInAt: null,
      },
    ],
    attempts: [],
  };
}

describe("OrderDetailView", () => {
  it("bilet kartı masa ve sandalyeyi gösterir", () => {
    render(
      <OrderDetailView
        detail={makeDetail(5)}
        qrImages={{ "t-1": "data:image/png;base64,AAAA" }}
        canResend={false}
      />,
    );
    expect(screen.getByText("Masa A1 · Sandalye 5")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Masa A1 · Sandalye 5 bilet QR kodu" })).toBeTruthy();
  });

  it("seatNo null iken yalnızca masa yazar", () => {
    render(
      <OrderDetailView
        detail={makeDetail(null)}
        qrImages={{ "t-1": "data:image/png;base64,AAAA" }}
        canResend={false}
      />,
    );
    expect(screen.getByText("Masa A1")).toBeTruthy();
    expect(screen.queryByText(/Sandalye/)).toBeNull();
  });
});
