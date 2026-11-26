import type { OrderResponse } from "@/lib/core/contract";

export const DEMO_NOTICE = "DEMO - gerçek ödeme alınmadı";

/** Bekleyen siparişte `demoNotice` boş olabilir; etkinlik demo ise sabit ibare gösterilir. */
export function demoNoticeFor(order: Pick<OrderResponse, "demoNotice" | "isDemo">, saleDemo: boolean): string | null {
  return order.demoNotice ?? (order.isDemo || saleDemo ? DEMO_NOTICE : null);
}

/** Etkinlik okunamazsa güvenli yön: site yalnızca demo ödeme gönderdiği için demo varsayılır. */
export function saleIsDemo(event: { sale: { demo: boolean } } | null): boolean {
  return event ? event.sale.demo : true;
}
