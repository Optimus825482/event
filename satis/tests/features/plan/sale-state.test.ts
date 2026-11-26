import { expect, it } from "vitest";
import { saleStateLabel } from "@/features/plan/sale-state";

it("satış durumu etiketleri", () =>
  expect((["open", "not_started", "ended", "closed"] as const).map(saleStateLabel)).toEqual([
    "Satışta",
    "Satış yakında",
    "Satış sona erdi",
    "Satış kapalı",
  ]));
