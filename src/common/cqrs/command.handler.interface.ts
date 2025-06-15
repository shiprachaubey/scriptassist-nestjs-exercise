import { ICommand } from './command.interface';

export interface ICommandHandler<TCommand extends ICommand<TResult>, TResult = any> {
  execute(command: TCommand): Promise<TResult>;
} 