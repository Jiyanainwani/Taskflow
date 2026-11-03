import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import Joi from 'joi';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { RedisCacheModule } from './cache/redis-cache.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { HealthController } from './health/health.controller.js';
import { LoggerModule } from 'nestjs-pino';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers.set-cookie',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3001),
        MONGODB_URI: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        FRONTEND_URL: Joi.string().uri().required(),
        GOOGLE_CALLBACK_URL: Joi.string().uri().allow('').default(''),
        REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),
        SMTP_HOST: Joi.string().allow('').default(''),
        SMTP_PORT: Joi.number().integer().min(1).max(65535).default(587),
        SMTP_SECURE: Joi.boolean().default(false),
        SMTP_USER: Joi.string().allow('').default(''),
        SMTP_PASSWORD: Joi.string().allow('').default(''),
        SMTP_FROM: Joi.string().email().allow('').default(''),
        TASKFLOW_ADMIN_USER_IDS: Joi.string().allow('').default(''),
        S3_ENDPOINT: Joi.string().uri().allow('').default(''),
        S3_REGION: Joi.string().default('us-east-1'),
        S3_BUCKET: Joi.string().allow('').default(''),
        S3_ACCESS_KEY_ID: Joi.string().allow('').default(''),
        S3_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
        SENTRY_DSN: Joi.string().uri().allow('').default(''),
        SENTRY_ENVIRONMENT: Joi.string().allow('').default(''),
        SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0),
        SENTRY_TEST_ENABLED: Joi.boolean().default(false),
      }),
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
    }),

    UsersModule,

    AuthModule,

    TasksModule,

    ProjectsModule,

    TeamsModule,
    RedisCacheModule,
    RealtimeModule,
    RemindersModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule {}
