import { describe, expect, it } from "vitest";
import { mediaResponse, parseByteRange, uploadContentType } from "@/features/uploads/range";

describe("parseByteRange", () => {
  it.each([
    ["bytes=0-3", { start: 0, end: 3 }],
    ["bytes=5-", { start: 5, end: 9 }],
    ["bytes=-4", { start: 6, end: 9 }],
    ["bytes=2-100", { start: 2, end: 9 }],
    ["bytes=-100", { start: 0, end: 9 }],
  ])("%s → %o (boyut 10)", (header, range) => {
    expect(parseByteRange(header, 10)).toEqual(range);
  });

  it.each([null, "", "items=0-1", "bytes=0-1,4-5", "bytes=abc", "bytes=3-1", "bytes=-0x"])(
    "%s yok sayılır (tam yanıt)",
    (header) => {
      expect(parseByteRange(header, 10)).toBeNull();
    },
  );

  it.each(["bytes=10-", "bytes=20-30", "bytes=-0"])("%s karşılanamaz", (header) => {
    expect(parseByteRange(header, 10)).toBe("unsatisfiable");
  });
});

describe("uploadContentType", () => {
  it("uzantıdan türü verir", () => {
    expect(uploadContentType("event/a.webp")).toBe("image/webp");
    expect(uploadContentType("event/a.webm")).toBe("video/webm");
  });
});

describe("mediaResponse", () => {
  const data = Buffer.from("0123456789");
  const base = { contentType: "video/webm", cacheControl: "private, max-age=300" };

  it("aralıksız istekte 200 ve tüm gövde", async () => {
    const res = mediaResponse(data, { ...base, range: null });
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe("10");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await res.text()).toBe("0123456789");
  });

  it("geçerli aralıkta 206 ve dilim", async () => {
    const res = mediaResponse(data, { ...base, range: "bytes=2-4" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(res.headers.get("content-length")).toBe("3");
    expect(res.headers.get("content-type")).toBe("video/webm");
    expect(await res.text()).toBe("234");
  });

  it("karşılanamayan aralıkta 416", async () => {
    const res = mediaResponse(data, { ...base, range: "bytes=50-" });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */10");
    expect(await res.text()).toBe("");
  });
});
