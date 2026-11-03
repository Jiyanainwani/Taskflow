import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { ReminderAdminGuard } from './reminder-admin.guard.js';
import { TaskReminderQueueService } from './task-reminder-queue.service.js';

@ApiTags('Reminder administration')
@ApiBearerAuth()
@Controller('admin/reminders')
@UseGuards(AccessTokenGuard, ReminderAdminGuard)
export class ReminderAdminController {
  constructor(private readonly reminderQueue: TaskReminderQueueService) {}

  @Get('access')
  checkAdminAccess() {
    return { isAdmin: true };
  }

  @Get('dead-letters')
  listFailedReminders() {
    return this.reminderQueue.listDeadLetters();
  }

  @Post('dead-letters/:id/retry')
  retryFailedReminder(@Param('id') id: string) {
    return this.reminderQueue.retryDeadLetter(id);
  }
}
