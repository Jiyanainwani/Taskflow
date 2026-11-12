import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { GeminiAiModel } from './gemini-ai-model.js';
import { AiSearchService } from './ai-search.service.js';
import { TaskComment, TaskCommentSchema } from '../tasks/schemas/task-comment.schema.js';
import { AiSearchDocument, AiSearchDocumentSchema } from './schemas/ai-search-document.schema.js';
import { WorkspaceRagService } from './workspace-rag.service.js';
import { WorkspaceAssistantService } from './workspace-assistant.service.js';

@Module({
  imports: [
    TasksModule,
    MongooseModule.forFeature([
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: AiSearchDocument.name, schema: AiSearchDocumentSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AiController],
  providers: [AiService, AiSearchService, WorkspaceRagService, WorkspaceAssistantService, GeminiAiModel, AccessTokenGuard],
})
export class AiModule {}
