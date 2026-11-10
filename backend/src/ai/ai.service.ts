import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { Redis } from 'ioredis';
import { ZodError } from 'zod';

import { REDIS_CLIENT } from '../cache/redis.constants.js';
import { InvalidMagicOutputError, GeminiAiModel } from './gemini-ai-model.js';
import { MagicAddDto } from './dto/magic-add.dto.js';
import {
  MagicTasksSchema,
  type MagicTaskDraft,
} from './schemas/magic-task.schema.js';

const MAX_NOTES_LENGTH = 12_000;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const QUOTA_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIREAT', KEYS[1], ARGV[1])
end
if count > tonumber(ARGV[2]) then
  redis.call('DECR', KEYS[1])
  return -1
end
return count
`;

export type MagicAddResult = {
  tasks: MagicTaskDraft[];
  cached: boolean;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly model: GeminiAiModel,
    private readonly configService: ConfigService,
    private readonly pinoLogger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async generateMagicTasks(userId: string, dto: MagicAddDto): Promise<MagicAddResult> {
    const notes = this.normalizeNotes(dto.notes);
    if (!this.model.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI features are not configured. Please ask an administrator.',
      );
    }

    const quota = await this.consumeQuota(userId);
    const cacheKey = this.cacheKey(userId, notes);
    const cached = await this.readCache(cacheKey);

    if (cached) {
      await this.recordCacheHit(userId);
      this.pinoLogger.info(
        { userId, cacheHit: true, requestNumber: quota.used },
        'AI magic add served from cache',
      );
      return { tasks: cached, cached: true };
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await this.model.generateMagicTasks(
          notes,
          attempt === 1,
        );
        const tasks = MagicTasksSchema.parse(result.tasks);
        const estimatedCostUsd = this.estimateCost(
          result.inputTokens,
          result.outputTokens,
        );

        await this.writeCache(cacheKey, tasks);
        await this.recordModelUsage(
          userId,
          result.inputTokens,
          result.outputTokens,
          estimatedCostUsd,
        );

        this.pinoLogger.info(
          {
            userId,
            model: this.configService.get<string>('AI_TEXT_MODEL') ?? 'gemini-3.8-flash',
            attempt: attempt + 1,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            estimatedCostUsd,
          },
          'AI magic add completed',
        );

        return { tasks, cached: false };
      } catch (error) {
        if (
          (error instanceof InvalidMagicOutputError || error instanceof ZodError) &&
          attempt === 0
        ) {
          continue;
        }

        if (error instanceof InvalidMagicOutputError || error instanceof ZodError) {
          throw new BadGatewayException(
            'I could not structure tasks from those notes. Try simplifying them and try again.',
          );
        }

        this.logger.error('Gemini task generation failed');
        this.pinoLogger.error(
          {
            userId,
            attempt: attempt + 1,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          },
          'AI magic add provider request failed',
        );
        throw new ServiceUnavailableException(
          'Task suggestions are temporarily unavailable. Please try again.',
        );
      }
    }

    throw new BadGatewayException(
      'I could not structure tasks from those notes. Try simplifying them and try again.',
    );
  }

  async getUsage(userId: string) {
    const date = this.utcDateKey();
    const quotaKey = this.quotaKey(userId, date);
    const usageKey = this.usageKey(userId, date);

    try {
      const [quotaUsed, usage] = await Promise.all([
        this.redis.get(quotaKey),
        this.redis.hgetall(usageKey),
      ]);
      const dailyLimit = this.dailyLimit();
      const modelCalls = Number(usage.modelCalls ?? 0);
      const estimatedCostUsd = Number(usage.estimatedCostUsd ?? 0);

      return {
        date,
        requestsUsed: Number(quotaUsed ?? 0),
        dailyLimit,
        remaining: Math.max(0, dailyLimit - Number(quotaUsed ?? 0)),
        modelCalls,
        cacheHits: Number(usage.cacheHits ?? 0),
        inputTokens: Number(usage.inputTokens ?? 0),
        outputTokens: Number(usage.outputTokens ?? 0),
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
        averageCostPerModelCallUsd:
          modelCalls === 0
            ? 0
            : Number((estimatedCostUsd / modelCalls).toFixed(8)),
      };
    } catch {
      throw new ServiceUnavailableException(
        'AI usage information is temporarily unavailable.',
      );
    }
  }

  private normalizeNotes(value: string) {
    const notes = value.replace(/\r\n?/g, '\n').trim();
    if (!notes) throw new BadRequestException('Paste meeting notes first.');
    if (notes.length > MAX_NOTES_LENGTH) {
      throw new BadRequestException(
        `Meeting notes must be ${MAX_NOTES_LENGTH.toLocaleString()} characters or fewer.`,
      );
    }
    if (!/[\p{L}\p{N}]/u.test(notes)) {
      throw new BadRequestException(
        'Add some words or numbers so I can find task suggestions.',
      );
    }
    return notes;
  }

  private async consumeQuota(userId: string) {
    const now = new Date();
    const date = this.utcDateKey(now);
    const expiresAt = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) /
        1000,
    );

    try {
      const result = await this.redis.eval(
        QUOTA_SCRIPT,
        1,
        this.quotaKey(userId, date),
        String(expiresAt),
        String(this.dailyLimit()),
      );
      if (Number(result) < 0) {
        throw new HttpException(
          'You have reached today’s AI request limit. Try again tomorrow.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return { used: Number(result), date };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'AI requests are temporarily unavailable. Please try again.',
      );
    }
  }

  private async readCache(key: string): Promise<MagicTaskDraft[] | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return MagicTasksSchema.parse(JSON.parse(value));
    } catch {
      throw new ServiceUnavailableException(
        'AI task suggestions are temporarily unavailable. Please try again.',
      );
    }
  }

  private async writeCache(key: string, tasks: MagicTaskDraft[]) {
    try {
      await this.redis.set(
        key,
        JSON.stringify(tasks),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      // A cache write should not discard valid model output.
    }
  }

  private async recordCacheHit(userId: string) {
    try {
      const key = this.usageKey(userId, this.utcDateKey());
      await this.redis.hincrby(key, 'cacheHits', 1);
      await this.redis.expire(key, CACHE_TTL_SECONDS);
    } catch {
      // Usage telemetry must not block a cached response.
    }
  }

  private async recordModelUsage(
    userId: string,
    inputTokens: number,
    outputTokens: number,
    estimatedCostUsd: number,
  ) {
    try {
      const key = this.usageKey(userId, this.utcDateKey());
      await this.redis
        .multi()
        .hincrby(key, 'modelCalls', 1)
        .hincrby(key, 'inputTokens', inputTokens)
        .hincrby(key, 'outputTokens', outputTokens)
        .hincrbyfloat(key, 'estimatedCostUsd', estimatedCostUsd)
        .expire(key, CACHE_TTL_SECONDS)
        .exec();
    } catch {
      this.logger.warn('Unable to record AI usage metrics');
    }
  }

  private cacheKey(userId: string, notes: string) {
    const hash = createHash('sha256').update(notes).digest('hex');
    return `taskflow:ai:v1:magic-add:cache:${userId}:${hash}`;
  }

  private quotaKey(userId: string, date: string) {
    return `taskflow:ai:v1:quota:${userId}:${date}`;
  }

  private usageKey(userId: string, date: string) {
    return `taskflow:ai:v1:usage:${userId}:${date}`;
  }

  private dailyLimit() {
    return this.configService.get<number>('AI_DAILY_REQUEST_LIMIT') ?? 10;
  }

  private estimateCost(inputTokens: number, outputTokens: number) {
    const inputRate =
      this.configService.get<number>('AI_INPUT_USD_PER_MILLION') ?? 0.75;
    const outputRate =
      this.configService.get<number>('AI_OUTPUT_USD_PER_MILLION') ?? 3.75;
    return (
      (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
    );
  }

  private utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }
}
