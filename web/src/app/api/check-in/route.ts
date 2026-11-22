import { handleCheckInPost } from "@/features/check-in/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Çevrimdışı kuyruk eşitlemesi: tek check-in ya da en çok 50 öğelik toplu istek. */
export async function POST(request: Request): Promise<Response> {
  return handleCheckInPost(request);
}
