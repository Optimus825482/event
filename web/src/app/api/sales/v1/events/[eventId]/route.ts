import { salesHandlers } from "@/features/sales-api/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await ctx.params;
  return salesHandlers.getEvent(request, eventId);
}
