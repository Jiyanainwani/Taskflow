import { EventEmitter } from 'node:events';
import { Types } from 'mongoose';

import { RealtimePublisherService } from './realtime-publisher.service.js';
import type { RealtimeGateway } from './realtime.gateway.js';

class RedisBroker {
  subscribers: FakeRedis[] = [];

  createClient() {
    const client = new FakeRedis(this);
    return client;
  }
}

class FakeRedis extends EventEmitter {
  status = 'ready';
  private channels = new Set<string>();

  constructor(private readonly broker: RedisBroker) {
    super();
  }

  duplicate() {
    const duplicate = this.broker.createClient();
    this.broker.subscribers.push(duplicate);
    return duplicate;
  }

  async subscribe(channel: string) {
    this.channels.add(channel);
  }

  async publish(channel: string, message: string) {
    for (const subscriber of this.broker.subscribers) {
      if (subscriber.hasChannel(channel))
        subscriber.emit('message', channel, message);
    }
    return this.broker.subscribers.length;
  }

  async quit() {
    this.status = 'end';
    return 'OK';
  }

  hasChannel(channel: string) {
    return this.channels.has(channel);
  }
}

describe('RealtimePublisherService', () => {
  it('fans out only to the task owner and team members through Redis', async () => {
    const broker = new RedisBroker();
    const baseRedis = broker.createClient();
    const ownerId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const memberId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const teamId = new Types.ObjectId('507f1f77bcf86cd799439013');
    const teamModel = {
      findById: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi
            .fn()
            .mockResolvedValue({
              owner: ownerId,
              members: [{ user: memberId }],
            }),
        }),
      }),
    };
    const localGateway = { broadcastToUsers: vi.fn() };
    const remoteGateway = { broadcastToUsers: vi.fn() };
    const localService = new RealtimePublisherService(
      baseRedis as never,
      teamModel as never,
      localGateway as unknown as RealtimeGateway,
    );
    const remoteService = new RealtimePublisherService(
      baseRedis as never,
      teamModel as never,
      remoteGateway as unknown as RealtimeGateway,
    );

    await Promise.all([
      localService.onModuleInit(),
      remoteService.onModuleInit(),
    ]);
    const event = {
      type: 'task.comment.added' as const,
      taskId: 'task-1',
      occurredAt: '2026-11-02T00:00:00.000Z',
    };
    await localService.publishTaskEvent(event, {
      _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
      owner: ownerId,
      teamId,
    });

    const expectedRecipients = [ownerId.toString(), memberId.toString()];
    expect(localGateway.broadcastToUsers).toHaveBeenCalledWith(
      expectedRecipients,
      event,
    );
    expect(remoteGateway.broadcastToUsers).toHaveBeenCalledWith(
      expectedRecipients,
      event,
    );
    expect(localGateway.broadcastToUsers).toHaveBeenCalledOnce();
    expect(remoteGateway.broadcastToUsers).toHaveBeenCalledOnce();

    await Promise.all([
      localService.onModuleDestroy(),
      remoteService.onModuleDestroy(),
    ]);
  });
});
