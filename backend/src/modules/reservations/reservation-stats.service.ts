import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import {
  Reservation,
  ReservationStatus,
} from "../../entities/reservation.entity";

@Injectable()
export class ReservationStatsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
  ) {}

  /**
   * Event istatistiklerini hesapla - Dashboard için
   * Requirement: 5.1 - totalExpected, checkedIn, remaining, cancelled, noShow
   */
  async getEventStats(eventId: string): Promise<{
    totalExpected: number;
    checkedIn: number;
    remaining: number;
    cancelled: number;
    noShow: number;
  }> {
    const counts = await this.reservationRepository
      .createQueryBuilder("r")
      .select("r.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("r.eventId = :eventId", { eventId })
      .groupBy("r.status")
      .getRawMany();

    const statusMap: Record<string, number> = {};
    for (const row of counts) {
      statusMap[row.status] = Number(row.count);
    }

    const checkedIn = statusMap[ReservationStatus.CHECKED_IN] || 0;
    const cancelled = statusMap[ReservationStatus.CANCELLED] || 0;
    const noShow = statusMap[ReservationStatus.NO_SHOW] || 0;
    const pending = statusMap[ReservationStatus.PENDING] || 0;
    const confirmed = statusMap[ReservationStatus.CONFIRMED] || 0;

    const totalExpected = pending + confirmed + checkedIn;
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
   * Masa bazlı aktif rezervasyonu getir
   */
  async getByTable(
    eventId: string,
    tableId: string,
  ): Promise<Reservation | null> {
    return this.reservationRepository.findOne({
      where: {
        eventId,
        tableId,
        status: Not(
          In([ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW]),
        ),
      },
      relations: ["customer"],
    });
  }
}
