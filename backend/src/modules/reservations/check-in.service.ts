import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import {
  TableNotAvailableException,
  InvalidCheckInException,
  CapacityExceededException,
} from "./exceptions/reservation.exceptions";
import { QREngineService } from "./qr-engine.service";
import { RealtimeGateway, CheckInRecord } from "../realtime/realtime.gateway";
import { findTableLocation } from "./table-location.helper";
import { ReservationStatsService } from "./reservation-stats.service";

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private qrEngineService: QREngineService,
    private realtimeGateway: RealtimeGateway,
    private statsService: ReservationStatsService,
  ) {}

  /**
   * QR kod hash'i ile rezervasyon bul
   * Requirement: 4.1 - QR kod ile rezervasyon detaylarını getir
   */
  async findByQRCode(qrCodeHash: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { qrCodeHash },
      relations: ["customer", "event"],
    });
    if (!reservation) {
      throw new NotFoundException(`Rezervasyon bulunamadı: ${qrCodeHash}`);
    }
    return reservation;
  }

  /**
   * QR kod ile rezervasyon detaylarını ve masa lokasyonunu getir
   * Requirement: 4.1, 4.5 - Check-in öncesi rezervasyon doğrulama
   */
  async getReservationByQRCode(qrCodeHash: string): Promise<{
    reservation: Reservation;
    tableLocation: { x: number; y: number; label: string } | null;
  }> {
    const reservation = await this.findByQRCode(qrCodeHash);
    const tableLocation = findTableLocation(
      reservation.event?.venueLayout,
      reservation.tableId,
    );
    return { reservation, tableLocation };
  }

  /**
   * Check-in işlemi
   * Requirements: 4.2, 4.3, 4.4, 4.5, 5.2
   */
  async checkIn(qrCodeHash: string): Promise<{
    success: boolean;
    message: string;
    reservation: Reservation;
    tableLocation: { x: number; y: number; label: string } | null;
  }> {
    const reservation = await this.findByQRCode(qrCodeHash);

    // Zaten check-in yapılmış (Requirement 4.3)
    if (reservation.status === ReservationStatus.CHECKED_IN) {
      throw new InvalidCheckInException(reservation.status);
    }

    // İptal edilmiş rezervasyon (Requirement 4.4)
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new InvalidCheckInException(reservation.status);
    }

    // Check-in yap (Requirement 4.2)
    reservation.status = ReservationStatus.CHECKED_IN;
    reservation.checkInTime = new Date();
    await this.reservationRepository.save(reservation);

    // Müşteri istatistiklerini güncelle
    if (reservation.customerId && reservation.customer) {
      try {
        reservation.customer.totalAttendedEvents =
          (reservation.customer.totalAttendedEvents || 0) + 1;
        reservation.customer.lastEventId = reservation.eventId;
        reservation.customer.lastEventDate = new Date();
        await this.reservationRepository.manager.save(reservation.customer);
      } catch (err) {
        this.logger.warn(`Müşteri istatistik güncelleme hatası: ${err}`);
      }
    }

    // Masa lokasyonunu al (Requirement 4.5)
    const tableLocation = findTableLocation(
      reservation.event?.venueLayout,
      reservation.tableId,
    );

    // Real-time güncelleme gönder (Requirement 5.2)
    this.broadcastCheckIn(reservation, tableLocation);

    return {
      success: true,
      message: `Check-in başarılı! Masa: ${
        tableLocation?.label || reservation.tableId
      }`,
      reservation,
      tableLocation,
    };
  }

  /**
   * Check-in için etkinlik verilerini getir
   * Event detayları, tüm rezervasyonlar ve istatistikler
   * Requirement: Check-in Module 1.1, 1.2
   */
  async getEventForCheckIn(eventId: string): Promise<{
    event: {
      id: string;
      name: string;
      eventDate: Date;
      totalCapacity: number;
      checkedInCount: number;
      venueLayout: any;
    };
    reservations: Reservation[];
    stats: {
      totalExpected: number;
      checkedIn: number;
      remaining: number;
      cancelled: number;
      noShow: number;
      checkInPercentage: number;
    };
  }> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Etkinlik bulunamadı: ${eventId}`);
    }

    // Tüm rezervasyonları getir (customer ve table bilgileriyle)
    const reservations = await this.reservationRepository.find({
      where: { eventId },
      relations: ["customer"],
      order: { createdAt: "DESC" },
    });

    // Masa bilgilerini rezervasyonlara ekle
    const reservationsWithTables = reservations.map((r) => {
      const table = event.venueLayout?.tables?.find((t) => t.id === r.tableId);
      return {
        ...r,
        table: table
          ? {
              id: table.id,
              label: table.label,
              x: table.x,
              y: table.y,
              capacity: table.capacity,
              section: (table as any).section,
            }
          : null,
      };
    });

    // İstatistikleri hafızadaki rezervasyonlardan hesapla
    let _checkedIn = 0,
      _cancelled = 0,
      _noShow = 0,
      _pending = 0,
      _confirmed = 0;
    for (const r of reservations) {
      switch (r.status) {
        case ReservationStatus.CHECKED_IN:
          _checkedIn++;
          break;
        case ReservationStatus.CANCELLED:
          _cancelled++;
          break;
        case ReservationStatus.NO_SHOW:
          _noShow++;
          break;
        case ReservationStatus.PENDING:
          _pending++;
          break;
        case ReservationStatus.CONFIRMED:
          _confirmed++;
          break;
      }
    }
    const stats = {
      totalExpected: _pending + _confirmed + _checkedIn,
      checkedIn: _checkedIn,
      remaining: _pending + _confirmed,
      cancelled: _cancelled,
      noShow: _noShow,
    };
    const checkInPercentage =
      stats.totalExpected > 0
        ? Math.round((stats.checkedIn / stats.totalExpected) * 100)
        : 0;

    // Toplam kapasite hesapla
    const totalCapacity =
      event.venueLayout?.tables?.reduce(
        (sum, t) => sum + (t.capacity || 0),
        0,
      ) || 0;

    return {
      event: {
        id: event.id,
        name: event.name,
        eventDate: event.eventDate,
        totalCapacity,
        checkedInCount: stats.checkedIn,
        venueLayout: event.venueLayout,
      },
      reservations: reservationsWithTables as any,
      stats: {
        ...stats,
        checkInPercentage,
      },
    };
  }

  /**
   * Check-in geçmişi - Son check-in yapan misafirler
   * Requirement: Check-in Module 6.1, 6.2, 6.3
   */
  async getCheckInHistory(
    eventId: string,
    limit = 20,
  ): Promise<
    Array<{
      reservationId: string;
      guestName: string;
      tableLabel: string;
      guestCount: number;
      checkInTime: string;
      isVIP: boolean;
    }>
  > {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Etkinlik bulunamadı: ${eventId}`);
    }

    const reservations = await this.reservationRepository.find({
      where: {
        eventId,
        status: ReservationStatus.CHECKED_IN,
      },
      relations: ["customer"],
      order: { checkInTime: "DESC" },
      take: limit,
    });

    return reservations.map((r) => {
      const table = event?.venueLayout?.tables?.find((t) => t.id === r.tableId);
      return {
        reservationId: r.id,
        guestName: r.customer?.fullName || r.guestName || "Misafir",
        tableLabel: table?.label || r.tableId,
        guestCount: r.guestCount,
        checkInTime: r.checkInTime?.toISOString() || "",
        isVIP: (r.customer?.vipScore || 0) > 0,
      };
    });
  }

  /**
   * Müsait masaları getir - Walk-in için
   * Requirement: Check-in Module 11.3
   */
  async getAvailableTables(
    eventId: string,
  ): Promise<Array<{ id: string; label: string; capacity: number }>> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event?.venueLayout?.tables) {
      return [];
    }

    // Aktif rezervasyonu olan masaları bul (sadece tableId, distinct)
    const occupiedRows = await this.reservationRepository
      .createQueryBuilder("r")
      .select("DISTINCT r.tableId", "tableId")
      .where("r.eventId = :eventId", { eventId })
      .andWhere("r.status NOT IN (:...statuses)", {
        statuses: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
      })
      .getRawMany();

    const occupiedTableIds = new Set(occupiedRows.map((r: any) => r.tableId));

    // Müsait masaları filtrele
    return event.venueLayout.tables
      .filter((table) => !occupiedTableIds.has(table.id))
      .map((table) => ({
        id: table.id,
        label: table.label || table.id,
        capacity: table.capacity || 4,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }

  /**
   * Walk-in misafir kaydı - Kapıda gelen misafir
   * Requirement: Check-in Module 11.1, 11.2, 11.4
   */
  async registerWalkIn(dto: {
    eventId: string;
    guestName: string;
    guestCount: number;
    tableId: string;
    phone?: string;
  }): Promise<{
    reservation: Reservation;
    tableLocation: { x: number; y: number; label: string } | null;
  }> {
    // Event'i al (kapasite kontrolü ve lokasyon için)
    const event = await this.eventRepository.findOne({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Etkinlik bulunamadı: ${dto.eventId}`);
    }

    // Masa müsaitlik kontrolü
    const occupiedTables = await this.reservationRepository.find({
      where: {
        eventId: dto.eventId,
        tableId: dto.tableId,
        status: Not(
          In([ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW]),
        ),
      },
    });
    if (occupiedTables.length > 0) {
      throw new TableNotAvailableException(dto.tableId);
    }

    // Kapasite kontrolü
    const capacity = this.getTableCapacityFromLayout(
      event.venueLayout,
      dto.tableId,
    );
    if (capacity && dto.guestCount > capacity) {
      throw new CapacityExceededException(dto.guestCount, capacity);
    }

    // QR kod hash oluştur
    const qrCodeHash = await this.qrEngineService.generateHash(
      dto.eventId,
      dto.tableId,
      `walkin-${Date.now()}`,
    );

    // Rezervasyon oluştur ve direkt check-in yap
    const reservation = this.reservationRepository.create({
      eventId: dto.eventId,
      tableId: dto.tableId,
      guestName: dto.guestName,
      guestPhone: dto.phone,
      guestCount: dto.guestCount,
      qrCodeHash,
      status: ReservationStatus.CHECKED_IN,
      checkInTime: new Date(),
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    const tableLocation = findTableLocation(event.venueLayout, dto.tableId);

    // Real-time güncelleme
    this.broadcastCheckIn(
      { ...savedReservation, guestName: dto.guestName },
      tableLocation,
    );

    return {
      reservation: savedReservation,
      tableLocation,
    };
  }

  /**
   * Kişi sayısı güncelle
   * Requirement: Check-in Module 12.1
   */
  async updateGuestCount(
    reservationId: string,
    guestCount: number,
  ): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
      relations: ["customer", "event"],
    });

    if (!reservation) {
      throw new NotFoundException(`Rezervasyon bulunamadı: ${reservationId}`);
    }

    // Kapasite kontrolü (uyarı ver ama engelleme)
    const capacity = this.getTableCapacityFromLayout(
      reservation.event?.venueLayout,
      reservation.tableId,
    );

    reservation.guestCount = guestCount;
    const updated = await this.reservationRepository.save(reservation);

    if (capacity && guestCount > capacity) {
      this.logger.warn(
        `Kapasite aşımı: Rezervasyon ${reservationId}, ${guestCount}/${capacity}`,
      );
    }

    return updated;
  }

  // ==================== PRIVATE HELPERS ====================

  private getTableCapacityFromLayout(
    venueLayout: any,
    tableId: string,
  ): number | null {
    if (!venueLayout?.tables) return null;
    const table = venueLayout.tables.find((t: any) => t.id === tableId);
    return table?.capacity ?? null;
  }

  private broadcastCheckIn(
    reservation: Partial<Reservation> & {
      id: string;
      eventId: string;
      tableId: string;
      guestCount: number;
    },
    tableLocation: { x: number; y: number; label: string } | null,
  ): void {
    this.statsService
      .getEventStats(reservation.eventId)
      .then((stats) => {
        const checkInRecord: CheckInRecord = {
          reservationId: reservation.id,
          tableId: reservation.tableId,
          tableLabel: tableLocation?.label,
          customerName:
            (reservation as any).customer?.fullName ||
            reservation.guestName ||
            "Bilinmeyen Misafir",
          guestCount: reservation.guestCount,
          checkInTime:
            (reservation as any).checkInTime?.toISOString?.() ||
            new Date().toISOString(),
        };

        this.realtimeGateway.broadcastCheckInWithStats(
          reservation.eventId,
          stats,
          checkInRecord,
        );
      })
      .catch((error) => {
        this.logger.warn("Real-time broadcast hatası:", error);
      });
  }
}
