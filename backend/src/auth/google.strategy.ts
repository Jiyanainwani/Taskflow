
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        `${(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    const emailVerified = (
      profile._json as { email_verified?: boolean }
    ).email_verified;

    if (!email || emailVerified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    return {
      googleId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName,
    };
  }
}
