// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StageBadge } from "@/features/planning/components/stage-badge";

afterEach(cleanup);

describe("StageBadge", () => {
  it("canlı etkinlikte aşama renkli görünür", () => {
    render(<StageBadge stage="on_sale" status="published" />);
    const badge = screen.getByTestId("stage-badge");
    expect(badge.className).toContain("text-green-400");
    expect(badge.getAttribute("data-muted")).toBeNull();
  });

  it.each(["completed", "cancelled"] as const)("%s etkinlikte rozet soluk: canlı satış rengi yok", (status) => {
    render(<StageBadge stage="on_sale" status={status} />);
    const badge = screen.getByTestId("stage-badge");
    expect(badge.className).not.toContain("green");
    expect(badge.getAttribute("data-muted")).toBe("true");
    expect(badge.textContent).toBe("Satışta");
  });
});
