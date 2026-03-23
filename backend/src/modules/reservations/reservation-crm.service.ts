import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";
import { Customer } from "../../entities/customer.entity";

@Injectable()
export class ReservationCrmService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  /**
   * Müşteri geçmişi getir - CRM Entegrasyonu
   * Requirement: 6.1 - Müşteri event geçmişi ve VIP score
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
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Müşteri bulunamadı: ${customerId}`);
    }

    const reservations = await this.reservationRepository.find({
      where: { customerId },
      relations: ["event"],
      order: { createdAt: "DESC" },
    });

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
        ? `UYARI: ${customer.fullName} kara listede! Rezervasyon yapmadan önce yönetici onayı alınız.`
        : null,
      customer,
    };
  }

  /**
   * Müşteri bilgilerini rezervasyon için getir - CRM Entegrasyonu
   * Requirements: 6.1, 6.2, 6.3 - Tüm müşteri bilgilerini tek seferde getir
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
    // Tek DB sorgusuyla müşteri al (getCustomerHistory + checkBlacklistStatus 2 ayrı sorgu yapıyordu)
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Müşteri bulunamadı: ${customerId}`);
    }

    const reservations = await this.reservationRepository.find({
      where: { customerId },
      relations: ["event"],
      order: { createdAt: "DESC" },
    });

    return {
      customer,
      vipScore: customer.vipScore,
      isBlacklisted: customer.isBlacklisted,
      blacklistWarning: customer.isBlacklisted
        ? `UYARI: ${customer.fullName} kara listede! Rezervasyon yapmadan önce yönetici onayı alınız.`
        : null,
      tags: customer.tags,
      eventHistory: reservations.map((r) => ({
        eventId: r.eventId,
        eventName: r.event?.name || "Bilinmeyen Etkinlik",
        eventDate: r.event?.eventDate || r.createdAt,
        status: r.status,
      })),
      totalReservations: reservations.length,
    };
  }
}
