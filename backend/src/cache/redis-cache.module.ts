import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { RedisTaskListCache } from './redis-task-list.cache.js';
import { REDIS_CLIENT } from './redis.constants.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
          commandTimeout: 500,
          connectTimeout: 500,
          maxRetriesPerRequest: 1,
          retryStrategy: (attempt) => Math.min(attempt * 200, 1000),
        });
        const logger = new Logger('Redis');

        client.on('error', (error: Error) => {
          logger.warn(`Redis unavailable; task-list caching is disabled: ${error.message}`);
        });

        return client;
      },
    },
    RedisTaskListCache,
  ],
  exports: [REDIS_CLIENT, RedisTaskListCache],
})
export class RedisCacheModule {}

