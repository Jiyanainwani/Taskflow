import Redis from 'ioredis';
import { Types } from 'mongoose';

import { RealtimePublisherService } from '../src/realtime/realtime-publisher.service.js';
import type { RealtimeGateway } from '../src/realtime/realtime.gateway.js';

describe('Realtime Redis fan-out between API instances', () => {
  it('delivers a task event from one publisher to another instance', async () => {
    const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    const firstRedis = new Redis(redisUrl);
    const secondRedis = new Redis(redisUrl);
    const teamId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const ownerId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const memberId = new Types.ObjectId('507f1f77bcf86cd799439013');
    const teamModel = {
      findById: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            owner: ownerId,
            members: [{ user: memberId }],
          }),
        }),
      }),
    };
    const sourceGateway = { broadcastToUsers: vi.fn() };
    const remoteGateway = { broadcastToUsers: vi.fn() };
    const source = new RealtimePublisherService(
      firstRedis as never,
      teamModel as never,
      sourceGateway as unknown as RealtimeGateway,
    );
    const remote = new RealtimePublisherService(
      secondRedis as never,
      teamModel as never,
      remoteGateway as unknown as RealtimeGateway,
    );

    try {
      await Promise.all([firstRedis.ping(), secondRedis.ping()]);
      await Promise.all([source.onModuleInit(), remote.onModuleInit()]);
      await vi.waitFor(
        () => {
          expect((source as unknown as { subscribed: boolean }).subscribed).toBe(true);
          expect((remote as unknown as { subscribed: boolean }).subscribed).toBe(true);
        },
        { timeout: 3000 },
      );

      const event = {
        type: 'task.created' as const,
        taskId: '507f1f77bcf86cd799439014',
        occurredAt: new Date().toISOString(),
      };
      await source.publishTaskEvent(event, {
        _id: new Types.ObjectId(event.taskId),
        owner: ownerId,
        teamId,
      });
      await vi.waitFor(
        () => expect(remoteGateway.broadcastToUsers).toHaveBeenCalledOnce(),
        { timeout: 3000 },
      );

      expect(sourceGateway.broadcastToUsers).toHaveBeenCalledWith(
        [ownerId.toString(), memberId.toString()],
        event,
      );
      expect(remoteGateway.broadcastToUsers).toHaveBeenCalledWith(
        [ownerId.toString(), memberId.toString()],
        event,
      );
    } finally {
      await Promise.all([source.onModuleDestroy(), remote.onModuleDestroy()]);
      await Promise.all([firstRedis.quit(), secondRedis.quit()]);
    }
  });
});
