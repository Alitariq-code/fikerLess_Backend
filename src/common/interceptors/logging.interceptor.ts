import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, ip, body, query, params } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Log request
    this.logger.log(
      `→ ${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    // Log request body (excluding sensitive data)
    if (body && Object.keys(body).length > 0) {
      const sanitizedBody = this.sanitizeBody(body);
      if (Object.keys(sanitizedBody).length > 0) {
        this.logger.debug(`Request Body: ${JSON.stringify(sanitizedBody)}`);
      }
    }

    // Log query params
    if (query && Object.keys(query).length > 0) {
      this.logger.debug(`Query Params: ${JSON.stringify(query)}`);
    }

    // Log route params
    if (params && Object.keys(params).length > 0) {
      this.logger.debug(`Route Params: ${JSON.stringify(params)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          
          // Log successful response
          this.logger.log(
            `← ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          );

          // Log response data for debugging (can be disabled in production)
          if (process.env.NODE_ENV !== 'production') {
            const responsePreview = this.previewResponse(data);
            if (responsePreview) {
              this.logger.debug(`Response: ${responsePreview}`);
            }
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error?.status || error?.statusCode || 500;
          
          // Log error response
          this.logger.error(
            `✗ ${method} ${originalUrl} ${statusCode} - ${duration}ms - ${error?.message || 'Internal Server Error'}`,
          );

          // Log full error details
          if (error?.stack) {
            this.logger.error(`Error Stack: ${error.stack}`);
          }

          if (error?.response) {
            this.logger.error(`Error Response: ${JSON.stringify(error.response)}`);
          }
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    const sensitiveFields = ['password', 'token', 'authorization', 'otp', 'otp_token'];
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  private previewResponse(data: any): string {
    if (!data) return null;
    
    try {
      const str = JSON.stringify(data);
      // Limit response preview to 500 characters
      return str.length > 500 ? str.substring(0, 500) + '...' : str;
    } catch (error) {
      return '[Non-serializable response]';
    }
  }
}

