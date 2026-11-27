import { env, type Env } from "@/env";
import { demoProvider } from "./demo";
import type { PaymentProvider } from "./provider";

export function resolveProvider(setting: Env["PAYMENT_PROVIDER"]): PaymentProvider | null {
  return setting === "demo" ? demoProvider : null;
}

export function activeProvider(): PaymentProvider | null {
  return resolveProvider(env.PAYMENT_PROVIDER);
}

/**
 * Etkinlik bazında sağlayıcı: demo etkinlik (`events.is_demo`) `PAYMENT_PROVIDER` ne olursa olsun temsili
 * demo sağlayıcıyla satılır; gerçek etkinlik genel sağlayıcıya (`base`, varsayılan `activeProvider()`) bağlı
 * kalır. Demo etkinliğin görünürlüğünü demo anahtarı ayrıca süzer (katalog ve tutma denetimi).
 */
export function providerForEvent(
  event: { isDemo: boolean },
  base: PaymentProvider | null = activeProvider(),
): PaymentProvider | null {
  return event.isDemo ? demoProvider : base;
}
