import { Repository, FindOneOptions, DeepPartial } from 'typeorm';
import { BaseEntity } from '../domain/base.entity';
import { IBaseRepository } from './base.repository.interface';
import { NotFoundException } from '../exceptions/base.exception';

export abstract class BaseRepository<T extends BaseEntity> implements IBaseRepository<T> {
  constructor(protected readonly repository: Repository<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } } as FindOneOptions<T>);
  }

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity as T);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }
    Object.assign(entity, data);
    return this.repository.save(entity);
  }

  async delete(id: string): Promise<void> {
    const result = await this.repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }
  }

  async exists(id: string): Promise<boolean> {
    const entity = await this.findById(id);
    return !!entity;
  }
} 