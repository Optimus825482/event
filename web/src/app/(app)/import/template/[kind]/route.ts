import { can } from "@/features/auth/policy";
import { getActor } from "@/features/auth/session";
import {
  buildAssignmentTemplate,
  buildReservationTemplate,
  TEMPLATE_FILENAMES,
  type TemplateKind,
} from "@/features/import/templates";

type Params = Promise<{ kind: string }>;

function isKind(value: string): value is TemplateKind {
  return value === "reservations" || value === "assignments";
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Boş Excel şablonunu indirir (salt okunur). İzin: ilgili içe aktarmanın izniyle aynı. */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { kind } = await params;
  const actor = await getActor();
  if (!actor) return Response.json({ message: "Oturum gerekli" }, { status: 401 });
  if (!isKind(kind)) return Response.json({ message: "Şablon bulunamadı" }, { status: 404 });

  const allowed = kind === "reservations" ? can(actor, "reservations", "create") : can(actor, "staff", "edit");
  if (!allowed) return Response.json({ message: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const bytes = kind === "reservations" ? await buildReservationTemplate() : await buildAssignmentTemplate();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILENAMES[kind]}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
