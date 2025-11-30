import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as QRCode from "qrcode";
import * as crypto from "crypto";
import { Reservation } from "../../entities/reservation.entity";

/**
 * QR kod içeriği için interface
 */
export interface QRCodeContent {
  eventId: string;
  tableId: string;
  qrCodeHash: string;
}

/**
 * QR kod üretim sonucu
 */
export interface QRCodeResult {
  qrCodeDataUrl: string;
  content: QRCodeContent;
}

/**
 * QR Engine - Benzersiz QR kod üretimi ve doğrulama
 * Requirements: 1.4, 2.4, 3.2, 3.4
 */
@Injectable()
export class QREngineService {
  private readonly logger = new Logger(QREngineService.name);

  // QR kod cache - idempotence için (Requirement 3.4)
  private qrCodeCache: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>
  ) {}

  /**
   * Benzersiz QR hash oluştur
   * Requirement 1.4: Benzersiz QR_Code_Hash üretimi
   *
   * @param eventId Event ID
   * @param tableId Masa ID
   * @param customerId Müşteri ID
   * @returns Benzersiz 32 karakterlik hash
   */
  async generateHash(
    eventId: string,
    tableId: string,
    customerId: string
  ): Promise<string> {
    let hash: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Benzersizlik için timestamp ve random değer ekle
      const uniqueData = `${eventId}-${tableId}-${customerId}-${Date.now()}-${crypto
        .randomBytes(16)
        .toString("hex")}`;

      hash = crypto
        .createHash("sha256")
        .update(uniqueData)
        .digest("hex")
        .substring(0, 32);

      attempts++;

      // Collision kontrolü - veritabanında bu hash var mı?
      const existing = await this.reservationRepository.findOne({
        where: { qrCodeHash: hash },
      });

      if (!existing) {
        this.logger.debug(`QR hash oluşturuldu: ${hash} (${attempts}. deneme)`);
        return hash;
      }

      this.logger.warn(
        `QR hash collision tespit edildi, yeniden deneniyor... (${attempts}/${maxAttempts})`
      );
    } while (attempts < maxAttempts);

    // Son çare: UUID ekle
    const fallbackHash = crypto
      .createHash("sha256")
      .update(`${eventId}-${tableId}-${customerId}-${crypto.randomUUID()}`)
      .digest("hex")
      .substring(0, 32);

    this.logger.warn(`Fallback hash kullanıldı: ${fallbackHash}`);
    return fallbackHash;
  }

  /**
   * QR hash'in geçerliliğini kontrol et
   * @param hash Kontrol edilecek hash
   * @returns Hash geçerli mi?
   */
  validateHash(hash: string): boolean {
    // Hash 32 karakter hexadecimal olmalı
    if (!hash || hash.length !== 32) {
      return false;
    }
    return /^[a-f0-9]{32}$/i.test(hash);
  }

  /**
   * QR kod içeriğini encode et
   * Requirement 3.2: eventId, tableId, qrCodeHash içermeli
   *
   * @param content QR kod içeriği
   * @returns Base64 encoded string
   */
  encodeQRContent(content: QRCodeContent): string {
    const jsonString = JSON.stringify(content);
    return Buffer.from(jsonString).toString("base64");
  }

  /**
   * QR kod içeriğini decode et
   * @param encodedData Base64 encoded string
   * @returns QR kod içeriği
   */
  decodeQRContent(encodedData: string): QRCodeContent | null {
    try {
      const jsonString = Buffer.from(encodedData, "base64").toString("utf-8");
      const content = JSON.parse(jsonString) as QRCodeContent;

      // İçerik validasyonu
      if (!content.eventId || !content.tableId || !content.qrCodeHash) {
        return null;
      }

      return content;
    } catch (error) {
      this.logger.error(`QR içerik decode hatası: ${error.message}`);
      return null;
    }
  }

  /**
   * QR kod data URL oluştur
   * Requirement 3.4: Aynı rezervasyon için aynı QR döndür (idempotence)
   *
   * @param reservation Rezervasyon
   * @returns QR kod data URL ve içerik
   */
  async generateQRCode(reservation: Reservation): Promise<QRCodeResult> {
    const cacheKey = reservation.id;

    // Cache kontrolü - idempotence (Requirement 3.4)
    if (this.qrCodeCache.has(cacheKey)) {
      const cachedDataUrl = this.qrCodeCache.get(cacheKey)!;
      return {
        qrCodeDataUrl: cachedDataUrl,
        content: {
          eventId: reservation.eventId,
          tableId: reservation.tableId,
          qrCodeHash: reservation.qrCodeHash,
        },
      };
    }

    // QR içeriği oluştur (Requirement 3.2)
    const content: QRCodeContent = {
      eventId: reservation.eventId,
      tableId: reservation.tableId,
      qrCodeHash: reservation.qrCodeHash,
    };

    // İçeriği encode et
    const encodedContent = this.encodeQRContent(content);

    // QR kod oluştur
    const qrCodeDataUrl = await QRCode.toDataURL(encodedContent, {
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H", // Yüksek hata düzeltme
    });

    // Cache'e ekle
    this.qrCodeCache.set(cacheKey, qrCodeDataUrl);

    return { qrCodeDataUrl, content };
  }

  /**
   * Cache'i temizle (test için)
   */
  clearCache(): void {
    this.qrCodeCache.clear();
  }

  /**
   * Belirli bir rezervasyonun cache'ini temizle
   * @param reservationId Rezervasyon ID
   */
  invalidateCache(reservationId: string): void {
    this.qrCodeCache.delete(reservationId);
  }
}
