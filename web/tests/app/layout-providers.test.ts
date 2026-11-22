import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/permissions", () => ({
  requirePolicyActor: async () => ({
    id: "u1",
    username: "ada",
    role: "admin",
    staffId: null,
    permissions: [],
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import AppLayout from "@/app/(app)/layout";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";

/** Eleman ağacını gezip verilen bileşenin üst-alt sırasını döndürür. */
function typesAlongPath(node: ReactNode, path: unknown[] = []): unknown[] {
  if (!isValidElement(node)) return path;
  const next = [...path, node.type];
  const props = node.props as { children?: ReactNode };
  return typesAlongPath(props.children, next);
}

describe("(app) düzeni", () => {
  it("içeriği QueryProvider ile sarar (useEventStream için gerekli)", async () => {
    const tree = await AppLayout({ children: "içerik" });
    const path = typesAlongPath(tree);
    expect(path).toContain(QueryProvider);
    expect(path).toContain(AppShell);
  });
});
