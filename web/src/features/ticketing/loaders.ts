import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { getOrderDetail, getOrdersOverview, type OrderDetail, type OrdersOverview } from "./queries";

/** Yetkisizlikte `ForbiddenError` (403) fırlar; geçersiz kimlik ve olmayan kayıt 404 verir. */
export async function loadOrdersOverview(eventId: string): Promise<OrdersOverview> {
  const actor = await requirePolicyActor();
  authorize(actor, "ticketing", "view");
  if (!isUuid(eventId)) notFound();
  try {
    return await getOrdersOverview(db, actor, eventId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

export async function loadOrderDetail(eventId: string, orderId: string): Promise<OrderDetail> {
  const actor = await requirePolicyActor();
  authorize(actor, "ticketing", "view");
  if (!isUuid(eventId) || !isUuid(orderId)) notFound();
  try {
    return await getOrderDetail(db, actor, { eventId, orderId });
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
