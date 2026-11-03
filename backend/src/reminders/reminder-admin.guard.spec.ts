import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ReminderAdminGuard } from './reminder-admin.guard.js';

describe('ReminderAdminGuard', () => {
  function makeContext(userId?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { id: userId } : undefined }),
      }),
    };
  }

  it('allows IDs from the configured comma-separated admin allowlist', () => {
    const config = {
      get: vi.fn().mockReturnValue('user-a, user-b'),
    } as unknown as ConfigService;
    const guard = new ReminderAdminGuard(config);

    expect(guard.canActivate(makeContext('user-b') as never)).toBe(true);
  });

  it('denies non-admins and denies everyone when no admin IDs are configured', () => {
    const config = {
      get: vi.fn().mockReturnValue(''),
    } as unknown as ConfigService;
    const guard = new ReminderAdminGuard(config);

    expect(() => guard.canActivate(makeContext('user-a') as never)).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(makeContext() as never)).toThrow(
      ForbiddenException,
    );
  });
});
