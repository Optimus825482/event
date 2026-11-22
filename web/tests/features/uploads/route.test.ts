import { rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/uploads/[...path]/route";
import { saveImage } from "@/features/uploads/images";
import { UPLOAD_ROOT } from "@/features/uploads/root";
import { createAdmin } from "../../../scripts/create-admin";
import { truncateAll } from "../../helpers/db";
import { PASSWORD, signedInCookie } from "../auth/helpers";

const ctx = (...segments: string[]) => ({ params: Promise.resolve({ path: segments }) });

describe("GET /api/uploads/[...path]", () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(() => {
    rmSync(path.join(UPLOAD_ROOT, "logo"), { recursive: true, force: true });
  });

  it("oturumsuz istek 401 alır", async () => {
    const res = await GET(new Request("http://localhost:3000/api/uploads/logo/a.webp"), ctx("logo", "a.webp"));
    expect(res.status).toBe(401);
  });

  it("oturumlu kullanıcı dosyayı alır; kök dışı yol 404 olur", async () => {
    await createAdmin({ username: "yonetici", password: PASSWORD });
    const cookie = await signedInCookie("yonetici");
    const input = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#0f0" } })
      .png()
      .toBuffer();
    const { path: saved } = await saveImage(new File([input], "a.png", { type: "image/png" }), "logo");

    const ok = await GET(
      new Request(`http://localhost:3000/api/uploads/${saved}`, { headers: { cookie } }),
      ctx(...saved.split("/")),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");

    const bad = await GET(
      new Request("http://localhost:3000/api/uploads/..%2Fx.webp", { headers: { cookie } }),
      ctx("..", "x.webp"),
    );
    expect(bad.status).toBe(404);
  });
});
