import { salesHandlers } from "@/features/sales-api/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return salesHandlers.listEvents(request);
}
