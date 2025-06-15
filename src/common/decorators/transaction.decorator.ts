import { TransactionManager } from '../managers/transaction.manager'; //created a transaction decorator
import { EntityManager } from 'typeorm';

export function Transactional() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const transactionManager = TransactionManager.getInstance();
      return await transactionManager.executeInTransaction(async (entityManager: EntityManager) => {
        // Inject entity manager as the last argument
        return await originalMethod.apply(this, [...args, entityManager]);
      });
    };

    return descriptor;
  };
} 