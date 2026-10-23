
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { RefreshSession } from './schemas/refresh-session.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';

vi.mock('argon2', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
}));

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
let usersService: {
  create: ReturnType<typeof vi.fn>;
  findByEmail: ReturnType<typeof vi.fn>;
};
let userModel: {
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};


  const refreshToken = 'valid-refresh-token';
  const payload = {
    sub: '507f1f77bcf86cd799439011',
    jti: 'test-jti',
    type: 'refresh',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(argon2.hash).mockResolvedValue('hashed-password');
    vi.mocked(argon2.verify).mockResolvedValue(true);

jwtService = {
  verifyAsync: vi.fn(),
  signAsync: vi.fn(),
};

usersService = {
  create: vi.fn(),
  findByEmail: vi.fn(),
};

userModel = {
  findOne: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue(null),
  }),
  create: vi.fn(),
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
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) =>
              key === 'JWT_ACCESS_SECRET'
                ? 'test-access-secret'
                : 'test-refresh-secret',
            ),
          },
        },
        {
          provide: getModelToken(RefreshSession.name),
          useValue: refreshSessionModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('hashes the password and creates a user during signup', async () => {
    const createdUser = {
      _id: 'user-id',
      name: 'Test User',
      email: 'test@example.com',
    };
    usersService.create.mockResolvedValue(createdUser);

    await expect(
      service.signup({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual({
      message: 'User registered successfully',
      user: { id: 'user-id', name: 'Test User', email: 'test@example.com' },
    });

    expect(argon2.hash).toHaveBeenCalledWith('password123');
    expect(usersService.create).toHaveBeenCalledWith(
      'Test User',
      'test@example.com',
      'hashed-password',
    );
  });

  it('returns the validated user when the password matches', async () => {
    usersService.findByEmail.mockResolvedValue({
      _id: { toString: () => payload.sub },
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'stored-hash',
    });

    await expect(
      service.validateUser({ email: 'test@example.com', password: 'password123' }),
    ).resolves.toEqual({
      id: payload.sub,
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(argon2.verify).toHaveBeenCalledWith('stored-hash', 'password123');
  });

  it('rejects login when the email is unknown', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.validateUser({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it('rejects login when the password does not match', async () => {
    usersService.findByEmail.mockResolvedValue({
      _id: { toString: () => payload.sub },
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'stored-hash',
    });
    vi.mocked(argon2.verify).mockResolvedValue(false);

    await expect(
      service.validateUser({ email: 'test@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('signs access and refresh tokens during login', async () => {
    usersService.findByEmail.mockResolvedValue({
      _id: { toString: () => payload.sub },
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'stored-hash',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce(refreshToken);

    const result = await service.login({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result).toMatchObject({
      message: 'Login successful',
      accessToken: 'access-token',
      refreshToken,
      user: { id: payload.sub, email: 'test@example.com' },
    });
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      { sub: payload.sub, email: 'test@example.com' },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );
    expect(refreshSessionModel.create).toHaveBeenCalledWith({
      userId: payload.sub,
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: expect.any(Date),
    });
  });

  it('rejects a refresh token with an invalid payload type', async () => {
    jwtService.verifyAsync.mockResolvedValue({ ...payload, type: 'access' });

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(refreshSessionModel.findOneAndUpdate).not.toHaveBeenCalled();
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

  it('creates a Google user and session for a new account', async () => {
    const googleUser = {
      _id: { toString: () => 'google-user-id' },
      email: 'google@example.com',
    };
    userModel.create.mockResolvedValue(googleUser);
    jwtService.signAsync
      .mockResolvedValueOnce('google-access-token')
      .mockResolvedValueOnce('google-refresh-token');

    await expect(
      service.googleLogin({
        googleId: 'google-id',
        email: 'google@example.com',
        name: 'Google User',
      }),
    ).resolves.toEqual({
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
    });

    expect(userModel.create).toHaveBeenCalledWith({
      googleId: 'google-id',
      email: 'google@example.com',
      name: 'Google User',
      passwordHash: 'hashed-password',
    });
    expect(refreshSessionModel.create).toHaveBeenCalledWith({
      userId: 'google-user-id',
      tokenHash: createHash('sha256')
        .update('google-refresh-token')
        .digest('hex'),
      expiresAt: expect.any(Date),
    });
  });

  it('uses an existing Google account without creating another user', async () => {
    userModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: { toString: () => 'existing-google-user' },
        email: 'google@example.com',
      }),
    });
    jwtService.signAsync
      .mockResolvedValueOnce('google-access-token')
      .mockResolvedValueOnce('google-refresh-token');

    await service.googleLogin({
      googleId: 'google-id',
      email: 'google@example.com',
      name: 'Google User',
    });

    expect(userModel.create).not.toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'existing-google-user', email: 'google@example.com' },
      { secret: 'test-access-secret', expiresIn: '15m' },
    );
  });

  it('rejects Google login when the email belongs to a password account', async () => {
    userModel.findOne
      .mockReturnValueOnce({ exec: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue({ _id: 'password-user-id' }),
      });

    await expect(
      service.googleLogin({
        googleId: 'google-id',
        email: 'google@example.com',
        name: 'Google User',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userModel.create).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
