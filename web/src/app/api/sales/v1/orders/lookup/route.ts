import { salesHandlers } from "@/features/sales-api/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return salesHandlers.lookupOrder(request);
}
