import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { Team, TeamSchema } from '../teams/schemas/team.schema.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimePublisherService } from './realtime-publisher.service.js';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Team.name, schema: TeamSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimePublisherService],
  exports: [RealtimePublisherService],
})
export class RealtimeModule {}
