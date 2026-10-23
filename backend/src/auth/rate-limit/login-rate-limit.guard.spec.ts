import { ExecutionContext, HttpStatus } from '@nestjs/common';

import { LoginRateLimitGuard } from './login-rate-limit.guard.js';

describe('LoginRateLimitGuard', () => {
  const ipAddress = '203.0.113.20';
  let rateLimiter: { consume: ReturnType<typeof vi.fn> };
  let response: { setHeader: ReturnType<typeof vi.fn> };
  let guard: LoginRateLimitGuard;
  let context: ExecutionContext;

  beforeEach(() => {
    rateLimiter = { consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) };
    response = { setHeader: vi.fn() };
    context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: ipAddress, socket: { remoteAddress: '127.0.0.1' } }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    guard = new LoginRateLimitGuard(rateLimiter as any);
  });

  it('allows the request and checks the client IP', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(rateLimiter.consume).toHaveBeenCalledWith(ipAddress);
  });

  it('sets Retry-After and rejects requests over the limit', async () => {
    rateLimiter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });
});
