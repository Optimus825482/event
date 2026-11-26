import type { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { sendOrderEmail } from "./eticket-mail";
import { getOrdersOverview } from "./queries";
import { ordersOverviewSchema, resendOrderEmailSchema } from "./schemas";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

export const ticketingActionDefs = {
  resendEmail: def({
    module: "ticketing",
    verb: "edit",
    input: resendOrderEmailSchema,
    handler: ({ input }) => sendOrderEmail(db, input.orderId),
  }),
  /** Canlı yenileme için okuma eylemi (liste, doluluk, toplamlar). */
  overview: def({
    module: "ticketing",
    verb: "view",
    input: ordersOverviewSchema,
    handler: ({ actor, input }) => getOrdersOverview(db, actor, input.eventId),
  }),
};
