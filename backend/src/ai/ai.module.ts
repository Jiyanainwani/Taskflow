import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenGuard } from '../auth/guards/access-token.guards.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { GeminiAiModel } from './gemini-ai-model.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AiController],
  providers: [AiService, GeminiAiModel, AccessTokenGuard],
})
export class AiModule {}
