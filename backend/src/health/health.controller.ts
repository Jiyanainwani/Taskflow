import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Response } from 'express';
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../cache/redis.constants.js';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response) {
    const [mongodb, redis] = await Promise.all([
      this.checkMongo(),
      this.checkRedis(),
    ]);
    const healthy = mongodb && redis;

    response.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? 'ok' : 'error',
      checks: {
        mongodb: mongodb ? 'ok' : 'error',
        redis: redis ? 'ok' : 'error',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkMongo() {
    try {
      if (this.mongo.readyState !== 1 || !this.mongo.db) return false;
      const result = await this.mongo.db.admin().ping();
      return result.ok === 1;
    } catch {
      return false;
    }
  }

  private async checkRedis() {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
