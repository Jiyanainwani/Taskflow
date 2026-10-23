import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { SignupDto } from './dto/signup.dto.js';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto.js';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshSession } from './schemas/refresh-session.schema.js';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/schemas/user.schema.js';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectModel(RefreshSession.name)
    private readonly refreshSessionModel: Model<RefreshSession>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async signup(signupDto: SignupDto) {
    const passwordHash = await argon2.hash(signupDto.password);
    const user = await this.usersService.create(
      signupDto.name,
      signupDto.email,
      passwordHash,
    );

    return {
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    };
  }
  async validateUser(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !(await argon2.verify(user.passwordHash, loginDto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };
  }
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.createRefreshSession(user.id);

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user,
    };
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private async createRefreshSession(userId: string) {
    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        jti,
        type: 'refresh',
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    await this.refreshSessionModel.create({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return refreshToken;
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string; type: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    // Atomically revoke the old session so it cannot be rotated twice.
    const session = await this.refreshSessionModel
      .findOneAndUpdate(
        {
          userId: payload.sub,
          tokenHash,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { revokedAt: new Date() } },
        { returnDocument: 'before' },
      )
      .exec();

    if (!session) {
      // A previously revoked token may be a reuse attempt.
      const previousSession = await this.refreshSessionModel
        .findOne({ userId: payload.sub, tokenHash })
        .exec();

      if (previousSession?.revokedAt) {
        // Revoke all currently active sessions for this user.
        await this.refreshSessionModel
          .updateMany(
            {
              userId: payload.sub,
              revokedAt: null,
              expiresAt: { $gt: new Date() },
            },
            { $set: { revokedAt: new Date() } },
          )
          .exec();
      }

      throw new UnauthorizedException(
        'Refresh token is invalid, expired, or reused',
      );
    }
    // Issue replacement tokens only after the old session is revoked.
    const accessToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    const newRefreshToken = await this.createRefreshSession(payload.sub);

    return {
      message: 'Tokens refreshed successfully',
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub: string;
          jti: string;
          type: string;
        }>(refreshToken, {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        });

        if (payload.type === 'refresh' && payload.sub && payload.jti) {
          await this.refreshSessionModel
            .updateOne(
              {
                userId: payload.sub,
                tokenHash: this.hashToken(refreshToken),
                revokedAt: null,
              },
              {
                $set: { revokedAt: new Date() },
              },
            )
            .exec();
        }
      } catch {
        // Invalid or expired tokens do not prevent logout.
      }
    }

    return { message: 'Logged out successfully' };
  }

  
async googleLogin(profile: {
  googleId: string;
  email: string;
  name: string;
}) {
  let user = await this.userModel
    .findOne({ googleId: profile.googleId })
    .exec();

  if (!user) {
    const emailAccount = await this.userModel
      .findOne({ email: profile.email })
      .exec();

    if (emailAccount) {
      throw new UnauthorizedException(
        'An account with this email already exists. Log in with your password first.',
      );
    }

    user = await this.userModel.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      passwordHash: await argon2.hash(randomUUID()),
    });
  }

  const userId = user._id.toString();

  const accessToken = await this.jwtService.signAsync(
    { sub: userId, email: user.email },
    {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    },
  );

  const refreshToken = await this.createRefreshSession(userId);

  return { accessToken, refreshToken };
}

}
