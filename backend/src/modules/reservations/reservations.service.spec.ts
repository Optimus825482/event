import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReservationsService } from "./reservations.service";
import { QREngineService } from "./qr-engine.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { Customer } from "../../entities/customer.entity";
import {
  CapacityExceededException,
  TableNotAvailableException,
  InvalidCheckInException,
} from "./exceptions/reservation.exceptions";

/**
 * ReservationsService Unit Tests
 * Checkpoint 3: Tamamlanan görevlerin temel testleri
 */
describe("ReservationsService", () => {
  let service: ReservationsService;
  let reservationRepository: jest.Mocked<Repository<Reservation>>;
  let eventRepository: jest.Mocked<Repository<Event>>;
  let customerRepository: jest.Mocked<Repository<Customer>>;
  let qrEngineService: jest.Mocked<QREngineService>;
  let realtimeGateway: jest.Mocked<RealtimeGateway>;

  // Mock data
  const mockCustomer: Partial<Customer> = {
    id: "customer-1",
    fullName: "Test Müşteri",
    phone: "5551234567",
    email: "test@example.com",
    vipScore: 50,
    isBlacklisted: false,
    totalSpent: 1000,
    tags: [],
  };

  const mockEvent: Partial<Event> = {
    id: "event-1",
    venueLayout: {
      tables: [
        {
          id: "table-1",
          type: "rectangle",
          x: 0,
          y: 0,
          rotation: 0,
          capacity: 4,
          label: "T1",
        },
        {
          id: "table-2",
          type: "rectangle",
          x: 100,
          y: 0,
          rotation: 0,
          capacity: 6,
          label: "T2",
        },
      ],
      walls: [],
      stage: { x: 0, y: 0, width: 200, height: 100 },
      dimensions: { width: 800, height: 600 },
    },
  };

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
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Event),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: QREngineService,
          useValue: {
            generateHash: jest.fn(),
            generateQRCode: jest.fn(),
          },
        },
        {
          provide: RealtimeGateway,
          useValue: {
            broadcastStats: jest.fn(),
            broadcastCheckInWithStats: jest.fn(),
            broadcastRecentCheckIns: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    reservationRepository = module.get(getRepositoryToken(Reservation));
    eventRepository = module.get(getRepositoryToken(Event));
    customerRepository = module.get(getRepositoryToken(Customer));
    qrEngineService = module.get(QREngineService);
    realtimeGateway = module.get(RealtimeGateway);
  });

  describe("Kapasite Validasyonu (Task 1.1)", () => {
    it("kapasite aşıldığında CapacityExceededException fırlatmalı", async () => {
      // Arrange
      customerRepository.findOne.mockResolvedValue(mockCustomer as Customer);
      eventRepository.findOne.mockResolvedValue(mockEvent as Event);

      const dto = {
        eventId: "event-1",
        tableId: "table-1", // capacity: 4
        customerId: "customer-1",
        guestCount: 10, // Kapasite aşımı
      };

      // Mock query builder for isTableAvailable
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      reservationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any
      );

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(
        CapacityExceededException
      );
    });

    it("kapasite dahilinde rezervasyon oluşturmalı", async () => {
      // Arrange
      customerRepository.findOne.mockResolvedValue(mockCustomer as Customer);
      eventRepository.findOne.mockResolvedValue(mockEvent as Event);
      qrEngineService.generateHash.mockResolvedValue(
        "newhash12345678901234567890123"
      );

      const dto = {
        eventId: "event-1",
        tableId: "table-1", // capacity: 4
        customerId: "customer-1",
        guestCount: 3, // Kapasite dahilinde
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      reservationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any
      );
      reservationRepository.create.mockReturnValue({
        ...dto,
        qrCodeHash: "newhash12345678901234567890123",
      } as Reservation);
      reservationRepository.save.mockResolvedValue({
        ...dto,
        id: "new-res",
        qrCodeHash: "newhash12345678901234567890123",
      } as Reservation);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toBeDefined();
      expect(result.guestCount).toBe(3);
    });
  });

  describe("Masa Müsaitlik Kontrolü (Task 1.3)", () => {
    it("masa dolu ise TableNotAvailableException fırlatmalı", async () => {
      // Arrange
      customerRepository.findOne.mockResolvedValue(mockCustomer as Customer);
      eventRepository.findOne.mockResolvedValue(mockEvent as Event);

      const dto = {
        eventId: "event-1",
        tableId: "table-1",
        customerId: "customer-2",
        guestCount: 2,
      };

      // Masa dolu - mevcut rezervasyon var
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockReservation), // Mevcut rezervasyon
      };
      reservationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any
      );

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(
        TableNotAvailableException
      );
    });
  });

  describe("İptal İşlemi (Task 1.5)", () => {
    it("iptal edilen rezervasyon CANCELLED durumuna geçmeli", async () => {
      // Arrange
      const pendingReservation = {
        ...mockReservation,
        status: ReservationStatus.PENDING,
      };
      reservationRepository.findOne.mockResolvedValue(
        pendingReservation as Reservation
      );
      reservationRepository.save.mockImplementation(
        async (res) => res as Reservation
      );

      // Act
      const result = await service.cancel("res-1");

      // Assert
      expect(result.status).toBe(ReservationStatus.CANCELLED);
    });
  });

  describe("Check-in İşlemi (Task 4.3, 4.5)", () => {
    it("zaten check-in yapılmış rezervasyon için hata fırlatmalı", async () => {
      // Arrange
      const checkedInReservation = {
        ...mockReservation,
        status: ReservationStatus.CHECKED_IN,
      };
      reservationRepository.findOne.mockResolvedValue(
        checkedInReservation as Reservation
      );

      // Act & Assert
      await expect(
        service.checkIn("abc123def456abc123def456abc12345")
      ).rejects.toThrow(InvalidCheckInException);
    });

    it("iptal edilmiş rezervasyon için hata fırlatmalı", async () => {
      // Arrange
      const cancelledReservation = {
        ...mockReservation,
        status: ReservationStatus.CANCELLED,
      };
      reservationRepository.findOne.mockResolvedValue(
        cancelledReservation as Reservation
      );

      // Act & Assert
      await expect(
        service.checkIn("abc123def456abc123def456abc12345")
      ).rejects.toThrow(InvalidCheckInException);
    });

    it("geçerli rezervasyon için check-in başarılı olmalı", async () => {
      // Arrange
      const pendingReservation = {
        ...mockReservation,
        status: ReservationStatus.PENDING,
        customer: mockCustomer,
      };
      reservationRepository.findOne.mockResolvedValue(
        pendingReservation as Reservation
      );
      reservationRepository.save.mockImplementation(
        async (res) => res as Reservation
      );
      // Mock getEventStats için find
      reservationRepository.find = jest
        .fn()
        .mockResolvedValue([pendingReservation]);

      // Act
      const result = await service.checkIn("abc123def456abc123def456abc12345");

      // Assert
      expect(result.success).toBe(true);
      expect(result.reservation.status).toBe(ReservationStatus.CHECKED_IN);
      expect(result.reservation.checkInTime).toBeDefined();
      // Real-time broadcast çağrıldığını doğrula
      expect(realtimeGateway.broadcastCheckInWithStats).toHaveBeenCalled();
    });
  });

  describe("Event İstatistikleri (Task 8.1)", () => {
    it("event istatistiklerini doğru hesaplamalı", async () => {
      // Arrange
      const reservations = [
        { ...mockReservation, status: ReservationStatus.PENDING },
        {
          ...mockReservation,
          id: "res-2",
          status: ReservationStatus.CONFIRMED,
        },
        {
          ...mockReservation,
          id: "res-3",
          status: ReservationStatus.CHECKED_IN,
        },
        {
          ...mockReservation,
          id: "res-4",
          status: ReservationStatus.CANCELLED,
        },
        { ...mockReservation, id: "res-5", status: ReservationStatus.NO_SHOW },
      ];
      reservationRepository.find = jest.fn().mockResolvedValue(reservations);

      // Act
      const stats = await service.getEventStats("event-1");

      // Assert
      expect(stats.totalExpected).toBe(3); // pending + confirmed + checkedIn
      expect(stats.checkedIn).toBe(1);
      expect(stats.remaining).toBe(2); // pending + confirmed
      expect(stats.cancelled).toBe(1);
      expect(stats.noShow).toBe(1);
    });

    it("boş event için sıfır istatistik döndürmeli", async () => {
      // Arrange
      reservationRepository.find = jest.fn().mockResolvedValue([]);

      // Act
      const stats = await service.getEventStats("event-empty");

      // Assert
      expect(stats.totalExpected).toBe(0);
      expect(stats.checkedIn).toBe(0);
      expect(stats.remaining).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.noShow).toBe(0);
    });
  });
});
