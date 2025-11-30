import { NotFoundException, BadRequestException } from "@nestjs/common";

/**
 * Rezervasyon bulunamadığında fırlatılır
 */
export class ReservationNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Rezervasyon bulunamadı: ${id}`);
  }
}

/**
 * Masa zaten rezerve edilmişse fırlatılır
 */
export class TableNotAvailableException extends BadRequestException {
  constructor(tableId: string) {
    super(`Bu masa zaten rezerve edilmiş: ${tableId}`);
  }
}

/**
 * Misafir sayısı masa kapasitesini aşarsa fırlatılır
 */
export class CapacityExceededException extends BadRequestException {
  constructor(guestCount: number, capacity: number) {
    super(
      `Misafir sayısı (${guestCount}) masa kapasitesini (${capacity}) aşıyor`
    );
  }
}

/**
 * Geçersiz check-in durumunda fırlatılır
 */
export class InvalidCheckInException extends BadRequestException {
  constructor(status: string) {
    super(`Bu rezervasyon için check-in yapılamaz. Durum: ${status}`);
  }
}

/**
 * Geçersiz QR kod durumunda fırlatılır
 */
export class InvalidQRCodeException extends BadRequestException {
  constructor() {
    super("Geçersiz QR kod");
  }
}
