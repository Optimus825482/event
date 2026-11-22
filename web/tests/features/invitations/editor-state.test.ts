import { describe, expect, it } from "vitest";
import { editorReducer, designFrom, sizeKeyFor, type EditorState } from "@/features/invitations/components/editor/editor-state";
import { DEFAULT_TEMPLATE_ELEMENTS, invitationElementsSchema, withFieldValues } from "@/features/invitations/elements";

function fresh(): EditorState {
  return { design: designFrom({ width: 559, height: 794, backgroundColor: null, backgroundGradient: null, backgroundImage: null, elements: [] }), selectedId: null, dirty: false };
}

describe("editör durumu", () => {
  it("ekler, seçer ve kirli işaretler; öne gelen z-index büyür", () => {
    let s = editorReducer(fresh(), { type: "add", elementType: "text", id: "a" });
    s = editorReducer(s, { type: "add", elementType: "qrcode", id: "b" });
    expect(s.selectedId).toBe("b");
    expect(s.dirty).toBe(true);
    const [a, b] = s.design.elements;
    expect((b?.zIndex ?? 0) > (a?.zIndex ?? 0)).toBe(true);
  });

  it("taşır, boyutlandırır (en az 10), çoğaltır ve siler", () => {
    let s = editorReducer(fresh(), { type: "add", elementType: "text", id: "a" });
    s = editorReducer(s, { type: "move", id: "a", x: 10.4, y: 20.6 });
    s = editorReducer(s, { type: "resize", id: "a", width: 2, height: 99 });
    expect(s.design.elements[0]).toMatchObject({ x: 10, y: 21, width: 10, height: 99 });
    s = editorReducer(s, { type: "duplicate", id: "a", newId: "c" });
    expect(s.design.elements).toHaveLength(2);
    expect(s.selectedId).toBe("c");
    s = editorReducer(s, { type: "remove", id: "c" });
    expect(s.design.elements.map((e) => e.id)).toEqual(["a"]);
    expect(s.selectedId).toBeNull();
  });

  it("boyut ön ayarı genişlik/yüksekliği değiştirir; eşleşmeyen ölçü CUSTOM olur", () => {
    const s = editorReducer(fresh(), { type: "size", size: "A6" });
    expect(s.design).toMatchObject({ size: "A6", width: 397, height: 559 });
    expect(sizeKeyFor(397, 559)).toBe("A6");
    expect(sizeKeyFor(500, 500)).toBe("CUSTOM");
  });

  it("yer tutucuları önizlemede doldurur; varsayılan şablon şemadan geçer", () => {
    expect(invitationElementsSchema.safeParse(DEFAULT_TEMPLATE_ELEMENTS).success).toBe(true);
    const named = DEFAULT_TEMPLATE_ELEMENTS.find((e) => e.type === "guestName");
    expect(named && withFieldValues(named, { guestName: "Ali" }).content).toBe("Ali");
  });
});
