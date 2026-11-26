import { env, type Env } from "@/env";
import { demoProvider } from "./demo";
import type { PaymentProvider } from "./provider";

export function resolveProvider(setting: Env["PAYMENT_PROVIDER"]): PaymentProvider | null {
  return setting === "demo" ? demoProvider : null;
}

export function activeProvider(): PaymentProvider | null {
  return resolveProvider(env.PAYMENT_PROVIDER);
}
