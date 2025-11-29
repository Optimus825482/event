import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { Reservation, ReservationStatus } from '../../entities/reservation.entity';
import { CreateReservationDto, UpdateReservationDto } from './dto/reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
  ) {}

  async create(dto: CreateReservationDto) {
    // QR kod hash'i oluştur
    const qrCodeHash = crypto.createHash('sha256')
      .update(`${dto.eventId}-${dto.tableId}-${dto.customerId}-${Date.now()}`)
      .digest('hex')
      .substring(0, 32);

    const reservation = this.reservationRepository.create({
      ...dto,
      qrCodeHash,
    });
    return this.reservationRepository.save(reservation);
  }

  async findAll(eventId?: string) {
    const query = this.reservationRepository.createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.customer', 'customer')
      .leftJoinAndSelect('reservation.event', 'event')
      .orderBy('reservation.createdAt', 'DESC');

    if (eventId) {
      query.where('reservation.eventId = :eventId', { eventId });
    }
    return query.getMany();
  }

  async findOne(id: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['customer', 'event'],
    });
    if (!reservation) throw new NotFoundException('Rezervasyon bulunamadı');
    return reservation;
  }

  async findByQRCode(qrCodeHash: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { qrCodeHash },
      relations: ['customer', 'event'],
    });
    if (!reservation) throw new NotFoundException('Rezervasyon bulunamadı');
    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto) {
    const reservation = await this.findOne(id);
    Object.assign(reservation, dto);
    return this.reservationRepository.save(reservation);
  }

  async checkIn(qrCodeHash: string) {
    const reservation = await this.findByQRCode(qrCodeHash);
    
    if (reservation.status === ReservationStatus.CHECKED_IN) {
      throw new BadRequestException('Bu rezervasyon zaten check-in yapılmış');
    }
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('Bu rezervasyon iptal edilmiş');
    }

    reservation.status = ReservationStatus.CHECKED_IN;
    reservation.checkInTime = new Date();
    await this.reservationRepository.save(reservation);

    return {
      success: true,
      reservation,
      message: `Check-in başarılı! Masa: ${reservation.tableId}`,
    };
  }

  async generateQRCode(id: string) {
    const reservation = await this.findOne(id);
    const qrData = JSON.stringify({
      hash: reservation.qrCodeHash,
      eventId: reservation.eventId,
      tableId: reservation.tableId,
    });
    
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return { qrCodeDataUrl, reservation };
  }

  async delete(id: string) {
    const reservation = await this.findOne(id);
    await this.reservationRepository.remove(reservation);
    return { message: 'Rezervasyon silindi' };
  }

  async getByTable(eventId: string, tableId: string) {
    return this.reservationRepository.findOne({
      where: { eventId, tableId },
      relations: ['customer'],
    });
  }
}
