import { expect, request as playwrightRequest, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { crossState } from "./state";

function secret(): string {
  const s = process.env.CROSS_SECRET;
  if (!s) throw new Error("CROSS_SECRET ortam değişkeni tanımlı değil");
  return s;
}

export function salesApi(request: APIRequestContext) {
  const { coreUrl } = crossState();
  const base = `${coreUrl}/api/sales/v1`;
  const auth = { authorization: `Bearer ${secret()}` };

  return {
    get: (path: string) => request.get(`${base}/${path.replace(/^\/+/, "")}`, { headers: auth }),
    post: (path: string, data: unknown, ip?: string) =>
      request.post(`${base}/${path.replace(/^\/+/, "")}`, {
        headers: ip ? { ...auth, "x-sales-client-ip": ip } : auth,
        data,
      }),
  };
}

/** Çekirdek `next dev` ile ilk istekte uçları derler; zaman aşımına takılmaması için ısıtılır. */
export async function warmCore(request: APIRequestContext, eventIds: readonly string[]): Promise<void> {
  const api = salesApi(request);
  const paths = ["events", ...eventIds.flatMap((id) => [`events/${id}`, `events/${id}/availability`])];
  for (const p of paths) {
    await expect.poll(async () => (await api.get(p)).status(), { timeout: 100_000 }).toBe(200);
  }
}

/** Çekirdek yönetim ekranları için API ile oturum açılmış tarayıcı bağlamı döner (bellekte storageState). */
export async function coreContext(browser: Browser, who: "admin" | "entertainment"): Promise<BrowserContext> {
  const { coreUrl, users } = crossState();
  const password = process.env.CROSS_USER_PASSWORD;
  if (!password) throw new Error("CROSS_USER_PASSWORD ortam değişkeni tanımlı değil");

  const username = users[who];
  const api = await playwrightRequest.newContext({
    baseURL: coreUrl,
    extraHTTPHeaders: { origin: coreUrl },
  });
  let storageState: Awaited<ReturnType<typeof api.storageState>>;
  try {
    const res = await api.post("/api/auth/sign-in/username", { data: { username, password } });
    if (!res.ok()) {
      throw new Error(`Çekirdek oturumu açılamadı (${username}): ${res.status()} ${await res.text()}`);
    }
    storageState = await api.storageState();
  } finally {
    await api.dispose();
  }
  return browser.newContext({ baseURL: coreUrl, storageState });
}

export async function buyViaApi(
  request: APIRequestContext,
  input: {
    eventId: string;
    tableId: string;
    quantity: number;
    seatNos?: number[];
    ip: string;
    buyer: { firstName: string; lastName: string; email: string; phone?: string };
  },
): Promise<{ orderToken: string; pnr: string }> {
  const api = salesApi(request);
  const holdRes = await api.post(
    "orders",
    {
      eventId: input.eventId,
      clientKey: randomUUID(),
      items: [
        {
          tableId: input.tableId,
          quantity: input.quantity,
          ...(input.seatNos ? { seatNos: input.seatNos } : {}),
        },
      ],
    },
    input.ip,
  );
  if (holdRes.status() !== 201) {
    throw new Error(`API tutma başarısız: ${holdRes.status()} ${await holdRes.text()}`);
  }
  const { orderToken } = (await holdRes.json()) as { orderToken: string };

  const payRes = await api.post(
    `orders/${orderToken}/pay`,
    {
      buyer: input.buyer,
      acceptTerms: true,
      payment: { provider: "demo", action: "approve" },
    },
    input.ip,
  );
  if (!payRes.ok()) {
    throw new Error(`API ödeme başarısız: ${payRes.status()} ${await payRes.text()}`);
  }
  const paid = (await payRes.json()) as { pnr: string | null };
  if (!paid.pnr) throw new Error("API ödeme yanıtında PNR yok");
  return { orderToken, pnr: paid.pnr };
}
