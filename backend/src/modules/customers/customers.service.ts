import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
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

  /**
   * Özel karakterleri escape et - SQL Injection önleme
   */
  private escapeSearchQuery(query: string): string {
    // SQL LIKE için özel karakterleri escape et
    return query.replace(/[%_\\]/g, "\\$&");
  }

  async findAll(search?: string) {
    if (search) {
      const escapedSearch = this.escapeSearchQuery(search);
      return this.customerRepository.find({
        where: [
          { fullName: ILike(`%${escapedSearch}%`) },
          { phone: ILike(`%${escapedSearch}%`) },
          { email: ILike(`%${escapedSearch}%`) },
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
   * OPTIMIZE EDİLDİ: Full-text search ile GIN index kullanımı
   * GÜVENLİK: SQL Injection koruması eklendi
   */
  async searchForAutocomplete(query: string, limit: number = 5) {
    if (!query || query.length < 4) return [];

    const escapedQuery = this.escapeSearchQuery(query);

    // Full-text search kullan (çok daha hızlı)
    return this.customerRepository
      .createQueryBuilder("customer")
      .where(
        "to_tsvector('english', customer.fullName) @@ plainto_tsquery('english', :query) OR customer.phone LIKE :phoneQuery OR customer.email ILIKE :emailQuery",
        {
          query: query, // plainto_tsquery zaten güvenli
          phoneQuery: `%${escapedQuery}%`,
          emailQuery: `%${escapedQuery}%`,
        }
      )
      .orderBy(
        "ts_rank(to_tsvector('english', customer.fullName), plainto_tsquery('english', :query))",
        "DESC"
      )
      .addOrderBy("customer.totalAttendedEvents", "DESC")
      .addOrderBy("customer.fullName", "ASC")
      .take(limit)
      .getMany();
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
   * Tüm misafirleri detaylı listele - OPTIMIZE EDİLDİ v2 + PAGINATION
   * - N+1 query problemi çözüldü (noteCount tek sorguda)
   * - Pagination eklendi
   * - Full-text search desteği (GIN index ile)
   * - SQL Injection koruması eklendi
   */
  async findAllWithStats(search?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

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
      .orderBy("customer.createdAt", "DESC")
      .take(limit)
      .skip(skip);

    if (search) {
      const escapedSearch = this.escapeSearchQuery(search);
      // Full-text search kullan (GIN index ile optimize edilmiş)
      queryBuilder.where(
        "to_tsvector('english', customer.fullName) @@ plainto_tsquery('english', :search) OR customer.phone LIKE :phoneSearch OR customer.email ILIKE :emailSearch",
        {
          search: search, // plainto_tsquery zaten güvenli
          phoneSearch: `%${escapedSearch}%`,
          emailSearch: `%${escapedSearch}%`,
        }
      );
    }

    const [rawResults, total] = await Promise.all([
      queryBuilder.getRawAndEntities(),
      queryBuilder.getCount(),
    ]);

    // Raw sonuçlardan noteCount'u entity'lere ekle
    const noteCountMap = new Map<string, number>();
    rawResults.raw.forEach((row: any) => {
      noteCountMap.set(row.customer_id, parseInt(row.noteCount) || 0);
    });

    const items = rawResults.entities.map((customer) => ({
      ...customer,
      noteCount: noteCountMap.get(customer.id) || 0,
    }));

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

  /**
   * Tüm misafirleri getir - Customers + Reservations'dan benzersiz misafirler
   * Misafirler sayfası için: Hem kayıtlı müşteriler hem de sadece rezervasyon yapan misafirler
   */
  async findAllGuestsIncludingReservations(
    search?: string,
    page = 1,
    limit = 50
  ) {
    const skip = (page - 1) * limit;

    // 1. Önce customers tablosundan al (mevcut findAllWithStats mantığı)
    const customersQuery = this.customerRepository
      .createQueryBuilder("customer")
      .leftJoin("guest_notes", "notes", "notes.customerId = customer.id")
      .select([
        "customer.id AS id",
        'customer.fullName AS "fullName"',
        "customer.phone AS phone",
        "customer.email AS email",
        'customer.vipScore AS "vipScore"',
        "customer.tags AS tags",
        'customer.isBlacklisted AS "isBlacklisted"',
        'customer.totalSpent AS "totalSpent"',
        'customer.eventCount AS "eventCount"',
        'customer.totalAttendedEvents AS "totalAttendedEvents"',
        'customer.totalReservations AS "totalReservations"',
        'customer.noShowCount AS "noShowCount"',
        'customer.lastEventDate AS "lastEventDate"',
        'customer.createdAt AS "createdAt"',
        'COUNT(notes.id) AS "noteCount"',
        "'customer' AS source",
      ])
      .groupBy("customer.id");

    if (search) {
      const escapedSearch = this.escapeSearchQuery(search);
      customersQuery.where(
        "customer.fullName ILIKE :search OR customer.phone LIKE :phoneSearch OR customer.email ILIKE :emailSearch",
        {
          search: `%${escapedSearch}%`,
          phoneSearch: `%${escapedSearch}%`,
          emailSearch: `%${escapedSearch}%`,
        }
      );
    }

    // 2. Reservations tablosundan customerId'si olmayan benzersiz misafirleri al
    const reservationGuestsQuery = this.reservationRepository
      .createQueryBuilder("reservation")
      .select([
        "NULL AS id",
        'reservation.guestName AS "fullName"',
        "reservation.guestPhone AS phone",
        "reservation.guestEmail AS email",
        '0 AS "vipScore"',
        "'{}' AS tags",
        'false AS "isBlacklisted"',
        '0 AS "totalSpent"',
        'COUNT(reservation.id) AS "eventCount"',
        'COUNT(reservation.id) AS "totalAttendedEvents"',
        'COUNT(reservation.id) AS "totalReservations"',
        '0 AS "noShowCount"',
        'MAX(reservation.createdAt) AS "lastEventDate"',
        'MIN(reservation.createdAt) AS "createdAt"',
        '0 AS "noteCount"',
        "'reservation' AS source",
      ])
      .where("reservation.customerId IS NULL")
      .andWhere("reservation.guestName IS NOT NULL")
      .groupBy("reservation.guestName")
      .addGroupBy("reservation.guestPhone")
      .addGroupBy("reservation.guestEmail");

    if (search) {
      const escapedSearch = this.escapeSearchQuery(search);
      reservationGuestsQuery.andWhere(
        "reservation.guestName ILIKE :search OR reservation.guestPhone LIKE :phoneSearch OR reservation.guestEmail ILIKE :emailSearch",
        {
          search: `%${escapedSearch}%`,
          phoneSearch: `%${escapedSearch}%`,
          emailSearch: `%${escapedSearch}%`,
        }
      );
    }

    // Her iki sorguyu çalıştır
    const [customersRaw, reservationGuestsRaw] = await Promise.all([
      customersQuery.getRawMany(),
      reservationGuestsQuery.getRawMany(),
    ]);

    // Birleştir ve sırala
    const allGuests = [...customersRaw, ...reservationGuestsRaw];

    // createdAt'e göre sırala (en yeni önce)
    allGuests.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const total = allGuests.length;
    const paginatedItems = allGuests.slice(skip, skip + limit);

    // Format items
    const items = paginatedItems.map((guest) => ({
      id: guest.id || `guest-${guest.fullName}-${guest.phone || "no-phone"}`,
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      vipScore: parseInt(guest.vipScore) || 0,
      tags:
        typeof guest.tags === "string"
          ? JSON.parse(guest.tags || "[]")
          : guest.tags || [],
      isBlacklisted:
        guest.isBlacklisted === true || guest.isBlacklisted === "true",
      totalSpent: parseFloat(guest.totalSpent) || 0,
      eventCount: parseInt(guest.eventCount) || 0,
      totalAttendedEvents: parseInt(guest.totalAttendedEvents) || 0,
      totalReservations: parseInt(guest.totalReservations) || 0,
      noShowCount: parseInt(guest.noShowCount) || 0,
      lastEventDate: guest.lastEventDate,
      createdAt: guest.createdAt,
      noteCount: parseInt(guest.noteCount) || 0,
      source: guest.source, // 'customer' veya 'reservation'
    }));

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
