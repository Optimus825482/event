import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./provider";

/** Demo POS: gerçek ödeme almaz; istenen sonucu aynen döner. Yalnızca registry.ts içe aktarabilir. */
export const demoProvider: PaymentProvider = {
  id: "demo",
  isDemo: true,
  async start({ request }) {
    return {
      outcome: request.action === "approve" ? "approved" : "declined",
      providerRef: `demo-${randomUUID()}`,
    };
  },
};
