// Yük betiği: çekirdeğe giden doluluk isteğini sayan vekil açar, satış sitesine sürekli doluluk sorgusu atar
// ve 5. saniyede çekirdeğe eşzamanlı tutmalar gönderir. Sır yalnızca SALES_API_SECRET ortamından okunur.
import http from "node:http";
import { parseArgs } from "node:util";
import { planHolds, summarize } from "./load-lib.mjs";

const { values } = parseArgs({
  options: {
    satis: { type: "string" },
    core: { type: "string" },
    "proxy-port": { type: "string" },
    event: { type: "string" },
    clients: { type: "string", default: "5000" },
    holds: { type: "string", default: "300" },
    duration: { type: "string", default: "30" },
  },
  strict: true,
});
const secret = process.env.SALES_API_SECRET;
for (const key of ["satis", "core", "proxy-port", "event"]) {
  if (!values[key]) {
    console.error(`--${key} gerekli`);
    process.exit(2);
  }
}
if (!secret || secret.length < 32) {
  console.error("SALES_API_SECRET ortam değişkeni tanımlı olmalı (en az 32 karakter)");
  process.exit(2);
}
const satis = values.satis.replace(/\/$/, "");
const core = values.core.replace(/\/$/, "");
const event = values.event;
const clients = Number(values.clients);
const holdCount = Number(values.holds);
const durationSec = Number(values.duration);
const ratePerSecond = Math.max(1, Math.floor(clients / 5));
const coreUrl = new URL(core);
const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });

// --- Çekirdeğe ileten, /availability isteklerini sayan vekil ---
let availabilityHits = 0;
const proxy = http.createServer((req, res) => {
  if (/\/availability(\?|$)/.test(req.url ?? "")) availabilityHits++;
  const upstream = http.request(
    { host: coreUrl.hostname, port: coreUrl.port, path: req.url, method: req.method, headers: req.headers, agent },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});
await new Promise((resolve) => proxy.listen(Number(values["proxy-port"]), "127.0.0.1", resolve));

const coreHeaders = { authorization: `Bearer ${secret}` };
async function readFree() {
  const res = await fetch(`${core}/api/sales/v1/events/${event}/availability`, { headers: coreHeaders });
  if (!res.ok) throw new Error(`doluluk okunamadı: ${res.status}`);
  const body = await res.json();
  return Object.fromEntries(body.tables.map((t) => [t.id, t.free]));
}

function get(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.get({ host: u.hostname, port: u.port, path: u.pathname + u.search, agent }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
      res.on("error", () => resolve(0));
    });
    req.setTimeout(10_000, () => req.destroy());
    req.on("error", () => resolve(0));
  });
}

async function postHold(plan) {
  try {
    const res = await fetch(`${core}/api/sales/v1/orders`, {
      method: "POST",
      headers: { ...coreHeaders, "content-type": "application/json", "x-sales-client-ip": plan.clientIp },
      body: JSON.stringify({ eventId: event, items: [{ tableId: plan.tableId, quantity: plan.quantity }], clientKey: plan.clientKey }),
    });
    const body = await res.json().catch(() => null);
    return { tableId: plan.tableId, quantity: plan.quantity, status: res.status, code: body?.error?.code ?? null };
  } catch {
    return { tableId: plan.tableId, quantity: plan.quantity, status: 0, code: "network" };
  }
}

const initialFree = await readFree();
// Proxy sayacı başlangıç okumasından sonra sıfırlanır; yalnızca satış sitesinin yükü sayılır.
availabilityHits = 0;
const plans = planHolds({
  tables: Object.entries(initialFree).map(([id, free]) => ({ id, free })),
  count: holdCount,
  random: Math.random,
});

const target = `${satis}/api/durum/${event}`;
const startedAt = Date.now();
let pollTotal = 0;
let pollErrors = 0;
const inflight = new Set();
const tick = setInterval(() => {
  for (let i = 0; i < ratePerSecond / 10; i++) {
    pollTotal++;
    const p = get(target).then((status) => {
      if (status < 200 || status >= 300) pollErrors++;
      inflight.delete(p);
    });
    inflight.add(p);
  }
}, 100);

let holdsPromise = Promise.resolve([]);
const holdTimer = setTimeout(() => {
  holdsPromise = Promise.all(plans.map(postHold));
}, Math.min(5, durationSec) * 1000);

await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
clearInterval(tick);
clearTimeout(holdTimer);
const holds = await holdsPromise;
await Promise.allSettled([...inflight]);
const durationMs = Date.now() - startedAt;

await new Promise((resolve) => setTimeout(resolve, 3000));
const finalFree = await readFree();
const hitsDuringRun = availabilityHits;
proxy.close();
agent.destroy();

const result = summarize({ initialFree, finalFree, holds, availabilityHits: hitsDuringRun, durationMs, pollTotal, pollErrors });
console.log(JSON.stringify({ ...result, pollTotal, pollErrors, availabilityHits: hitsDuringRun, durationMs, holdsSent: holds.length }, null, 2));
process.exit(result.ok ? 0 : 1);
