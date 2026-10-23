import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../cache/redis.constants.js';

const ATTEMPT_LIMIT = 10;
const WINDOW_MILLISECONDS = 15 * 60 * 1000;

const SLIDING_WINDOW_SCRIPT = `
local redis_time = redis.call('TIME')
local now = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)

local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retry_after = math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
  redis.call('PEXPIRE', KEYS[1], window)
  return {0, retry_after}
end

redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
`;

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

@Injectable()
export class LoginRateLimiterService {
  private readonly logger = new Logger(LoginRateLimiterService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(ipAddress: string): Promise<LoginRateLimitResult> {
    const ipHash = createHash('sha256').update(ipAddress).digest('hex');
    const key = `taskflow:rate-limit:auth:login:${ipHash}`;

    try {
      const result = (await this.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(WINDOW_MILLISECONDS),
        String(ATTEMPT_LIMIT),
        randomUUID(),
      )) as [number | string, number | string];

      return {
        allowed: Number(result[0]) === 1,
        retryAfterSeconds: Number(result[1]),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown Redis error';
      this.logger.warn(`Login rate limit unavailable; allowing request: ${message}`);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}
