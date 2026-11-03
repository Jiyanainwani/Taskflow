import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

import { RealtimeGateway } from './realtime.gateway.js';

describe('RealtimeGateway', () => {
  const allowedOrigin = 'http://localhost:3000';
  let gateway: RealtimeGateway;
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let client: {
    handshake: {
      auth: Record<string, unknown>;
      headers: Record<string, string>;
    };
    data: Record<string, unknown>;
    join: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    jwtService = { verifyAsync: vi.fn() };
    const configService = {
      getOrThrow: (key: string) =>
        key === 'FRONTEND_URL' ? allowedOrigin : 'access-secret',
    };
    gateway = new RealtimeGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
    client = {
      handshake: {
        auth: { token: 'access-token' },
        headers: { origin: allowedOrigin },
      },
      data: {},
      join: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
  });

  it('authenticates an access token and joins only that user room', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-123',
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    await gateway.handleConnection(client as unknown as Socket);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(client.join).toHaveBeenCalledWith('user:user-123');
    expect(client.data.userId).toBe('user-123');
    expect(client.disconnect).not.toHaveBeenCalled();
    gateway.handleDisconnect(client as unknown as Socket);
  });

  it('rejects a missing token before joining a room', async () => {
    client.handshake.auth = {};

    await gateway.handleConnection(client as unknown as Socket);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens and tokens from an unapproved origin', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-123',
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    await gateway.handleConnection(client as unknown as Socket);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();

    client.disconnect.mockClear();
    client.handshake.headers.origin = 'http://attacker.example';
    await gateway.handleConnection(client as unknown as Socket);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledOnce();
  });
});
