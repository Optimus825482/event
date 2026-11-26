import { z } from "zod";

export const holdInputSchema = z.strictObject({
  eventId: z.uuid(),
  tableId: z.uuid(),
  quantity: z.number().int().min(1).max(50),
  clientKey: z.uuid(),
});
