import { DeepPartial } from 'typeorm';
import { BaseEntity } from '../domain/base.entity';
import { IBaseService } from './base.service.interface';
import { IBaseRepository } from '../repositories/base.repository.interface';
import { NotFoundException } from '../exceptions/base.exception';

export abstract class BaseService<T extends BaseEntity> implements IBaseService<T> {
  constructor(protected readonly repository: IBaseRepository<T>) {}

  async getById(id: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }
    return entity;
  }

  async getAll(): Promise<T[]> {
    return this.repository.findAll();
  }

  async create(data: DeepPartial<T>): Promise<T> {
    return this.repository.create(data);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    return this.repository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
} 