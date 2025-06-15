export class BaseResponseDto<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };

  static success<T>(data: T, meta?: any): BaseResponseDto<T> {
    const response = new BaseResponseDto<T>();
    response.success = true;
    response.data = data;
    if (meta) {
      response.meta = meta;
    }
    return response;
  }

  static error(message: string, code: string, details?: any): BaseResponseDto<null> {
    const response = new BaseResponseDto<null>();
    response.success = false;
    response.error = {
      message,
      code,
      details,
    };
    return response;
  }
} 