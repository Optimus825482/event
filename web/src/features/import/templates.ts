import ExcelJS from "exceljs";
import { ASSIGNMENT_COLUMNS, RESERVATION_COLUMNS } from "./columns";
import type { HeaderRequirements } from "./headers";

export type TemplateKind = "reservations" | "assignments";

const HELP: Record<TemplateKind, string[]> = {
  reservations: [
    "Her satır bir rezervasyondur. Masa etiketi etkinlikteki masanın etiketiyle aynı olmalıdır.",
    "Telefon ve e-posta müşteriyi eşlemek için kullanılır (ad ile eşleme yapılmaz).",
    "Kişi sayısı masanın kapasitesini aşamaz; dolu masaya yapılan satır atlanır.",
    "Yalnızca ilk sayfa okunur. En çok 5000 satır, en çok 10 MB.",
  ],
  assignments: [
    "Personel sicil no ile bulunur; sicil no boşsa ad tam eşleşiyorsa ve tekse kullanılır.",
    "Masa etiketlerini virgül ya da noktalı virgülle ayırın; Grup sütunu grubun tüm masalarını ekler.",
    "Vardiya, vardiya şablonunun adıdır (boş olabilir). Görev serbest metindir.",
    "Dosyadaki tek bir satır hatalıysa hiçbir atama yazılmaz. Yalnızca ilk sayfa okunur.",
  ],
};

async function build<K extends string>(kind: TemplateKind, columns: HeaderRequirements<K>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Veri");
  sheet.addRow(columns.specs.map((spec) => spec.label));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const help = workbook.addWorksheet("Açıklama");
  help.getColumn(1).width = 110;
  help.addRow(["Bu sayfa okunmaz. Verileri 'Veri' sayfasına, başlık satırının altına yazın."]);
  for (const line of HELP[kind]) help.addRow([line]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Boş rezervasyon şablonu: yalnızca başlık satırı (örnek satır yok; yanlışlıkla içe aktarılmasın). */
export function buildReservationTemplate(): Promise<Uint8Array> {
  return build("reservations", RESERVATION_COLUMNS);
}

export function buildAssignmentTemplate(): Promise<Uint8Array> {
  return build("assignments", ASSIGNMENT_COLUMNS);
}

export const TEMPLATE_FILENAMES: Record<TemplateKind, string> = {
  reservations: "rezervasyon-sablonu.xlsx",
  assignments: "personel-atama-sablonu.xlsx",
};
