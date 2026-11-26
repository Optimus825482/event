import { salesHandlers } from "@/features/sales-api/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ orderToken: string }> }): Promise<Response> {
  const { orderToken } = await ctx.params;
  return salesHandlers.payOrder(request, orderToken);
}
