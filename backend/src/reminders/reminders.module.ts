import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { ReminderAdminController } from './reminder-admin.controller.js';
import { ReminderAdminGuard } from './reminder-admin.guard.js';
import { TaskReminderEmailService } from './task-reminder-email.service.js';
import { TaskReminderProcessor } from './task-reminder.processor.js';
import { TaskReminderQueueService } from './task-reminder-queue.service.js';
import { SentryTestController } from '../observability/sentry-test.controller.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ReminderAdminController, SentryTestController],
  providers: [
    AccessTokenGuard,
    ReminderAdminGuard,
    TaskReminderEmailService,
    TaskReminderProcessor,
    TaskReminderQueueService,
  ],
  exports: [TaskReminderQueueService],
})
export class RemindersModule {}
