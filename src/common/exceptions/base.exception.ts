export class BaseException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundException extends BaseException {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestException extends BaseException {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenException extends BaseException {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictException extends BaseException {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
} 