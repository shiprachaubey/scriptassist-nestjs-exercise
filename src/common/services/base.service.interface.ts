import { DeepPartial } from 'typeorm';
import { BaseEntity } from '../domain/base.entity';// create a base service interface

export interface IBaseService<T extends BaseEntity> {
  getById(id: string): Promise<T>;
  getAll(): Promise<T[]>;
  create(data: DeepPartial<T>): Promise<T>;
  update(id: string, data: DeepPartial<T>): Promise<T>;
  delete(id: string): Promise<void>;
} 