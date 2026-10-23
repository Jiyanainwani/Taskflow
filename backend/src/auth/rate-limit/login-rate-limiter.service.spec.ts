import { Redis } from 'ioredis';

import { LoginRateLimiterService } from './login-rate-limiter.service.js';

describe('LoginRateLimiterService', () => {
  let redis: { eval: ReturnType<typeof vi.fn> };
  let service: LoginRateLimiterService;

  beforeEach(() => {
    redis = { eval: vi.fn().mockResolvedValue([1, 0]) };
    service = new LoginRateLimiterService(redis as unknown as Redis);
  });

  it('allows an attempt when it is within the sliding-window limit', async () => {
    await expect(service.consume('203.0.113.20')).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('ZREMRANGEBYSCORE'"),
      1,
      expect.stringMatching(/^taskflow:rate-limit:auth:login:[a-f0-9]{64}$/),
      '900000',
      '10',
      expect.any(String),
    );
    expect(redis.eval.mock.calls[0][2]).not.toContain('203.0.113.20');
  });

  it('returns the retry delay when the IP has reached its limit', async () => {
    redis.eval.mockResolvedValue([0, 42]);

    await expect(service.consume('203.0.113.20')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 42,
    });
  });

  it('allows login when Redis is unavailable', async () => {
    redis.eval.mockRejectedValue(new Error('connection refused'));

    await expect(service.consume('203.0.113.20')).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });
});
