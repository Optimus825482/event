import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableType } from '../../entities';
import { CreateTableTypeDto, UpdateTableTypeDto } from './dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(TableType)
    private tableTypeRepository: Repository<TableType>,
  ) {}

  async create(dto: CreateTableTypeDto): Promise<TableType> {
    const tableType = this.tableTypeRepository.create(dto);
    return this.tableTypeRepository.save(tableType);
  }

  async findAll(): Promise<TableType[]> {
    return this.tableTypeRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<TableType | null> {
    return this.tableTypeRepository.findOneBy({ id });
  }

  async update(id: string, dto: UpdateTableTypeDto): Promise<TableType | null> {
    await this.tableTypeRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.tableTypeRepository.delete(id);
  }

  // Varsayılan masa tiplerini oluştur
  async seedDefaults(): Promise<void> {
    const defaults = [
      { name: 'Standart', capacity: 8, color: '#3b82f6', shape: 'round' },
      { name: 'VIP', capacity: 12, color: '#eab308', shape: 'round' },
      { name: 'Premium', capacity: 10, color: '#8b5cf6', shape: 'round' },
      { name: 'Loca', capacity: 15, color: '#ef4444', shape: 'rectangle' },
    ];

    for (const def of defaults) {
      const exists = await this.tableTypeRepository.findOneBy({ name: def.name });
      if (!exists) {
        await this.create(def as CreateTableTypeDto);
      }
    }
  }
}
