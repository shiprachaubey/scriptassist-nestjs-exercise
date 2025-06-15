import { Injectable } from '@nestjs/common';
import { ICommand } from './command.interface';
import { ICommandHandler } from './command.handler.interface';

@Injectable()
export class CommandBus {
  private handlers: Map<string, ICommandHandler<ICommand, any>> = new Map();

  register<T extends ICommand, R>(
    commandType: string,
    handler: ICommandHandler<T, R>,
  ) {
    this.handlers.set(commandType, handler);
  }

  async execute<T extends ICommand, R>(command: T): Promise<R> {
    const handler = this.handlers.get(command.constructor.name);
    if (!handler) {
      throw new Error(`No handler registered for command ${command.constructor.name}`);
    }
    return handler.execute(command);
  }
} 