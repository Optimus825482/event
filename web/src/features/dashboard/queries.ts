import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { getAdminDashboard, getEventsDashboard } from "./service";

export async function loadEventsDashboard() {
  const actor = await requirePolicyActor();
  return getEventsDashboard(db, actor);
}

export async function loadAdminDashboard() {
  const actor = await requirePolicyActor();
  return getAdminDashboard(db, actor);
}
