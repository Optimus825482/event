import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { activeProvider } from "@/features/ticketing/payment/registry";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { getSiteContentView, type SiteContentView } from "./content-service";
import { getSalesSiteOverview, type SalesSiteOverview } from "./overview";

export { SITE_TABS, parseSiteTab, type SiteTab } from "./tabs";

export async function loadSalesSiteOverview(): Promise<SalesSiteOverview> {
  const actor = await requirePolicyActor();
  return getSalesSiteOverview(db, actor, {
    now: new Date(),
    providerActive: activeProvider() !== null,
  });
}

export async function loadSiteContent(
  eventId: string,
): Promise<{ view: SiteContentView; canEdit: boolean; canSeeOrders: boolean }> {
  if (!isUuid(eventId)) notFound();
  const actor = await requirePolicyActor();
  try {
    const view = await getSiteContentView(db, actor, eventId, {
      now: new Date(),
      providerActive: activeProvider() !== null,
    });
    return {
      view,
      canEdit: can(actor, "events", "edit"),
      canSeeOrders: can(actor, "ticketing", "view"),
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
