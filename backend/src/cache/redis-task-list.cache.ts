import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { QueryTasksDto } from '../tasks/dto/query-tasks.dto.js';
import { REDIS_CLIENT } from './redis.constants.js';

const TASK_LIST_VERSION_KEY = 'taskflow:cache:task-list:version';
const TASK_LIST_TTL_SECONDS = 30;
const TASK_LIST_HITS_KEY = 'taskflow:metrics:task-list:hits';
const TASK_LIST_MISSES_KEY = 'taskflow:metrics:task-list:misses';

@Injectable()
export class RedisTaskListCache implements OnModuleDestroy {
  private readonly logger = new Logger(RedisTaskListCache.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(userId: string, query: QueryTasksDto): Promise<T | null> {
    try {
      const version = (await this.redis.get(TASK_LIST_VERSION_KEY)) ?? '0';
      const value = await this.redis.get(this.key(version, userId, query));
      void this.recordRead(value !== null);
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error) {
      this.logger.warn(`Task-list cache read failed: ${this.errorMessage(error)}`);
      return null;
    }
  }

  async set<T>(userId: string, query: QueryTasksDto, value: T): Promise<void> {
    try {
      const version = (await this.redis.get(TASK_LIST_VERSION_KEY)) ?? '0';
      await this.redis.set(
        this.key(version, userId, query),
        JSON.stringify(value),
        'EX',
        TASK_LIST_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`Task-list cache write failed: ${this.errorMessage(error)}`);
    }
  }

  async invalidate(): Promise<void> {
    try {
      await this.redis.incr(TASK_LIST_VERSION_KEY);
    } catch (error) {
      this.logger.warn(`Task-list cache invalidation failed: ${this.errorMessage(error)}`);
    }
  }

  async getReadStats(): Promise<{ hits: number; misses: number }> {
    const [hits, misses] = await this.redis.mget(
      TASK_LIST_HITS_KEY,
      TASK_LIST_MISSES_KEY,
    );

    return { hits: Number(hits ?? 0), misses: Number(misses ?? 0) };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }

  private key(version: string, userId: string, query: QueryTasksDto): string {
    const queryKey = Buffer.from(
      JSON.stringify({
        limit: query.limit ?? 20,
        cursor: query.cursor ?? null,
        status: query.status ?? null,
        priority: query.priority ?? null,
      }),
    ).toString('base64url');

    return `taskflow:cache:task-list:v${version}:user:${userId}:${queryKey}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown Redis error';
  }

  private async recordRead(hit: boolean): Promise<void> {
    try {
      await this.redis.incr(hit ? TASK_LIST_HITS_KEY : TASK_LIST_MISSES_KEY);
    } catch (error) {
      this.logger.warn(`Task-list cache metric update failed: ${this.errorMessage(error)}`);
    }
  }
}
