import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema ,User} from './schemas/user.schema.js';

@Module({
  imports:[
    MongooseModule.forFeature([
      {name:User.name,schema:UserSchema},
    ]),
  ],
  exports:[UsersService],
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule {}
