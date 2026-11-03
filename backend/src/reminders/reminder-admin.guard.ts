import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ReminderAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const admins = this.configService
      .get<string>('TASKFLOW_ADMIN_USER_IDS', '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!request.user?.id || !admins.includes(request.user.id)) {
      throw new ForbiddenException(
        'This view is restricted to TaskFlow administrators',
      );
    }
    return true;
  }
}
