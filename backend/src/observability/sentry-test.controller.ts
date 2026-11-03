import {
  Controller,
  Get,
  NotFoundException,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { ReminderAdminGuard } from '../reminders/reminder-admin.guard.js';

@ApiTags('Observability')
@ApiBearerAuth()
@Controller('admin/observability')
@UseGuards(AccessTokenGuard, ReminderAdminGuard)
export class SentryTestController {
  constructor(private readonly config: ConfigService) {}

  @Get('sentry-test')
  triggerSentryTestError(): never {
    if (!this.config.get<boolean>('SENTRY_TEST_ENABLED', false)) {
      throw new NotFoundException();
    }
    if (!this.config.get<string>('SENTRY_DSN')) {
      throw new ServiceUnavailableException('Sentry is not configured');
    }
    throw new Error('Intentional TaskFlow Sentry integration test error');
  }
}
