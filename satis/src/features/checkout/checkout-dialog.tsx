"use client";

import { useId } from "react";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";
import type { OrderResponse } from "@/lib/core/contract";
import { demoNoticeFor } from "./demo";
import { OrderSummary } from "./order-summary";
import { PaymentForm } from "./payment-form";

export type CheckoutDialogProps = {
  open: boolean;
  order: OrderResponse | null;
  serverNow: string;
  categoryLabels: Record<string, string>;
  saleDemo: boolean;
  onClose(): void;
  onRelease(): void;
  onExpire(): void;
};

/** Salon sayfasında masa seçildikten sonra aynı pencere akışı içinde açılan ödeme ekranı. */
export function CheckoutDialog({
  open,
  order,
  serverNow,
  categoryLabels,
  saleDemo,
  onClose,
  onRelease,
  onExpire,
}: CheckoutDialogProps) {
  const titleId = useId();
  const demoNotice = order ? demoNoticeFor(order, saleDemo) : null;

  return (
    <Modal open={open && order !== null} onClose={onClose} labelledBy={titleId} className="max-w-[620px]">
      {order ? (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase">Adım 2 · Ödeme</p>
              <h2 id={titleId} className="mt-1 text-[28px] leading-tight text-ivory">
                Ödeme
              </h2>
            </div>
            <button
              type="button"
              aria-label="Ödeme penceresini kapat"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-raised text-xl text-muted transition-colors hover:border-gold hover:text-ivory"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <OrderSummary order={order} categoryLabels={categoryLabels} />

          <PaymentForm
            key={order.orderToken}
            orderToken={order.orderToken}
            eventId={order.eventId}
            holdExpiresAt={order.holdExpiresAt}
            serverNow={serverNow}
            demo={demoNotice !== null}
            onRelease={onRelease}
            onExpire={onExpire}
          >
            {demoNotice ? <Notice tone="demo">{demoNotice}</Notice> : null}
          </PaymentForm>
        </div>
      ) : null}
    </Modal>
  );
}
