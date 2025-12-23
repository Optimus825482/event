import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, ILike } from "typeorm";
import { Customer } from "../../entities/customer.entity";
import { GuestNote, GuestNoteType } from "../../entities/guest-note.entity";
import { Reservation } from "../../entities/reservation.entity";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(GuestNote)
    private guestNoteRepository: Repository<GuestNote>,
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>
  ) {}

  async create(dto: CreateCustomerDto) {
    const customer = this.customerRepository.create(dto);
    return this.customerRepository.save(customer);
  }

  async findAll(search?: string) {
    if (search) {
      return this.customerRepository.find({
        where: [
          { fullName: Like(`%${search}%`) },
          { phone: Like(`%${search}%`) },
          { email: Like(`%${search}%`) },
        ],
        order: { createdAt: "DESC" },
      });
    }
    return this.customerRepository.find({ order: { createdAt: "DESC" } });
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ["reservations"],
    });
    if (!customer) throw new NotFoundException("Müşteri bulunamadı");
    return customer;
  }

  async findByPhone(phone: string) {
    return this.customerRepository.findOne({ where: { phone } });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(id);
    Object.assign(customer, dto);
    return this.customerRepository.save(customer);
  }

  async addTag(id: string, tag: string) {
    const customer = await this.findOne(id);
    if (!customer.tags.includes(tag)) {
      customer.tags.push(tag);
      await this.customerRepository.save(customer);
    }
    return customer;
  }

  async removeTag(id: string, tag: string) {
    const customer = await this.findOne(id);
    customer.tags = customer.tags.filter((t) => t !== tag);
    return this.customerRepository.save(customer);
  }

  async toggleBlacklist(id: string) {
    const customer = await this.findOne(id);
    customer.isBlacklisted = !customer.isBlacklisted;
    return this.customerRepository.save(customer);
  }

  async delete(id: string) {
    const customer = await this.findOne(id);
    await this.customerRepository.remove(customer);
    return { message: "Müşteri silindi" };
  }

  async getCustomerHistory(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ["reservations", "reservations.event"],
    });
    if (!customer) throw new NotFoundException("Müşteri bulunamadı");
    return {
      customer,
      eventCount: customer.reservations?.length || 0,
      totalSpent: customer.totalSpent,
    };
  }

  /**
   * Misafir arama - Autocomplete için (4+ karakter)
   */
  async searchForAutocomplete(query: string, limit: number = 5) {
    if (!query || query.length < 4) return [];

    return this.customerRepository.find({
      where: [
        { fullName: ILike(`%${query}%`) },
        { phone: Like(`%${query}%`) },
        { email: ILike(`%${query}%`) },
      ],
      take: limit,
      order: { totalAttendedEvents: "DESC", fullName: "ASC" },
    });
  }

  /**
   * Misafir detayları ile notları getir
   */
  async getCustomerWithNotes(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ["reservations", "reservations.event"],
    });
    if (!customer) throw new NotFoundException("Müşteri bulunamadı");

    const notes = await this.guestNoteRepository.find({
      where: { customerId: id },
      relations: ["event"],
      order: { createdAt: "DESC" },
    });

    return { customer, notes };
  }

  /**
   * Misafir notu ekle
   */
  async addNote(dto: {
    customerId: string;
    content: string;
    noteType?: GuestNoteType;
    eventId?: string;
    reservationId?: string;
    createdBy?: string;
  }) {
    await this.findOne(dto.customerId);

    const note = this.guestNoteRepository.create({
      customerId: dto.customerId,
      content: dto.content,
      noteType: dto.noteType || GuestNoteType.GENERAL,
      eventId: dto.eventId,
      reservationId: dto.reservationId,
      createdBy: dto.createdBy,
    });

    return this.guestNoteRepository.save(note);
  }

  /**
   * Misafir notunu güncelle
   */
  async updateNote(noteId: string, content: string) {
    const note = await this.guestNoteRepository.findOne({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException("Not bulunamadı");

    note.content = content;
    return this.guestNoteRepository.save(note);
  }

  /**
   * Misafir notunu sil
   */
  async deleteNote(noteId: string) {
    const note = await this.guestNoteRepository.findOne({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException("Not bulunamadı");

    await this.guestNoteRepository.remove(note);
    return { message: "Not silindi" };
  }

  /**
   * Misafirin belirli etkinlikteki notlarını getir
   */
  async getNotesForEvent(customerId: string, eventId: string) {
    return this.guestNoteRepository.find({
      where: { customerId, eventId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Tüm misafirleri detaylı listele - Optimize edilmiş
   */
  async findAllWithStats(search?: string) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder("customer")
      .leftJoin("guest_notes", "notes", "notes.customerId = customer.id")
      .select([
        "customer.id",
        "customer.fullName",
        "customer.phone",
        "customer.email",
        "customer.vipScore",
        "customer.tags",
        "customer.isBlacklisted",
        "customer.totalSpent",
        "customer.eventCount",
        "customer.totalAttendedEvents",
        "customer.totalReservations",
        "customer.noShowCount",
        "customer.lastEventDate",
        "customer.createdAt",
        "customer.updatedAt",
      ])
      .addSelect("COUNT(notes.id)", "noteCount")
      .groupBy("customer.id")
      .orderBy("customer.createdAt", "DESC");

    if (search) {
      queryBuilder.where(
        "customer.fullName ILIKE :search OR customer.phone LIKE :search OR customer.email ILIKE :search",
        { search: `%${search}%` }
      );
    }

    const rawResults = await queryBuilder.getRawAndEntities();

    // Raw sonuçlardan noteCount'u entity'lere ekle
    const noteCountMap = new Map<string, number>();
    rawResults.raw.forEach((row: any) => {
      noteCountMap.set(row.customer_id, parseInt(row.noteCount) || 0);
    });

    return rawResults.entities.map((customer) => ({
      ...customer,
      noteCount: noteCountMap.get(customer.id) || 0,
    }));
  }

  /**
   * Telefon veya email ile müşteri bul veya oluştur
   */
  async findOrCreate(dto: {
    fullName: string;
    phone?: string;
    email?: string;
  }) {
    if (dto.phone) {
      const existing = await this.customerRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existing) return { customer: existing, isNew: false };
    }

    if (dto.email) {
      const existing = await this.customerRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) return { customer: existing, isNew: false };
    }

    const customer = this.customerRepository.create({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
    });
    const saved = await this.customerRepository.save(customer);
    return { customer: saved, isNew: true };
  }

  /**
   * Müşteri etkinlik istatistiklerini güncelle
   */
  async updateEventStats(customerId: string, eventId: string, eventDate: Date) {
    const customer = await this.findOne(customerId);

    customer.totalAttendedEvents = (customer.totalAttendedEvents || 0) + 1;
    customer.lastEventId = eventId;
    customer.lastEventDate = eventDate;

    return this.customerRepository.save(customer);
  }

  /**
   * Müşteri rezervasyon sayısını artır
   */
  async incrementReservationCount(customerId: string) {
    const customer = await this.findOne(customerId);
    customer.totalReservations = (customer.totalReservations || 0) + 1;
    return this.customerRepository.save(customer);
  }

  /**
   * No-show sayısını artır
   */
  async incrementNoShowCount(customerId: string) {
    const customer = await this.findOne(customerId);
    customer.noShowCount = (customer.noShowCount || 0) + 1;
    return this.customerRepository.save(customer);
  }
}
