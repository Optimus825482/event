import { can, type PolicyActor } from "@/features/auth/policy";

/** Ekip organizasyonu sayfası `staff` ve `events` görüntüleme izni ister; bağlantı ikisine de bağlıdır. */
export function canOpenTeamOrganization(actor: PolicyActor): boolean {
  return can(actor, "staff", "view") && can(actor, "events", "view");
}
