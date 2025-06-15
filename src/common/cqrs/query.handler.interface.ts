import { IQuery } from './query.interface';

export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult = any> {
  execute(query: TQuery): Promise<TResult>;
} 