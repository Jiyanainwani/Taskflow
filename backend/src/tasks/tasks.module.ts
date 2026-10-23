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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, AccessTokenGuard, TeamTaskWriteGuard],
})
export class TasksModule {}
