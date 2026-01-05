import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event, EventStatus } from "../../entities/event.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import { EventExtraStaff } from "../../entities/event-extra-staff.entity";
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateLayoutDto,
} from "./dto/event.dto";
import {
  CreateEventExtraStaffDto,
  UpdateEventExtraStaffDto,
} from "./dto/event-extra-staff.dto";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(EventStaffAssignment)
    private eventStaffAssignmentRepository: Repository<EventStaffAssignment>,
    @InjectRepository(EventExtraStaff)
    private eventExtraStaffRepository: Repository<EventExtraStaff>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  async create(dto: CreateEventDto, organizerId: string) {
    const event = this.eventRepository.create({
      ...dto,
      organizerId,
      eventDate: new Date(dto.eventDate),
      eventEndDate: dto.eventEndDate ? new Date(dto.eventEndDate) : null,
    });
    const savedEvent = await this.eventRepository.save(event);

    // Bildirim gönder: Yeni etkinlik oluşturuldu
    try {
      await this.notificationsService.notifyEventCreated(
        savedEvent,
        organizerId
      );
    } catch {
      // Bildirim hatası ana işlemi etkilemesin
    }

    return savedEvent;
  }

  /**
   * Tüm etkinlikleri getir - OPTIMIZE EDİLDİ v4 + PAGINATION
   * - loadRelationCountAndMap ile relation sayıları tek sorguda
   * - N+1 query problemi çözüldü
   * - Pagination eklendi (sayfa başına 50 kayıt)
   * - tableGroups sadece count olarak alınıyor (full data değil)
   * - eventStaffAssignments için isActive=true filtresi eklendi
   *
   * @param organizerId - Organizatör ID (opsiyonel)
   * @param page - Sayfa numarası (default: 1)
   * @param limit - Sayfa başına kayıt sayısı (default: 50)
   * @returns Paginated event list with metadata
   */
  async findAll(organizerId?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoin("event.organizer", "organizer")
      .addSelect(["organizer.id", "organizer.fullName", "organizer.email"])
      .loadRelationCountAndMap("event.reservationCount", "event.reservations")
      .loadRelationCountAndMap("event.serviceTeamCount", "event.serviceTeams")
      .loadRelationCountAndMap(
        "event.staffAssignmentCount",
        "event.staffAssignments"
      )
      // eventStaffAssignments için isActive=true filtresi
      .loadRelationCountAndMap(
        "event.eventStaffAssignmentCount",
        "event.eventStaffAssignments",
        "activeStaffAssignments",
        (qb) =>
          qb.andWhere("activeStaffAssignments.isActive = :isActive", {
            isActive: true,
          })
      )
      .loadRelationCountAndMap("event.tableGroupCount", "event.tableGroups")
      .orderBy("event.eventDate", "DESC")
      .take(limit)
      .skip(skip);

    if (organizerId) {
      query.where("event.organizerId = :organizerId", { organizerId });
    }

    const [events, total] = await query.getManyAndCount();

    // hasVenueLayout ve hasTeamAssignment hesapla
    const items = events.map((event: any) => {
      const placedTables = (event.venueLayout as any)?.placedTables || [];
      const hasVenueLayout = placedTables.length > 0;

      // Basitleştirilmiş hasTeamAssignment kontrolü:
      // - Yerleşim planı var mı?
      // - En az bir masa grubu var mı?
      // - En az bir aktif personel ataması var mı?
      const hasTeamAssignment =
        hasVenueLayout &&
        (event.tableGroupCount || 0) > 0 &&
        (event.eventStaffAssignmentCount || 0) > 0;

      return {
        ...event,
        hasVenueLayout,
        hasTeamAssignment,
        reservedCount: event.reservationCount || 0,
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: [
        "organizer",
        "reservations",
        "staffAssignments",
        "serviceTeams",
        "tableGroups",
      ],
    });
    if (!event) throw new NotFoundException("Etkinlik bulunamadı");

    // Aktif personel atamalarını ayrı sorgula (isActive = true)
    const activeStaffAssignments =
      await this.eventStaffAssignmentRepository.find({
        where: { eventId: id, isActive: true },
      });

    // hasVenueLayout ve hasTeamAssignment hesapla
    const placedTables = (event.venueLayout as any)?.placedTables || [];

    // table_groups tablosundan gelen grupları kullan
    const tableGroups = (event as any).tableGroups || [];

    // Tüm masaların ID'lerini al
    const allTableIds = placedTables.map((t: any) => t.id);

    // Gruplara atanmış masa ID'lerini al
    const groupedTableIds = tableGroups.flatMap((g: any) => g.tableIds || []);

    // Tüm masalar gruplara atanmış mı kontrol et
    const allTablesGrouped =
      allTableIds.length > 0 &&
      allTableIds.every((id: string) => groupedTableIds.includes(id));

    // Aktif personel ataması var mı kontrol et
    const hasStaffAssignments = activeStaffAssignments.length > 0;

    return {
      ...event,
      eventStaffAssignments: activeStaffAssignments,
      hasVenueLayout: !!(placedTables.length > 0),
      hasTeamAssignment: allTablesGrouped && hasStaffAssignments,
    };
  }

  async update(id: string, dto: UpdateEventDto) {
    // Etkinliği bul, yoksa hata fırlat
    const event = await this.eventRepository.findOne({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Etkinlik bulunamadı: ${id}`);
    }

    // Güncelleme işlemi
    Object.assign(event, dto);
    if (dto.eventDate) event.eventDate = new Date(dto.eventDate);
    if (dto.eventEndDate) event.eventEndDate = new Date(dto.eventEndDate);

    return this.eventRepository.save(event);
  }

  async updateLayout(id: string, dto: UpdateLayoutDto, userId?: string) {
    const event = await this.findOne(id);
    const hadLayoutBefore = !!(
      event.venueLayout && (event.venueLayout as any).placedTables?.length > 0
    );

    event.venueLayout = dto.venueLayout as any;
    // Toplam kapasiteyi hesapla - yeni format: placedTables
    if (dto.venueLayout?.placedTables) {
      event.totalCapacity = dto.venueLayout.placedTables.reduce(
        (sum: number, table: any) => sum + (table.capacity || 0),
        0
      );
    }
    const savedEvent = await this.eventRepository.save(event);

    // Bildirim gönder: Mekan yerleşimi tamamlandı (ilk kez yerleşim yapıldıysa)
    const hasLayoutNow = (dto.venueLayout?.placedTables?.length ?? 0) > 0;
    if (!hadLayoutBefore && hasLayoutNow && userId) {
      try {
        await this.notificationsService.notifyVenueLayoutCompleted(
          savedEvent,
          userId
        );
      } catch {
        // Bildirim hatası ana işlemi etkilemesin
      }
    }

    return savedEvent;
  }

  async updateStatus(id: string, status: EventStatus) {
    const event = await this.findOne(id);
    event.status = status;
    return this.eventRepository.save(event);
  }

  async delete(id: string) {
    const event = await this.findOne(id);
    await this.eventRepository.remove(event);
    return { message: "Etkinlik silindi" };
  }

  async getStats(id: string) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ["reservations"],
    });
    if (!event) throw new NotFoundException("Etkinlik bulunamadı");

    const totalReservations = event.reservations?.length || 0;
    const checkedIn =
      event.reservations?.filter((r) => r.status === "checked_in").length || 0;
    const totalGuests =
      event.reservations?.reduce((sum, r) => sum + r.guestCount, 0) || 0;

    return {
      totalCapacity: event.totalCapacity,
      totalReservations,
      checkedIn,
      totalGuests,
      occupancyRate:
        event.totalCapacity > 0 ? (totalGuests / event.totalCapacity) * 100 : 0,
    };
  }

  // ==================== EKSTRA PERSONEL METODLARI ====================

  /**
   * Etkinliğin ekstra personellerini getir
   */
  async getExtraStaff(eventId: string): Promise<EventExtraStaff[]> {
    return this.eventExtraStaffRepository.find({
      where: { eventId, isActive: true },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * Ekstra personel ekle
   */
  async createExtraStaff(
    eventId: string,
    dto: CreateEventExtraStaffDto
  ): Promise<EventExtraStaff> {
    const extraStaff = this.eventExtraStaffRepository.create({
      ...dto,
      eventId,
    });
    return this.eventExtraStaffRepository.save(extraStaff);
  }

  /**
   * Ekstra personel güncelle
   */
  async updateExtraStaff(
    eventId: string,
    extraStaffId: string,
    dto: UpdateEventExtraStaffDto
  ): Promise<EventExtraStaff> {
    const extraStaff = await this.eventExtraStaffRepository.findOne({
      where: { id: extraStaffId, eventId },
    });

    if (!extraStaff) {
      throw new NotFoundException("Ekstra personel bulunamadı");
    }

    Object.assign(extraStaff, dto);
    return this.eventExtraStaffRepository.save(extraStaff);
  }

  /**
   * Ekstra personel sil
   */
  async deleteExtraStaff(eventId: string, extraStaffId: string): Promise<void> {
    const extraStaff = await this.eventExtraStaffRepository.findOne({
      where: { id: extraStaffId, eventId },
    });

    if (!extraStaff) {
      throw new NotFoundException("Ekstra personel bulunamadı");
    }

    await this.eventExtraStaffRepository.remove(extraStaff);
  }

  /**
   * Toplu ekstra personel kaydet (mevcut olanları sil, yenilerini ekle)
   */
  async saveExtraStaffBulk(
    eventId: string,
    extraStaffList: CreateEventExtraStaffDto[]
  ): Promise<EventExtraStaff[]> {
    // Mevcut ekstra personelleri sil
    await this.eventExtraStaffRepository.delete({ eventId });

    // Yenilerini ekle
    if (extraStaffList.length === 0) {
      return [];
    }

    const entities = extraStaffList.map((dto, index) =>
      this.eventExtraStaffRepository.create({
        ...dto,
        eventId,
        sortOrder: index,
      })
    );

    return this.eventExtraStaffRepository.save(entities);
  }

  /**
   * Check-in modülü için etkinlikleri getir
   * TÜM DRAFT ve PUBLISHED etkinlikleri döndürür
   * Tarih kısıtlaması YOK - tüm etkinlikler görünür
   */
  async getActiveEventsToday(): Promise<
    Array<{
      id: string;
      name: string;
      eventDate: Date;
      totalCapacity: number;
      checkedInCount: number;
      venueLayout: any;
      hasStaffAssignments: boolean;
      hasReservations: boolean;
    }>
  > {
    // Tüm DRAFT ve PUBLISHED etkinlikleri getir
    const events = await this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.reservations", "reservation")
      .leftJoinAndSelect("event.staffAssignments", "staffAssignment")
      .where("event.status IN (:...statuses)", {
        statuses: [EventStatus.DRAFT, EventStatus.PUBLISHED],
      })
      .orderBy("event.eventDate", "DESC") // En yeni etkinlikler önce
      .getMany();

    // Her etkinlik için istatistikleri hesapla
    return events.map((event) => {
      const reservations = event.reservations || [];
      const staffAssignments = event.staffAssignments || [];
      const checkedInCount = reservations.filter(
        (r) => r.status === "checked_in"
      ).length;
      const totalCapacity =
        event.venueLayout?.tables?.reduce(
          (sum: number, t: any) => sum + (t.capacity || 0),
          0
        ) || 0;

      return {
        id: event.id,
        name: event.name,
        eventDate: event.eventDate,
        totalCapacity,
        checkedInCount,
        venueLayout: event.venueLayout,
        hasStaffAssignments: staffAssignments.length > 0,
        hasReservations: reservations.length > 0,
      };
    });
  }
}
