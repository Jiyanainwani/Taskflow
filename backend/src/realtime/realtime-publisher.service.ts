import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

import { Team, TeamDocument } from '../teams/schemas/team.schema.js';
import { REDIS_CLIENT } from '../cache/redis.constants.js';
import type { RealtimeEnvelope, RealtimeEvent } from './realtime.events.js';
import { RealtimeGateway } from './realtime.gateway.js';

const CHANNEL = 'taskflow:realtime:workspace-events';

type TaskRealtimeSource = {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  teamId: Types.ObjectId | null;
};

@Injectable()
export class RealtimePublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimePublisherService.name);
  private readonly instanceId = randomUUID();
  private publisher?: Redis;
  private subscriber?: Redis;
  private subscribed = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
    private readonly gateway: RealtimeGateway,
  ) {}

  async onModuleInit() {
    this.publisher = this.redis.duplicate();
    this.subscriber = this.redis.duplicate();

    this.publisher.on('error', (error: Error) => {
      this.logger.warn(
        `Realtime Redis publisher unavailable: ${error.message}`,
      );
    });
    this.subscriber.on('error', (error: Error) => {
      this.logger.warn(
        `Realtime Redis subscriber unavailable: ${error.message}`,
      );
    });
    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === CHANNEL) this.forwardMessage(message);
    });
    this.subscriber.on('ready', () => {
      void this.ensureSubscribed();
    });

    void this.ensureSubscribed();
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
  }

  async publishTaskEvent(event: RealtimeEvent, task: TaskRealtimeSource) {
    const recipientIds = await this.getRecipientIds(task);
    if (recipientIds.length === 0) return;

    const envelope: RealtimeEnvelope = {
      origin: this.instanceId,
      recipientIds,
      event,
    };

    try {
      if (!this.publisher || this.publisher.status !== 'ready') {
        throw new Error('Redis publisher is not ready');
      }
      await this.publisher.publish(CHANNEL, JSON.stringify(envelope));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown Redis error';
      this.logger.warn(
        `Realtime event could not reach other API instances: ${message}`,
      );
    }

    // Always update sockets connected to this API instance, even if Redis is down.
    this.gateway.broadcastToUsers(recipientIds, event);
  }

  private async ensureSubscribed() {
    if (!this.subscriber || this.subscribed) return;

    try {
      await this.subscriber.subscribe(CHANNEL);
      this.subscribed = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown Redis error';
      this.logger.warn(`Realtime Redis subscription failed: ${message}`);
    }
  }

  private async getRecipientIds(task: TaskRealtimeSource) {
    const recipients = new Set<string>([task.owner.toString()]);

    if (task.teamId) {
      try {
        const team = await this.teamModel
          .findById(task.teamId)
          .select('owner members.user')
          .exec();

        if (team) {
          recipients.add(team.owner.toString());
          for (const member of team.members) {
            recipients.add(member.user.toString());
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown database error';
        this.logger.warn(`Could not resolve task event recipients: ${message}`);
      }
    }

    return [...recipients];
  }

  private forwardMessage(message: string) {
    try {
      const envelope = JSON.parse(message) as Partial<RealtimeEnvelope>;
      if (
        typeof envelope.origin !== 'string' ||
        envelope.origin === this.instanceId ||
        !Array.isArray(envelope.recipientIds) ||
        !envelope.recipientIds.every((id) => typeof id === 'string') ||
        !this.isRealtimeEvent(envelope.event)
      ) {
        return;
      }

      this.gateway.broadcastToUsers(envelope.recipientIds, envelope.event);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'invalid Redis message';
      this.logger.warn(
        `Ignoring invalid realtime Redis message: ${messageText}`,
      );
    }
  }

  private isRealtimeEvent(value: unknown): value is RealtimeEvent {
    if (!value || typeof value !== 'object') return false;
    const event = value as Partial<RealtimeEvent>;
    return (
      typeof event.taskId === 'string' &&
      typeof event.occurredAt === 'string' &&
      (event.type === 'task.created' ||
        event.type === 'task.updated' ||
        event.type === 'task.deleted' ||
        event.type === 'task.comment.added')
    );
  }
}
