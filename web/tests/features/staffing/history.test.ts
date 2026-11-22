import { describe, expect, it } from "vitest";
import { emptyHistory, historyShortcut, isDirty, record, redo, undo } from "@/features/staffing/history";

const key = (over: Partial<Parameters<typeof historyShortcut>[0]> = {}) => ({
  key: "z",
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  inTextField: false,
  ...over,
});

describe("taslak geçmişi", () => {
  it("geri al önceki görüntüyü verir, yinele geri getirir; yeni değişiklik ileriyi siler", () => {
    let h = record(emptyHistory<number>(), 1);
    h = record(h, 2);
    const u = undo(h, 3);
    expect(u?.snapshot).toBe(2);
    const r = redo(u!.history, 2);
    expect(r?.snapshot).toBe(3);
    const again = undo(r!.history, 3)!;
    const branched = record(again.history, 2);
    expect(branched.future).toEqual([]);
    expect(redo(branched, 9)).toBeNull();
  });

  it("boş geçmişte geri al / yinele yok", () => {
    expect(undo(emptyHistory<number>(), 1)).toBeNull();
    expect(redo(emptyHistory<number>(), 1)).toBeNull();
  });

  it("aynı anahtarla art arda değişiklik tek adımdır; geri al sonrası birleşme sıfırlanır", () => {
    let h = record(emptyHistory<string>(), "a", "group:1:name");
    h = record(h, "ab", "group:1:name");
    h = record(h, "abc", "group:1:name");
    expect(h.past).toEqual(["a"]);
    h = record(h, "x", "group:1:color");
    expect(h.past).toEqual(["a", "x"]);
    const u = undo(h, "y")!;
    const next = record(u.history, "x", "group:1:color");
    expect(next.past).toEqual(["a", "x"]);
  });

  it("sınırı aşınca en eski kayıt atılır ve taslak kirli kalır", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < 5; i++) h = record(h, i, null, 3);
    expect(h.past).toEqual([2, 3, 4]);
    expect(h.trimmed).toBe(true);
    for (let i = 0; i < 3; i++) h = undo(h, 0)!.history;
    expect(h.past).toEqual([]);
    expect(isDirty(h)).toBe(true);
    expect(isDirty(emptyHistory())).toBe(false);
  });

  it("kısayollar: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Cmd+Z; metin alanında ve Alt ile yok", () => {
    expect(historyShortcut(key())).toBe("undo");
    expect(historyShortcut(key({ key: "Z", shiftKey: true }))).toBe("redo");
    expect(historyShortcut(key({ key: "y" }))).toBe("redo");
    expect(historyShortcut(key({ ctrlKey: false, metaKey: true }))).toBe("undo");
    expect(historyShortcut(key({ inTextField: true }))).toBeNull();
    expect(historyShortcut(key({ altKey: true }))).toBeNull();
    expect(historyShortcut(key({ ctrlKey: false }))).toBeNull();
    expect(historyShortcut(key({ key: "x" }))).toBeNull();
  });
});
