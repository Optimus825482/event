import { db } from "@/db/client";
import type { Role } from "@/features/auth/roles";
import { createUser as createLoginUser } from "@/features/users/service";
import { createUser as insertUser } from "../../helpers/factories";
import { PASSWORD, signedInCookie } from "../auth/helpers";

export type SseFrame = { event: string; data: string };

/** Belirli süre içinde koşul sağlanmazsa hata verir; sabit uyku yerine kullanılır. */
export async function waitFor(check: () => boolean, timeoutMs = 5000, label = "koşul"): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`${label} ${timeoutMs} ms içinde sağlanmadı`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** SSE gövdesini olay çerçevelerine ayırır (yorum satırları atlanır). */
export function sseReader(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames: SseFrame[] = [];
  let raw = "";

  async function pump(): Promise<boolean> {
    const { value, done } = await reader.read();
    if (done) return false;
    const text = decoder.decode(value, { stream: true });
    raw += text;
    buffer += text;
    let index = buffer.indexOf("\n\n");
    while (index !== -1) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data.push(line.slice(6));
      }
      if (data.length > 0) frames.push({ event, data: data.join("\n") });
      index = buffer.indexOf("\n\n");
    }
    return true;
  }

  /** Koşulu sağlayan çerçeve gelene kadar okur; o ana kadarki tüm çerçeveleri döndürür. */
  async function until(match: (frame: SseFrame) => boolean, timeoutMs = 5000): Promise<SseFrame[]> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`SSE çerçevesi ${timeoutMs} ms içinde gelmedi`)), timeoutMs).unref();
    });
    while (!frames.some(match)) {
      const more = await Promise.race([pump(), timeout]);
      if (!more) throw new Error("SSE akışı beklenen çerçeveden önce kapandı");
    }
    return [...frames];
  }

  /** Akışın başındaki ilk parçayı (retry + yorum) okur. */
  async function first(): Promise<string> {
    await pump();
    return raw;
  }

  return { until, first, frames, cancel: () => reader.cancel() };
}

/** Parolası olan, giriş yapabilen bir kullanıcı oluşturur ve oturum çerezini döndürür. */
export async function loginAs(role: Role): Promise<{ id: string; cookie: string }> {
  const admin = await insertUser(db, { role: "admin" });
  const username = `rt_${role}_${Math.random().toString(36).slice(2, 8)}`;
  const created = await createLoginUser(
    db,
    { id: admin.id, username: admin.username, role: "admin", staffId: null, memberships: [], permissions: [] },
    { username, password: PASSWORD, role },
  );
  return { id: created.id, cookie: await signedInCookie(username) };
}
