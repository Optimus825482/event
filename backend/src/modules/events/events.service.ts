import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event, EventStatus } from "../../entities/event.entity";
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateLayoutDto,
} from "./dto/event.dto";

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>
  ) {}

  async create(dto: CreateEventDto, organizerId: string) {
    const event = this.eventRepository.create({
      ...dto,
      organizerId,
      eventDate: new Date(dto.eventDate),
      eventEndDate: dto.eventEndDate ? new Date(dto.eventEndDate) : null,
    });
    return this.eventRepository.save(event);
  }

  async findAll(organizerId?: string) {
    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.organizer", "organizer")
      .leftJoinAndSelect("event.reservations", "reservations")
      .leftJoinAndSelect("event.staffAssignments", "staffAssignments")
      .leftJoinAndSelect("event.serviceTeams", "serviceTeams")
      .leftJoinAndSelect("event.eventStaffAssignments", "eventStaffAssignments")
      .orderBy("event.eventDate", "DESC");

    if (organizerId) {
      query.where("event.organizerId = :organizerId", { organizerId });
    }

    const events = await query.getMany();

    // hasVenueLayout ve hasTeamAssignment hesapla
    return events.map((event) => ({
      ...event,
      hasVenueLayout: !!(
        event.venueLayout && (event.venueLayout as any).placedTables?.length > 0
      ),
      // ServiceTeam, StaffAssignment veya EventStaffAssignment varsa hasTeamAssignment true
      hasTeamAssignment:
        event.serviceTeams?.length > 0 ||
        event.staffAssignments?.length > 0 ||
        event.eventStaffAssignments?.length > 0,
      reservedCount: event.reservations?.length || 0,
    }));
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

  async updateLayout(id: string, dto: UpdateLayoutDto) {
    const event = await this.findOne(id);
    event.venueLayout = dto.venueLayout as any;
    // Toplam kapasiteyi hesapla - yeni format: placedTables
    if (dto.venueLayout?.placedTables) {
      event.totalCapacity = dto.venueLayout.placedTables.reduce(
        (sum: number, table: any) => sum + (table.capacity || 0),
        0
      );
    }
    return this.eventRepository.save(event);
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
