import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
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
        order: { createdAt: 'DESC' },
      });
    }
    return this.customerRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['reservations'],
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');
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
    customer.tags = customer.tags.filter(t => t !== tag);
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
    return { message: 'Müşteri silindi' };
  }

  async getCustomerHistory(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['reservations', 'reservations.event'],
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');
    return {
      customer,
      eventCount: customer.reservations?.length || 0,
      totalSpent: customer.totalSpent,
    };
  }
}
