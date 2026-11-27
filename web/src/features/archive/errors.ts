import { DomainError } from "@/lib/action";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";

/** Arşiv yazan işlemlerin (tamamlanma, yeniden oluşturma) bilinen veritabanı hatalarını iş hatasına çevirir. */
export function mapArchiveWriteError(error: unknown): never {
  const code = pgCodeOf(error);
  if (code === "40001") {
    throw new DomainError("conflict", "Etkinlik aynı anda değiştirildi, lütfen tekrar deneyin");
  }
  if (code === "23503" && (pgConstraintOf(error) ?? "").includes("artist")) {
    throw new DomainError("conflict", "Sanatçı silinmiş, etkinliği güncelleyip tekrar deneyin");
  }
  if (code === "22003") {
    throw new DomainError("conflict", "Tutar arşiv sınırını aşıyor");
  }
  throw error;
}
