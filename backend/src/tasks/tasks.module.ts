import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { Task, TaskSchema } from './schemas/task.schema.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { Team, TeamSchema } from '../teams/schemas/team.schema.js';
import { TeamTaskWriteGuard } from './guards/team-task-write.guard.js';
import {
  TaskComment,
  TaskCommentSchema,
} from './schemas/task-comment.schema.js';
import {
  TaskActivity,
  TaskActivitySchema,
} from './schemas/task-activity.schema.js';
import { TaskActivityService } from './task-activity.service.js';
import { TaskCollaborationController } from './task-collaboration.controller.js';
import { TaskCollaborationService } from './task-collaboration.service.js';
import { RemindersModule } from '../reminders/reminders.module.js';
import { StorageModule } from '../storage/storage.module.js';
import {
  TaskAttachment,
  TaskAttachmentSchema,
} from './schemas/task-attachment.schema.js';
import { TaskAttachmentsController } from './task-attachments.controller.js';
import { TaskAttachmentsService } from './task-attachments.service.js';

@Module({
  imports: [
    RemindersModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Team.name, schema: TeamSchema },
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: TaskActivity.name, schema: TaskActivitySchema },
      { name: TaskAttachment.name, schema: TaskAttachmentSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [
    TasksController,
    TaskCollaborationController,
    TaskAttachmentsController,
  ],
  providers: [
    TasksService,
    TaskActivityService,
    TaskCollaborationService,
    TaskAttachmentsService,
    AccessTokenGuard,
    TeamTaskWriteGuard,
  ],
})
export class TasksModule {}
