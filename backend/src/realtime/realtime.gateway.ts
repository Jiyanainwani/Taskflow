import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';

import type { RealtimeEvent } from './realtime.events.js';

@Injectable()
@WebSocketGateway({
  transports: ['websocket'],
  cors: { origin: true },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
  }

  async handleConnection(client: Socket) {
    const token: unknown = client.handshake.auth?.token;
    const origin = client.handshake.headers.origin;
    const configuredFrontend =
      this.configService.getOrThrow<string>('FRONTEND_URL');

    if (
      origin &&
      this.normalizedOrigin(origin) !==
        this.normalizedOrigin(configuredFrontend)
    ) {
      client.disconnect(true);
      return;
    }

    if (typeof token !== 'string' || !token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        type?: string;
        exp?: number;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        payload.type === 'refresh' ||
        typeof payload.exp !== 'number'
      ) {
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.sub;
      await client.join(this.userRoom(payload.sub));
      const millisecondsUntilExpiry = payload.exp * 1000 - Date.now();
      if (millisecondsUntilExpiry <= 0) {
        client.disconnect(true);
        return;
      }

      const expiryTimer = setTimeout(
        () => client.disconnect(true),
        millisecondsUntilExpiry,
      );
      expiryTimer.unref();
      client.data.authExpiryTimer = expiryTimer;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const timer = client.data.authExpiryTimer;
    if (timer) clearTimeout(timer);
  }

  broadcastToUsers(recipientIds: string[], event: RealtimeEvent) {
    if (!this.server || recipientIds.length === 0) return;
    this.server
      .to(recipientIds.map((userId) => this.userRoom(userId)))
      .emit('taskflow.event', event);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private normalizedOrigin(value: string) {
    try {
      return new URL(value).origin;
    } catch {
      return '';
    }
  }
}
