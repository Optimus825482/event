import { salesHandlers } from "@/features/sales-api/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ orderToken: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  const { orderToken } = await ctx.params;
  return salesHandlers.getOrder(request, orderToken);
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const { orderToken } = await ctx.params;
  return salesHandlers.cancelOrder(request, orderToken);
}
