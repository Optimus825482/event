import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { Customer } from "../../entities/customer.entity";
import {
  CreateReservationDto,
  UpdateReservationDto,
  ReservationFiltersDto,
} from "./dto/reservation.dto";
import {
  ReservationNotFoundException,
  TableNotAvailableException,
  CapacityExceededException,
  InvalidCheckInException,
} from "./exceptions/reservation.exceptions";
import { QREngineService } from "./qr-engine.service";
import { RealtimeGateway, CheckInRecord } from "../realtime/realtime.gateway";
import { MailService } from "../mail/mail.service";

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private qrEngineService: QREngineService,
    private realtimeGateway: RealtimeGateway,
    private mailService: MailService
  ) {}

  /**
   * Event'ten masa kapasitesini al
   * @param eventId Event ID
   * @param tableId Masa ID (canvas üzerindeki)
   * @returns Masa kapasitesi veya null
   */
  private async getTableCapacity(
    eventId: string,
    tableId: string
  ): Promise<number | null> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event?.venueLayout?.tables) return null;

    const table = event.venueLayout.tables.find((t) => t.id === tableId);
    return table?.capacity ?? null;
  }

  /**
   * Masa müsaitlik kontrolü
   * @param eventId Event ID
   * @param tableId Masa ID
   * @param excludeReservationId Hariç tutulacak rezervasyon ID (güncelleme için)
   * @returns Masa müsait mi?
   */
  async isTableAvailable(
    eventId: string,
    tableId: string,
    excludeReservationId?: string
  ): Promise<boolean> {
    const queryBuilder = this.reservationRepository
      .createQueryBuilder("reservation")
      .where("reservation.eventId = :eventId", { eventId })
      .andWhere("reservation.tableId = :tableId", { tableId })
      .andWhere("reservation.status NOT IN (:...excludedStatuses)", {
        excludedStatuses: [
          ReservationStatus.CANCELLED,
          ReservationStatus.NO_SHOW,
        ],
      });

    // Güncelleme durumunda mevcut rezervasyonu hariç tut
    if (excludeReservationId) {
      queryBuilder.andWhere("reservation.id != :excludeId", {
        excludeId: excludeReservationId,
      });
    }

    const existingReservation = await queryBuilder.getOne();
    return !existingReservation;
  }

  /**
   * Kapasite validasyonu
   * @param eventId Event ID
   * @param tableId Masa ID
   * @param guestCount Misafir sayısı
   * @throws CapacityExceededException
   */
  private async validateCapacity(
    eventId: string,
    tableId: string,
    guestCount: number
  ): Promise<void> {
    const capacity = await this.getTableCapacity(eventId, tableId);

    // Kapasite bilgisi yoksa validasyonu atla (eski veriler için)
    if (capacity === null) return;

    if (guestCount > capacity) {
      throw new CapacityExceededException(guestCount, capacity);
    }
  }

  /**
   * Müşteri validasyonu - CRM entegrasyonu
   * Requirement: 1.5 - Müşteri ilişkilendirme
   * @param customerId Müşteri ID
   * @returns Customer entity
   * @throws NotFoundException
   */
  private async validateAndGetCustomer(customerId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Müşteri bulunamadı: ${customerId}`);
    }
    return customer;
  }

  /**
   * Yeni rezervasyon oluştur
   * Requirements: 1.2, 1.3, 1.4, 1.5
   */
  async create(dto: CreateReservationDto): Promise<Reservation> {
    let customer: Customer | null = null;

    // Boş string customerId'yi undefined'a çevir (UUID validasyonu için)
    let customerId =
      dto.customerId && dto.customerId.trim() !== ""
        ? dto.customerId
        : undefined;

    // Müşteri ID varsa validasyon yap (Requirement 1.5)
    if (customerId) {
      customer = await this.validateAndGetCustomer(customerId);
    } else if (dto.guestPhone || dto.guestEmail) {
      // Müşteri ID yoksa ama telefon/email varsa, müşteri bul veya oluştur
      const existingByPhone = dto.guestPhone
        ? await this.customerRepository.findOne({
            where: { phone: dto.guestPhone },
          })
        : null;
      const existingByEmail =
        !existingByPhone && dto.guestEmail
          ? await this.customerRepository.findOne({
              where: { email: dto.guestEmail },
            })
          : null;

      if (existingByPhone) {
        customer = existingByPhone;
        customerId = customer.id;
      } else if (existingByEmail) {
        customer = existingByEmail;
        customerId = customer.id;
      } else if (dto.guestName) {
        // Yeni müşteri oluştur
        const newCustomer = this.customerRepository.create({
          fullName: dto.guestName,
          phone: dto.guestPhone,
          email: dto.guestEmail,
        });
        customer = await this.customerRepository.save(newCustomer);
        customerId = customer.id;
      }
    }

    // Kapasite kontrolü (Requirement 1.2)
    await this.validateCapacity(dto.eventId, dto.tableId, dto.guestCount);

    // Masa müsaitlik kontrolü (Requirement 1.3)
    const isAvailable = await this.isTableAvailable(dto.eventId, dto.tableId);
    if (!isAvailable) {
      throw new TableNotAvailableException(dto.tableId);
    }

    // QR kod hash'i oluştur - QREngineService kullan (Requirement 1.4)
    const uniqueId = customerId || dto.guestPhone || Date.now().toString();
    const qrCodeHash = await this.qrEngineService.generateHash(
      dto.eventId,
      dto.tableId,
      uniqueId
    );

    const reservation = this.reservationRepository.create({
      ...dto,
      customerId: customerId || null,
      qrCodeHash,
      status: ReservationStatus.CONFIRMED,
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    // Customer relation'ı yükle ve döndür
    if (customer) {
      savedReservation.customer = customer;
      // Müşteri rezervasyon sayısını artır
      customer.totalReservations = (customer.totalReservations || 0) + 1;
      await this.customerRepository.save(customer);
    }

    // E-posta bileti gönder (async - hata olsa bile rezervasyonu engelleme)
    this.sendTicketEmailAsync(savedReservation, dto.guestEmail);

    return savedReservation;
  }

  /**
   * Rezervasyon bileti e-postası gönder (async)
   * Mail gönderimi başarısız olsa bile rezervasyon işlemini engellemez
   */
  private async sendTicketEmailAsync(
    reservation: Reservation,
    guestEmail?: string
  ): Promise<void> {
    try {
      // E-posta adresi yoksa gönderme
      const email = guestEmail || reservation.guestEmail;
      if (!email) {
        this.logger.log(
          `Rezervasyon ${reservation.id}: E-posta adresi yok, mail gönderilmedi`
        );
        return;
      }

      // Event bilgisini al
      const event = await this.eventRepository.findOne({
        where: { id: reservation.eventId },
      });
      if (!event) {
        this.logger.warn(`Rezervasyon ${reservation.id}: Event bulunamadı`);
        return;
      }

      // Masa etiketini bul
      let tableLabel = reservation.tableId;
      if (event.venueLayout?.tables) {
        const table = event.venueLayout.tables.find(
          (t) => t.id === reservation.tableId
        );
        if (table?.label) {
          tableLabel = table.label;
        }
      }

      // QR kod oluştur
      const qrResult = await this.qrEngineService.generateQRCode(reservation);

      // Tarih formatla
      const eventDate = new Date(event.eventDate).toLocaleDateString("tr-TR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Mail gönder
      const result = await this.mailService.sendTicketEmail({
        guestName: reservation.guestName || "Değerli Misafir",
        guestEmail: email,
        eventName: event.name,
        eventDate,
        tableLabel,
        guestCount: reservation.guestCount,
        qrCodeDataUrl: qrResult.qrCodeDataUrl,
        reservationId: reservation.id,
      });

      if (result.success) {
        this.logger.log(
          `Bilet e-postası gönderildi: ${email} (${reservation.id})`
        );
      } else {
        this.logger.warn(`Bilet e-postası gönderilemedi: ${result.error}`);
      }
    } catch (error: any) {
      // Mail hatası rezervasyonu engellemez
      this.logger.error(`Mail gönderim hatası: ${error.message}`);
    }
  }

  /**
   * Tüm rezervasyonları getir - Arama ve filtreleme destekli
   * Requirements: 7.1, 7.2, 7.3, 7.4
   * @param filters Filtreleme parametreleri
   * @returns Filtrelenmiş rezervasyon listesi
   */
  async findAll(filters?: ReservationFiltersDto): Promise<Reservation[]> {
    const query = this.reservationRepository
      .createQueryBuilder("reservation")
      .leftJoinAndSelect("reservation.customer", "customer")
      .leftJoinAndSelect("reservation.event", "event")
      .orderBy("reservation.createdAt", "DESC");

    // Event filtresi (Requirement 7.4)
    if (filters?.eventId) {
      query.andWhere("reservation.eventId = :eventId", {
        eventId: filters.eventId,
      });
    }

    // Müşteri filtresi
    if (filters?.customerId) {
      query.andWhere("reservation.customerId = :customerId", {
        customerId: filters.customerId,
      });
    }

    // Status filtresi (Requirement 7.3)
    if (filters?.status) {
      query.andWhere("reservation.status = :status", {
        status: filters.status,
      });
    }

    // Masa filtresi
    if (filters?.tableId) {
      query.andWhere("reservation.tableId = :tableId", {
        tableId: filters.tableId,
      });
    }

    // Arama - İsim veya telefon ile partial match (Requirements 7.1, 7.2)
    if (filters?.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      query.andWhere(
        "(LOWER(customer.fullName) LIKE LOWER(:searchTerm) OR customer.phone LIKE :searchTerm OR LOWER(reservation.guestName) LIKE LOWER(:searchTerm) OR reservation.guestPhone LIKE :searchTerm)",
        { searchTerm }
      );
    }

    return query.getMany();
  }

  /**
   * Rezervasyon ara - İsim veya telefon ile
   * Requirements: 7.1, 7.2 - Partial match, case-insensitive arama
   * @param searchQuery Arama terimi (isim veya telefon)
   * @param eventId Opsiyonel event filtresi
   * @returns Eşleşen rezervasyonlar
   */
  async search(searchQuery: string, eventId?: string): Promise<Reservation[]> {
    const query = this.reservationRepository
      .createQueryBuilder("reservation")
      .leftJoinAndSelect("reservation.customer", "customer")
      .leftJoinAndSelect("reservation.event", "event")
      .orderBy("reservation.createdAt", "DESC");

    // Case-insensitive partial match arama
    const searchTerm = `%${searchQuery}%`;
    query.where(
      "(LOWER(customer.fullName) LIKE LOWER(:searchTerm) OR customer.phone LIKE :searchTerm)",
      { searchTerm }
    );

    // Opsiyonel event filtresi
    if (eventId) {
      query.andWhere("reservation.eventId = :eventId", { eventId });
    }

    return query.getMany();
  }

  /**
   * Rezervasyonları filtrele - Status ve event bazlı
   * Requirements: 7.3, 7.4 - Birden fazla filtre kombinasyonu
   * @param filters Filtre parametreleri
   * @returns Filtrelenmiş rezervasyonlar
   */
  async filter(filters: {
    status?: ReservationStatus;
    eventId?: string;
    tableId?: string;
  }): Promise<Reservation[]> {
    const query = this.reservationRepository
      .createQueryBuilder("reservation")
      .leftJoinAndSelect("reservation.customer", "customer")
      .leftJoinAndSelect("reservation.event", "event")
      .orderBy("reservation.createdAt", "DESC");

    // Status filtresi (Requirement 7.3)
    if (filters.status) {
      query.andWhere("reservation.status = :status", {
        status: filters.status,
      });
    }

    // Event filtresi (Requirement 7.4)
    if (filters.eventId) {
      query.andWhere("reservation.eventId = :eventId", {
        eventId: filters.eventId,
      });
    }

    // Masa filtresi
    if (filters.tableId) {
      query.andWhere("reservation.tableId = :tableId", {
        tableId: filters.tableId,
      });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ["customer", "event"],
    });
    if (!reservation) {
      throw new ReservationNotFoundException(id);
    }
    return reservation;
  }

  /**
   * QR kod hash'i ile rezervasyon bul
   * Requirement: 4.1 - QR kod ile rezervasyon detaylarını getir
   * @param qrCodeHash QR kod hash değeri
   * @returns Rezervasyon ve ilişkili veriler (customer, event)
   */
  async findByQRCode(qrCodeHash: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { qrCodeHash },
      relations: ["customer", "event"],
    });
    if (!reservation) {
      throw new ReservationNotFoundException(qrCodeHash);
    }
    return reservation;
  }

  /**
   * QR kod ile rezervasyon detaylarını ve masa lokasyonunu getir
   * Requirement: 4.1, 4.5 - Check-in öncesi rezervasyon doğrulama
   * @param qrCodeHash QR kod hash değeri
   * @returns Rezervasyon detayları ve masa lokasyonu
   */
  async getReservationByQRCode(qrCodeHash: string): Promise<{
    reservation: Reservation;
    tableLocation: { x: number; y: number; label: string } | null;
  }> {
    const reservation = await this.findByQRCode(qrCodeHash);

    // Masa lokasyonunu event'ten al
    let tableLocation: { x: number; y: number; label: string } | null = null;
    if (reservation.event?.venueLayout?.tables) {
      const table = reservation.event.venueLayout.tables.find(
        (t) => t.id === reservation.tableId
      );
      if (table) {
        tableLocation = {
          x: table.x,
          y: table.y,
          label: table.label || reservation.tableId,
        };
      }
    }

    return { reservation, tableLocation };
  }

  /**
   * Rezervasyon güncelle
   * Requirements: 2.1, 2.2, 2.4
   */
  async update(id: string, dto: UpdateReservationDto): Promise<Reservation> {
    const reservation = await this.findOne(id);

    // Misafir sayısı güncelleniyorsa kapasite kontrolü (Requirement 2.1)
    if (dto.guestCount !== undefined) {
      const tableId = dto.tableId ?? reservation.tableId;
      await this.validateCapacity(reservation.eventId, tableId, dto.guestCount);
    }

    // Masa değişiyorsa müsaitlik kontrolü (Requirement 2.2)
    if (dto.tableId && dto.tableId !== reservation.tableId) {
      const isAvailable = await this.isTableAvailable(
        reservation.eventId,
        dto.tableId,
        id // Mevcut rezervasyonu hariç tut
      );
      if (!isAvailable) {
        throw new TableNotAvailableException(dto.tableId);
      }

      // Yeni masa için de kapasite kontrolü
      const guestCount = dto.guestCount ?? reservation.guestCount;
      await this.validateCapacity(reservation.eventId, dto.tableId, guestCount);
    }

    // QR kod hash'i korunur (Requirement 2.4)
    // dto'dan qrCodeHash'i açıkça çıkar - asla güncellenmemeli
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { qrCodeHash: _ignoredHash, ...updateData } =
      dto as UpdateReservationDto & { qrCodeHash?: string };

    Object.assign(reservation, updateData);
    return this.reservationRepository.save(reservation);
  }

  /**
   * Rezervasyon iptal et
   * Requirement: 2.3
   */
  async cancel(id: string): Promise<Reservation> {
    const reservation = await this.findOne(id);

    // Status'u cancelled yap - masa otomatik olarak müsait olur
    // çünkü isTableAvailable CANCELLED durumunu hariç tutar
    reservation.status = ReservationStatus.CANCELLED;

    return this.reservationRepository.save(reservation);
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
    if (reservation.customerId) {
      try {
        const customer = await this.customerRepository.findOne({
          where: { id: reservation.customerId },
        });
        if (customer) {
          customer.totalAttendedEvents =
            (customer.totalAttendedEvents || 0) + 1;
          customer.lastEventId = reservation.eventId;
          customer.lastEventDate = new Date();
          await this.customerRepository.save(customer);
        }
      } catch (err) {
        this.logger.warn(`Müşteri istatistik güncelleme hatası: ${err}`);
      }
    }

    // Masa lokasyonunu al (Requirement 4.5)
    let tableLocation: { x: number; y: number; label: string } | null = null;
    if (reservation.event?.venueLayout?.tables) {
      const table = reservation.event.venueLayout.tables.find(
        (t) => t.id === reservation.tableId
      );
      if (table) {
        tableLocation = {
          x: table.x,
          y: table.y,
          label: table.label || reservation.tableId,
        };
      }
    }

    // Real-time güncelleme gönder (Requirement 5.2)
    // Check-in sonrası 2 saniye içinde stats güncellemesi
    try {
      const stats = await this.getEventStats(reservation.eventId);
      const checkInRecord: CheckInRecord = {
        reservationId: reservation.id,
        tableId: reservation.tableId,
        tableLabel: tableLocation?.label,
        customerName: reservation.customer?.fullName || "Bilinmeyen Misafir",
        guestCount: reservation.guestCount,
        checkInTime: reservation.checkInTime.toISOString(),
      };

      // Socket.io üzerinden broadcast et
      this.realtimeGateway.broadcastCheckInWithStats(
        reservation.eventId,
        stats,
        checkInRecord
      );
    } catch (error) {
      // Socket.io hatası check-in işlemini engellemez
      console.error("Real-time broadcast hatası:", error);
    }

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
   * QR kod oluştur
   * Requirements: 3.2, 3.4
   */
  async generateQRCode(id: string) {
    const reservation = await this.findOne(id);

    // QREngineService kullan - idempotent ve doğru içerik yapısı
    const qrResult = await this.qrEngineService.generateQRCode(reservation);

    return {
      qrCodeDataUrl: qrResult.qrCodeDataUrl,
      content: qrResult.content,
      reservation,
    };
  }

  async delete(id: string) {
    const reservation = await this.findOne(id);
    await this.reservationRepository.remove(reservation);
    return { message: "Rezervasyon silindi" };
  }

  async getByTable(
    eventId: string,
    tableId: string
  ): Promise<Reservation | null> {
    return this.reservationRepository.findOne({
      where: {
        eventId,
        tableId,
        status: Not(
          In([ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW])
        ),
      },
      relations: ["customer"],
    });
  }

  /**
   * Müşteri geçmişi getir - CRM Entegrasyonu
   * Requirement: 6.1 - Müşteri event geçmişi ve VIP score
   * @param customerId Müşteri ID
   * @returns Müşteri bilgileri, VIP score ve event geçmişi
   */
  async getCustomerHistory(customerId: string): Promise<{
    customer: Customer;
    vipScore: number;
    eventHistory: Array<{
      eventId: string;
      eventName: string;
      eventDate: Date;
      tableId: string;
      status: ReservationStatus;
      guestCount: number;
    }>;
    totalReservations: number;
    totalSpent: number;
    tags: string[];
  }> {
    // Müşteri ve rezervasyonlarını getir
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Müşteri bulunamadı: ${customerId}`);
    }

    // Müşterinin tüm rezervasyonlarını event bilgileriyle getir
    const reservations = await this.reservationRepository.find({
      where: { customerId },
      relations: ["event"],
      order: { createdAt: "DESC" },
    });

    // Event geçmişini oluştur
    const eventHistory = reservations.map((r) => ({
      eventId: r.eventId,
      eventName: r.event?.name || "Bilinmeyen Etkinlik",
      eventDate: r.event?.eventDate || r.createdAt,
      tableId: r.tableId,
      status: r.status,
      guestCount: r.guestCount,
    }));

    return {
      customer,
      vipScore: customer.vipScore,
      eventHistory,
      totalReservations: reservations.length,
      totalSpent: customer.totalSpent,
      tags: customer.tags,
    };
  }

  /**
   * Blacklist kontrolü - CRM Entegrasyonu
   * Requirement: 6.2 - Kara listedeki müşteri uyarısı
   * @param customerId Müşteri ID
   * @returns Blacklist durumu ve uyarı mesajı
   */
  async checkBlacklistStatus(customerId: string): Promise<{
    isBlacklisted: boolean;
    warning: string | null;
    customer: Customer;
  }> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Müşteri bulunamadı: ${customerId}`);
    }

    return {
      isBlacklisted: customer.isBlacklisted,
      warning: customer.isBlacklisted
        ? `⚠️ UYARI: ${customer.fullName} kara listede! Rezervasyon yapmadan önce yönetici onayı alınız.`
        : null,
      customer,
    };
  }

  /**
   * Event istatistiklerini hesapla - Dashboard için
   * Requirement: 5.1 - totalExpected, checkedIn, remaining, cancelled, noShow
   * @param eventId Event ID
   * @returns EventStats objesi
   */
  async getEventStats(eventId: string): Promise<{
    totalExpected: number;
    checkedIn: number;
    remaining: number;
    cancelled: number;
    noShow: number;
  }> {
    // Event'e ait tüm rezervasyonları getir
    const reservations = await this.reservationRepository.find({
      where: { eventId },
    });

    // İstatistikleri hesapla
    let checkedIn = 0;
    let cancelled = 0;
    let noShow = 0;
    let pending = 0;
    let confirmed = 0;

    for (const reservation of reservations) {
      switch (reservation.status) {
        case ReservationStatus.CHECKED_IN:
          checkedIn++;
          break;
        case ReservationStatus.CANCELLED:
          cancelled++;
          break;
        case ReservationStatus.NO_SHOW:
          noShow++;
          break;
        case ReservationStatus.PENDING:
          pending++;
          break;
        case ReservationStatus.CONFIRMED:
          confirmed++;
          break;
      }
    }

    // totalExpected = pending + confirmed + checkedIn (aktif rezervasyonlar)
    // cancelled ve noShow hariç tutulur çünkü bunlar artık beklenen misafir değil
    const totalExpected = pending + confirmed + checkedIn;

    // remaining = henüz check-in yapmamış aktif rezervasyonlar
    const remaining = pending + confirmed;

    return {
      totalExpected,
      checkedIn,
      remaining,
      cancelled,
      noShow,
    };
  }

  /**
   * Müşteri bilgilerini rezervasyon için getir - CRM Entegrasyonu
   * Requirements: 6.1, 6.2, 6.3 - Tüm müşteri bilgilerini tek seferde getir
   * @param customerId Müşteri ID
   * @returns Müşteri detayları, geçmiş, blacklist durumu ve özel etiketler
   */
  async getCustomerInfoForReservation(customerId: string): Promise<{
    customer: Customer;
    vipScore: number;
    isBlacklisted: boolean;
    blacklistWarning: string | null;
    tags: string[];
    eventHistory: Array<{
      eventId: string;
      eventName: string;
      eventDate: Date;
      status: ReservationStatus;
    }>;
    totalReservations: number;
  }> {
    const [history, blacklistStatus] = await Promise.all([
      this.getCustomerHistory(customerId),
      this.checkBlacklistStatus(customerId),
    ]);

    return {
      customer: history.customer,
      vipScore: history.vipScore,
      isBlacklisted: blacklistStatus.isBlacklisted,
      blacklistWarning: blacklistStatus.warning,
      tags: history.tags,
      eventHistory: history.eventHistory.map((e) => ({
        eventId: e.eventId,
        eventName: e.eventName,
        eventDate: e.eventDate,
        status: e.status,
      })),
      totalReservations: history.totalReservations,
    };
  }
}
