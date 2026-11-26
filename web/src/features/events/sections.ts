import { can, type Module, type PolicyActor } from "@/features/auth/policy";
import { FINANCE_READY } from "@/features/finance/ready";
import { TICKETING_READY } from "@/features/ticketing/ready";

export type EventSectionKey = "overview" | "tables" | "finance" | "orders";

export type EventSection = {
  key: EventSectionKey;
  label: string;
  href: (eventId: string) => string;
  module: Module;
  ready: boolean;
};

/** Etkinlik bölümleri, çubuktaki sırayla. `ready` false olan bölüm henüz yoktur ve hiç gösterilmez. */
export const EVENT_SECTIONS: readonly EventSection[] = [
  { key: "overview", label: "Genel", href: (id) => `/events/${id}`, module: "events", ready: true },
  { key: "tables", label: "Masalar ve Satış", href: (id) => `/events/${id}/tables`, module: "ticketing", ready: true },
  { key: "finance", label: "Finans", href: (id) => `/events/${id}/finance`, module: "finance", ready: FINANCE_READY },
  { key: "orders", label: "Siparişler", href: (id) => `/events/${id}/orders`, module: "ticketing", ready: TICKETING_READY },
];

/** Hazır olan ve modülünde görüntüleme yetkisi bulunan bölümler. */
export function visibleEventSections(actor: PolicyActor): EventSection[] {
  return EVENT_SECTIONS.filter((section) => section.ready && can(actor, section.module, "view"));
}
