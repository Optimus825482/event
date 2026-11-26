import { z } from "zod";

export const resendOrderEmailSchema = z.strictObject({ orderId: z.uuid("Geçersiz sipariş") });

export const ordersOverviewSchema = z.strictObject({ eventId: z.uuid("Geçersiz etkinlik") });
