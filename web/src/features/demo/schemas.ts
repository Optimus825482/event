import { z } from "zod";

export const setSalesDemoSchema = z.object({
  enabled: z.boolean(),
});

export const demoConfirmSchema = z.object({
  confirm: z.literal(true),
});

export type SetSalesDemoInput = z.infer<typeof setSalesDemoSchema>;
export type DemoConfirmInput = z.infer<typeof demoConfirmSchema>;
