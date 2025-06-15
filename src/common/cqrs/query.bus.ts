import { Injectable } from '@nestjs/common'; //created a query bus
import { IQuery } from './query.interface';
import { IQueryHandler } from './query.handler.interface';

@Injectable()
export class QueryBus {
  private handlers: Map<string, IQueryHandler<IQuery, any>> = new Map();

  register<T extends IQuery, R>(
    queryType: string,
    handler: IQueryHandler<T, R>,
  ) {
    this.handlers.set(queryType, handler);
  }

  async execute<T extends IQuery, R>(query: T): Promise<R> {
    const handler = this.handlers.get(query.constructor.name);
    if (!handler) {
      throw new Error(`No handler registered for query ${query.constructor.name}`);
    }
    return handler.execute(query);
  }
} 