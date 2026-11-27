import { salesImageHandler } from "@/features/sales-api/images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ kind: string; file: string }> },
): Promise<Response> {
  const { kind, file } = await ctx.params;
  return salesImageHandler(request, kind, file);
}
