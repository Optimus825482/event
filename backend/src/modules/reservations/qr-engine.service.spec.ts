import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QREngineService, QRCodeContent } from "./qr-engine.service";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";

/**
 * QREngineService Unit Tests
 * Checkpoint 3: QR Engine görevlerinin testleri
 */
describe("QREngineService", () => {
  let service: QREngineService;
  let reservationRepository: jest.Mocked<Repository<Reservation>>;

  const mockReservation: Partial<Reservation> = {
    id: "res-1",
    eventId: "event-1",
    tableId: "table-1",
    customerId: "customer-1",
    guestCount: 2,
    qrCodeHash: "abc123def456abc123def456abc12345",
    status: ReservationStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QREngineService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QREngineService>(QREngineService);
    reservationRepository = module.get(getRepositoryToken(Reservation));

    // Her test öncesi cache temizle
    service.clearCache();
  });

  describe("Hash Üretimi (Task 2.1)", () => {
    it("benzersiz 32 karakterlik hash üretmeli", async () => {
      // Arrange
      reservationRepository.findOne.mockResolvedValue(null); // Collision yok

      // Act
      const hash = await service.generateHash(
        "event-1",
        "table-1",
        "customer-1"
      );

      // Assert
      expect(hash).toHaveLength(32);
      expect(/^[a-f0-9]{32}$/i.test(hash)).toBe(true);
    });

    it("farklı inputlar için farklı hash üretmeli", async () => {
      // Arrange
      reservationRepository.findOne.mockResolvedValue(null);

      // Act
      const hash1 = await service.generateHash(
        "event-1",
        "table-1",
        "customer-1"
      );
      const hash2 = await service.generateHash(
        "event-1",
        "table-1",
        "customer-2"
      );

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Hash Validasyonu", () => {
    it("geçerli hash için true döndürmeli", () => {
      expect(service.validateHash("abc123def456abc123def456abc12345")).toBe(
        true
      );
    });

    it("geçersiz uzunlukta hash için false döndürmeli", () => {
      expect(service.validateHash("abc123")).toBe(false);
      expect(service.validateHash("")).toBe(false);
    });

    it("geçersiz karakterli hash için false döndürmeli", () => {
      expect(service.validateHash("xyz123def456abc123def456abc12345")).toBe(
        false
      );
    });
  });

  describe("QR İçerik Encode/Decode (Task 2.3)", () => {
    it("içeriği doğru encode etmeli", () => {
      // Arrange
      const content: QRCodeContent = {
        eventId: "event-1",
        tableId: "table-1",
        qrCodeHash: "abc123def456abc123def456abc12345",
      };

      // Act
      const encoded = service.encodeQRContent(content);

      // Assert
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe("string");
    });

    it("encode edilmiş içeriği doğru decode etmeli", () => {
      // Arrange
      const content: QRCodeContent = {
        eventId: "event-1",
        tableId: "table-1",
        qrCodeHash: "abc123def456abc123def456abc12345",
      };

      // Act
      const encoded = service.encodeQRContent(content);
      const decoded = service.decodeQRContent(encoded);

      // Assert
      expect(decoded).toEqual(content);
    });

    it("geçersiz encoded data için null döndürmeli", () => {
      expect(service.decodeQRContent("invalid-base64!!!")).toBeNull();
    });
  });

  describe("QR Kod Üretimi (Task 2.5 - Idempotence)", () => {
    it("aynı rezervasyon için aynı QR kod döndürmeli", async () => {
      // Act
      const result1 = await service.generateQRCode(
        mockReservation as Reservation
      );
      const result2 = await service.generateQRCode(
        mockReservation as Reservation
      );

      // Assert
      expect(result1.qrCodeDataUrl).toBe(result2.qrCodeDataUrl);
      expect(result1.content).toEqual(result2.content);
    });

    it("QR kod içeriği eventId, tableId, qrCodeHash içermeli", async () => {
      // Act
      const result = await service.generateQRCode(
        mockReservation as Reservation
      );

      // Assert
      expect(result.content.eventId).toBe("event-1");
      expect(result.content.tableId).toBe("table-1");
      expect(result.content.qrCodeHash).toBe(
        "abc123def456abc123def456abc12345"
      );
    });

    it("QR kod data URL formatında olmalı", async () => {
      // Act
      const result = await service.generateQRCode(
        mockReservation as Reservation
      );

      // Assert
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });
});
