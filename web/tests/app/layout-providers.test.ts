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
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/features/notifications/service", () => ({ countUnread: async () => 3 }));
vi.mock("@/features/users/profile", () => ({ getOwnAvatar: async () => null }));
vi.mock("@/features/users/current-session", () => ({ currentSessionExpiry: async () => null }));

import AppLayout from "@/app/(app)/layout";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/ui/toast";

/** Eleman ağacını gezip verilen bileşenin üst-alt sırasını döndürür. */
function typesAlongPath(node: ReactNode, path: unknown[] = []): unknown[] {
  // Birden çok çocuk varsa (ör. kabuk + yüzen katmanlar) ilk eleman izlenir.
  if (Array.isArray(node)) return typesAlongPath(node.find((child) => isValidElement(child)), path);
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
    expect(path).toContain(ToastProvider);
  });
});
