export interface IQuery<T = any> {
  execute(): Promise<T>;
} 