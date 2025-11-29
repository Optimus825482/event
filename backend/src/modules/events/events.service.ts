import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '../../entities/event.entity';
import { CreateEventDto, UpdateEventDto, UpdateLayoutDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
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
    const query = this.eventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .orderBy('event.eventDate', 'DESC');
    
    if (organizerId) {
      query.where('event.organizerId = :organizerId', { organizerId });
    }
    return query.getMany();
  }

  async findOne(id: string) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer', 'reservations', 'staffAssignments'],
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');
    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    // Önce etkinliği bul, yoksa oluştur (upsert)
    let event = await this.eventRepository.findOne({ where: { id } });
    
    if (!event) {
      // Etkinlik yoksa yeni oluştur
      event = this.eventRepository.create({
        name: dto.name || 'Yeni Etkinlik',
        eventDate: dto.eventDate ? new Date(dto.eventDate) : new Date(),
        status: EventStatus.DRAFT,
      });
      event.id = id; // ID'yi ayrı ata
    }
    
    Object.assign(event, dto);
    if (dto.eventDate) event.eventDate = new Date(dto.eventDate);
    if (dto.eventEndDate) event.eventEndDate = new Date(dto.eventEndDate);
    return this.eventRepository.save(event);
  }

  async updateLayout(id: string, dto: UpdateLayoutDto) {
    const event = await this.findOne(id);
    event.venueLayout = dto.venueLayout;
    // Toplam kapasiteyi hesapla
    if (dto.venueLayout?.tables) {
      event.totalCapacity = dto.venueLayout.tables.reduce(
        (sum: number, table: any) => sum + (table.capacity || 0), 0
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
    return { message: 'Etkinlik silindi' };
  }

  async getStats(id: string) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['reservations'],
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');

    const totalReservations = event.reservations?.length || 0;
    const checkedIn = event.reservations?.filter(r => r.status === 'checked_in').length || 0;
    const totalGuests = event.reservations?.reduce((sum, r) => sum + r.guestCount, 0) || 0;

    return {
      totalCapacity: event.totalCapacity,
      totalReservations,
      checkedIn,
      totalGuests,
      occupancyRate: event.totalCapacity > 0 ? (totalGuests / event.totalCapacity) * 100 : 0,
    };
  }
}
