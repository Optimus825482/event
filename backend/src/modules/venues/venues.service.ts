import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VenueTemplate } from '../../entities/venue-template.entity';
import { CreateVenueTemplateDto, UpdateVenueTemplateDto } from './dto/venue.dto';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(VenueTemplate)
    private venueRepository: Repository<VenueTemplate>,
  ) {}

  async create(dto: CreateVenueTemplateDto, userId: string) {
    const venue = this.venueRepository.create({
      ...dto,
      createdBy: userId,
    });
    return this.venueRepository.save(venue);
  }

  async findAll(isPublic?: boolean) {
    const query: any = {};
    if (isPublic !== undefined) {
      query.isPublic = isPublic;
    }
    return this.venueRepository.find({
      where: query,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const venue = await this.venueRepository.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Mekan şablonu bulunamadı');
    return venue;
  }

  async update(id: string, dto: UpdateVenueTemplateDto) {
    const venue = await this.findOne(id);
    Object.assign(venue, dto);
    return this.venueRepository.save(venue);
  }

  async delete(id: string) {
    const venue = await this.findOne(id);
    await this.venueRepository.remove(venue);
    return { message: 'Mekan şablonu silindi' };
  }

  async incrementUsage(id: string) {
    const venue = await this.findOne(id);
    venue.usageCount += 1;
    return this.venueRepository.save(venue);
  }
}
