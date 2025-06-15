import { Injectable } from '@nestjs/common'; //created a transaction manager
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TransactionManager {
  private static instance: TransactionManager;
  private dataSource: DataSource;

  private constructor() {}

  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  setDataSource(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async executeInTransaction<T>(
    operation: (entityManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
} 