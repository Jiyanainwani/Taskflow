import { HealthController } from './health.controller.js';
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { Response } from 'express';

describe('HealthController', () => {
  const mongo = {
    readyState: 1,
    db: { admin: vi.fn().mockReturnValue({ ping: vi.fn().mockResolvedValue({ ok: 1 }) }) },
  };
  const redis = { ping: vi.fn().mockResolvedValue('PONG') };
  let controller: HealthController;
  let response: { status: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mongo.readyState = 1;
    mongo.db.admin().ping.mockResolvedValue({ ok: 1 });
    redis.ping.mockResolvedValue('PONG');
    response = { status: vi.fn() };
    controller = new HealthController(
      mongo as unknown as Connection,
      redis as unknown as Redis,
    );
  });

  it('returns healthy when MongoDB and Redis respond', async () => {
    await expect(controller.check(response as unknown as Response)).resolves.toMatchObject({
      status: 'ok',
      checks: { mongodb: 'ok', redis: 'ok' },
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('returns service unavailable when Redis is down', async () => {
    redis.ping.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(controller.check(response as unknown as Response)).resolves.toMatchObject({
      status: 'error',
      checks: { mongodb: 'ok', redis: 'error' },
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('returns service unavailable when MongoDB is disconnected', async () => {
    mongo.readyState = 0;

    await expect(controller.check(response as unknown as Response)).resolves.toMatchObject({
      status: 'error',
      checks: { mongodb: 'error', redis: 'ok' },
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
