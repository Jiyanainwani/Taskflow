import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UsersModule } from '../users/users.module.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshSession,
  RefreshSessionSchema,
} from './schemas/refresh-session.schema.js';
import { AccessTokenGuard } from './guards/access-token.guards.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { GoogleStrategy } from './google.strategy.js';
import { LoginRateLimiterService } from './rate-limit/login-rate-limiter.service.js';
import { LoginRateLimitGuard } from './rate-limit/login-rate-limit.guard.js';

@Module({
  imports: [
     UsersModule,
    ConfigModule,
    MongooseModule.forFeature([
  { name: RefreshSession.name, schema: RefreshSessionSchema },
  { name: User.name, schema: UserSchema },
]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    AccessTokenGuard,
    GoogleStrategy,
    LoginRateLimiterService,
    LoginRateLimitGuard,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
