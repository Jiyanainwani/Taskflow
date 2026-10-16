
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { RefreshSession } from './schemas/refresh-session.schema.js';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';

describe('AuthService', () => {
 let service: AuthService;
let jwtService: {
  verifyAsync: ReturnType<typeof vi.fn>;
  signAsync: ReturnType<typeof vi.fn>;
};

let refreshSessionModel: {
  updateOne: ReturnType<typeof vi.fn>;
  findOneAndUpdate: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};


  const refreshToken = 'valid-refresh-token';
  const payload = {
    sub: '507f1f77bcf86cd799439011',
    jti: 'test-jti',
    type: 'refresh',
  };

  beforeEach(async () => {
    
jwtService = {
  verifyAsync: vi.fn(),
  signAsync: vi.fn(),
};

refreshSessionModel = {
  updateOne: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  }),
  findOneAndUpdate: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue({ _id: 'session-id' }),
  }),
  findOne: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue(null),
  }),
  updateMany: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  }),
  create: vi.fn().mockResolvedValue({}),
};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue('test-refresh-secret'),
          },
        },
        {
          provide: getModelToken(RefreshSession.name),
          useValue: refreshSessionModel,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should revoke the matching refresh session on logout', async () => {
    jwtService.verifyAsync.mockResolvedValue(payload);

    const result = await service.logout(refreshToken);

    expect(result).toEqual({ message: 'Logged out successfully' });

    expect(refreshSessionModel.updateOne).toHaveBeenCalledWith(
      {
        userId: payload.sub,
        tokenHash: createHash('sha256')
          .update(refreshToken)
          .digest('hex'),
        revokedAt: null,
      },
      {
        $set: { revokedAt: expect.any(Date) },
      },
    );
  });

  it('should handle a missing refresh token', async () => {
    const result = await service.logout(undefined);

    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(refreshSessionModel.updateOne).not.toHaveBeenCalled();
  });

  it('should handle an invalid refresh token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

    const result = await service.logout('invalid-token');

    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(refreshSessionModel.updateOne).not.toHaveBeenCalled();
  });
it('should rotate a valid refresh token', async () => {
  jwtService.verifyAsync.mockResolvedValue(payload);
  jwtService.signAsync
    .mockResolvedValueOnce('new-access-token')
    .mockResolvedValueOnce('new-refresh-token');

  const result = await service.refresh(refreshToken);

  expect(result).toEqual({
    message: 'Tokens refreshed successfully',
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  });

  expect(refreshSessionModel.findOneAndUpdate).toHaveBeenCalledWith(
    {
      userId: payload.sub,
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      revokedAt: null,
      expiresAt: { $gt: expect.any(Date) },
    },
    { $set: { revokedAt: expect.any(Date) } },
    { returnDocument: 'before' },
  );

  expect(refreshSessionModel.create).toHaveBeenCalledWith({
    userId: payload.sub,
    tokenHash: createHash('sha256')
      .update('new-refresh-token')
      .digest('hex'),
    expiresAt: expect.any(Date),
  });
});

it('should reject an invalid refresh token', async () => {
  jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

  await expect(service.refresh('invalid-token')).rejects.toThrow(
    UnauthorizedException,
  );

  expect(refreshSessionModel.findOneAndUpdate).not.toHaveBeenCalled();
  expect(refreshSessionModel.create).not.toHaveBeenCalled();
});

it('should revoke active sessions when a refresh token is reused', async () => {
  jwtService.verifyAsync.mockResolvedValue(payload);

  refreshSessionModel.findOneAndUpdate.mockReturnValue({
    exec: vi.fn().mockResolvedValue(null),
  });

  refreshSessionModel.findOne.mockReturnValue({
    exec: vi.fn().mockResolvedValue({
      revokedAt: new Date(),
    }),
  });

  await expect(service.refresh(refreshToken)).rejects.toThrow(
    UnauthorizedException,
  );

  expect(refreshSessionModel.updateMany).toHaveBeenCalledWith(
    {
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { $gt: expect.any(Date) },
    },
    { $set: { revokedAt: expect.any(Date) } },
  );

  expect(refreshSessionModel.create).not.toHaveBeenCalled();
});

it('should reject a refresh token with no matching session', async () => {
  jwtService.verifyAsync.mockResolvedValue(payload);

  refreshSessionModel.findOneAndUpdate.mockReturnValue({
    exec: vi.fn().mockResolvedValue(null),
  });

  refreshSessionModel.findOne.mockReturnValue({
    exec: vi.fn().mockResolvedValue(null),
  });

  await expect(service.refresh(refreshToken)).rejects.toThrow(
    UnauthorizedException,
  );

  expect(refreshSessionModel.create).not.toHaveBeenCalled();
  expect(refreshSessionModel.updateMany).not.toHaveBeenCalled();
});
});
