import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event, EventStatus } from "../../entities/event.entity";
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateLayoutDto,
} from "./dto/event.dto";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
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
   * Tüm etkinlikleri getir - OPTIMIZE EDİLDİ
   * - Sadece gerekli alanlar SELECT ediliyor (SELECT * yerine)
   * - COUNT subquery ile relation sayıları tek sorguda alınıyor
   * - N+1 query problemi çözüldü
   */
  async findAll(organizerId?: string) {
    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoin("event.organizer", "organizer")
      .select([
        "event.id",
        "event.name",
        "event.eventDate",
        "event.eventEndDate",
        "event.eventType",
        "event.status",
        "event.totalCapacity",
        "event.venueLayout",
        "event.createdAt",
        "event.updatedAt",
        "organizer.id",
        "organizer.fullName",
      ])
      // COUNT subqueries - tek sorguda tüm sayıları al
      .addSelect(
        (subQuery) =>
          subQuery
            .select("COUNT(*)")
            .from("reservation", "r")
            .where("r.eventId = event.id"),
        "reservationCount"
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select("COUNT(*)")
            .from("service_team", "st")
            .where("st.eventId = event.id"),
        "serviceTeamCount"
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select("COUNT(*)")
            .from("staff_assignment", "sa")
            .where("sa.eventId = event.id"),
        "staffAssignmentCount"
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select("COUNT(*)")
            .from("event_staff_assignment", "esa")
            .where("esa.eventId = event.id"),
        "eventStaffAssignmentCount"
      )
      .orderBy("event.eventDate", "DESC");

    if (organizerId) {
      query.where("event.organizerId = :organizerId", { organizerId });
    }

    const rawResults = await query.getRawAndEntities();

    // Raw sonuçları entity'lerle birleştir
    return rawResults.entities.map((event, index) => {
      const raw = rawResults.raw[index];
      return {
        ...event,
        hasVenueLayout: !!(
          event.venueLayout &&
          (event.venueLayout as any).placedTables?.length > 0
        ),
        hasTeamAssignment:
          parseInt(raw.serviceTeamCount || "0") > 0 ||
          parseInt(raw.staffAssignmentCount || "0") > 0 ||
          parseInt(raw.eventStaffAssignmentCount || "0") > 0,
        reservedCount: parseInt(raw.reservationCount || "0"),
      };
    });
  }

  async findOne(id: string) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: [
        "organizer",
        "reservations",
        "staffAssignments",
        "serviceTeams",
        "eventStaffAssignments",
      ],
    });
    if (!event) throw new NotFoundException("Etkinlik bulunamadı");

    // hasVenueLayout ve hasTeamAssignment hesapla
    return {
      ...event,
      hasVenueLayout: !!(
        event.venueLayout && (event.venueLayout as any).placedTables?.length > 0
      ),
      hasTeamAssignment:
        (event.serviceTeams?.length || 0) > 0 ||
        (event.staffAssignments?.length || 0) > 0 ||
        (event.eventStaffAssignments?.length || 0) > 0 ||
        !!(event.venueLayout as any)?.tableGroups?.some(
          (g: any) => g.assignedTeamId
        ),
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
}
