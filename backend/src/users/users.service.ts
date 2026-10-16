import { ConflictException, Injectable } from '@nestjs/common';

import { User } from './schemas/user.schema.js';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(name: string, email: string, passwordHash: string) {
    const existingUser = await this.findByEmail(email);
    if(existingUser){
        throw new ConflictException('Email already exists');
    }
    return this.userModel.create({
        name,email:email.toLowerCase().trim(),
        passwordHash,
    });

  }

  async findByEmail(email:string){
    return this.userModel
    .findOne({email:email.toLowerCase().trim()})
    .select('+passwordHash')
    .exec();
  }
}
