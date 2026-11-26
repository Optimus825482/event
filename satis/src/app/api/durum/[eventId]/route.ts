import { durumResponse, unavailableResponse } from "@/features/plan/durum";
import { getReader } from "@/features/plan/read";
import { CoreError } from "@/lib/core/errors";

/** Canlı doluluk ucu: önbellekli okuma katmanından beslenir, çekirdeğe doğrudan gitmez. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await params;
  try {
    const availability = await getReader().availability(eventId);
    return durumResponse(availability, request.headers.get("if-none-match"));
  } catch (error) {
    if (error instanceof CoreError) return unavailableResponse();
    throw error;
  }
}
