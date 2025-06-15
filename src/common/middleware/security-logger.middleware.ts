import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from '../services/logger.service';
import { v4 as uuidv4 } from 'uuid';

interface RequestMetrics {
  startTime: number;
  duration?: number;
  statusCode?: number;
  error?: Error;
}

interface ExtendedRequest extends Request {
  requestId: string;
}

@Injectable()
export class SecurityLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityLoggerMiddleware.name);
  private readonly requestMetrics = new WeakMap<ExtendedRequest, RequestMetrics>();

  // Metrics tracking
  private metrics = {
    totalRequests: 0,
    requestsByMethod: new Map<string, number>(),
    requestsByStatus: new Map<number, number>(),
    suspiciousRequests: new Map<string, number>(),
    slowRequests: 0,
  };

  constructor(private readonly loggerService: CustomLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Generate request ID for tracing
    const requestId = uuidv4();
    const extendedReq = req as ExtendedRequest;
    extendedReq.requestId = requestId;

    // Initialize request metrics
    this.requestMetrics.set(extendedReq, { startTime: Date.now() });

    // Add response listeners for metrics
    res.on('finish', () => this.handleResponseFinish(extendedReq, res));
    res.on('error', (error: Error) => this.handleResponseError(extendedReq, error));

    try {
      this.logRequest(extendedReq);
      next();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), extendedReq, res, next);
    }
  }

  private logRequest(req: ExtendedRequest) {
    const { ip, method, originalUrl, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = req.requestId;

    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.requestsByMethod.set(method, (this.metrics.requestsByMethod.get(method) || 0) + 1);

    const baseContext = {
      requestId,
      ip,
      method,
      url: originalUrl,
      userAgent,
      timestamp: new Date().toISOString(),
      metrics: {
        totalRequests: this.metrics.totalRequests,
        requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod),
      },
    };

    // Log suspicious requests with enhanced context
    if (this.isSuspiciousRequest(req)) {
      const detectedPatterns = this.getDetectedPatterns(req);
      const suspiciousContext = {
        ...baseContext,
        headers: this.sanitizeHeaders(headers),
        body: this.sanitizeBody(req.body),
        query: this.sanitizeQuery(req.query),
        detectedPatterns,
      };

      // Update suspicious request metrics
      detectedPatterns.forEach(pattern => {
        this.metrics.suspiciousRequests.set(pattern, (this.metrics.suspiciousRequests.get(pattern) || 0) + 1);
      });

      this.loggerService.warn(
        `Suspicious request detected from ${ip}`,
        JSON.stringify(suspiciousContext)
      );
    }

    // Log all requests in production with performance context
    if (process.env.NODE_ENV === 'production') {
      const metrics = this.requestMetrics.get(req);
      const context = {
        ...baseContext,
        performance: {
          startTime: metrics?.startTime,
        },
      };

      this.loggerService.log(
        `Request received from ${ip}`,
        JSON.stringify(context)
      );
    }
  }

  private handleResponseFinish(req: ExtendedRequest, res: Response) {
    const metrics = this.requestMetrics.get(req);
    if (!metrics) return;

    metrics.duration = Date.now() - metrics.startTime;
    metrics.statusCode = res.statusCode;

    // Update metrics
    this.metrics.requestsByStatus.set(
      res.statusCode,
      (this.metrics.requestsByStatus.get(res.statusCode) || 0) + 1
    );

    if (metrics.duration > 1000) {
      this.metrics.slowRequests++;
    }

    const context = {
      requestId: req.requestId,
      duration: metrics.duration,
      statusCode: metrics.statusCode,
      method: req.method,
      url: req.originalUrl,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod),
        requestsByStatus: Object.fromEntries(this.metrics.requestsByStatus),
        suspiciousRequests: Object.fromEntries(this.metrics.suspiciousRequests),
        slowRequests: this.metrics.slowRequests,
      },
    };

    // Log response metrics
    this.loggerService.log(
      `Request completed: ${req.method} ${req.originalUrl}`,
      JSON.stringify(context)
    );

    // Alert on slow requests
    if (metrics.duration > 1000) { // 1 second threshold
      this.loggerService.warn(
        `Slow request detected: ${req.method} ${req.originalUrl}`,
        JSON.stringify({ ...context, threshold: 1000 })
      );
    }
  }

  private handleResponseError(req: ExtendedRequest, error: Error) {
    const metrics = this.requestMetrics.get(req);
    if (!metrics) return;

    metrics.error = error;

    const context = {
      requestId: req.requestId,
      error: {
        message: error.message,
        stack: error.stack,
      },
      method: req.method,
      url: req.originalUrl,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod),
        requestsByStatus: Object.fromEntries(this.metrics.requestsByStatus),
        suspiciousRequests: Object.fromEntries(this.metrics.suspiciousRequests),
        slowRequests: this.metrics.slowRequests,
      },
    };

    this.loggerService.error(
      `Request failed: ${req.method} ${req.originalUrl}`,
      error.stack,
      JSON.stringify(context)
    );
  }

  private handleError(error: Error, req: ExtendedRequest, res: Response, next: NextFunction) {
    const context = {
      requestId: req.requestId,
      error: {
        message: error.message,
        stack: error.stack,
      },
      method: req.method,
      url: req.originalUrl,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod),
        requestsByStatus: Object.fromEntries(this.metrics.requestsByStatus),
        suspiciousRequests: Object.fromEntries(this.metrics.suspiciousRequests),
        slowRequests: this.metrics.slowRequests,
      },
    };

    this.loggerService.error(
      `Middleware error: ${error.message}`,
      error.stack,
      JSON.stringify(context)
    );

    // Continue to error handling middleware
    next(error);
  }

  private isSuspiciousRequest(req: ExtendedRequest): boolean {
    const suspiciousPatterns = [
      { pattern: /\.\.\//, name: 'path_traversal' },
      { pattern: /<script>/i, name: 'xss_attempt' },
      { pattern: /exec\(/i, name: 'command_injection' },
      { pattern: /eval\(/i, name: 'code_injection' },
      { pattern: /union\s+select/i, name: 'sql_injection' },
      { pattern: /\.(php|asp|aspx|jsp|exe|dll|bat|cmd|sh|bash)/i, name: 'file_inclusion' },
      { pattern: /(?:^|\W)(?:select|insert|update|delete|drop|alter|truncate)(?:\s|$)/i, name: 'sql_injection_advanced' },
    ];

    const requestData = {
      url: req.originalUrl,
      body: JSON.stringify(req.body),
      query: JSON.stringify(req.query),
      headers: JSON.stringify(this.sanitizeHeaders(req.headers)),
    };

    return suspiciousPatterns.some(({ pattern }) => 
      Object.values(requestData).some(data => pattern.test(data))
    );
  }

  private getDetectedPatterns(req: ExtendedRequest): string[] {
    const suspiciousPatterns = [
      { pattern: /\.\.\//, name: 'path_traversal' },
      { pattern: /<script>/i, name: 'xss_attempt' },
      { pattern: /exec\(/i, name: 'command_injection' },
      { pattern: /eval\(/i, name: 'code_injection' },
      { pattern: /union\s+select/i, name: 'sql_injection' },
      { pattern: /\.(php|asp|aspx|jsp|exe|dll|bat|cmd|sh|bash)/i, name: 'file_inclusion' },
      { pattern: /(?:^|\W)(?:select|insert|update|delete|drop|alter|truncate)(?:\s|$)/i, name: 'sql_injection_advanced' },
    ];

    const requestData = {
      url: req.originalUrl,
      body: JSON.stringify(req.body),
      query: JSON.stringify(req.query),
      headers: JSON.stringify(this.sanitizeHeaders(req.headers)),
    };

    return suspiciousPatterns
      .filter(({ pattern }) => 
        Object.values(requestData).some(data => pattern.test(data))
      )
      .map(({ name }) => name);
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-csrf-token',
      'x-requested-with',
    ];

    sensitiveHeaders.forEach(header => delete sanitized[header]);
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'credit_card',
      'ssn',
    ];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeQuery(query: any): any {
    if (!query) return query;
    
    const sanitized = { ...query };
    const sensitiveParams = [
      'token',
      'key',
      'secret',
      'password',
    ];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveParams.some(param => key.toLowerCase().includes(param))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
} 