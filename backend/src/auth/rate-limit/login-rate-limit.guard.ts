import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { LoginRateLimiterService } from './login-rate-limiter.service.js';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: LoginRateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    const result = await this.rateLimiter.consume(ipAddress);

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
