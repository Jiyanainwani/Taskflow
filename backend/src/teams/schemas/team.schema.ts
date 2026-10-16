import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum TeamRole {
  OWNER = 'owner',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Schema({ _id: false })
export class TeamMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({
    type: String,
    enum: TeamRole,
    required: true,
    default: TeamRole.MEMBER,
  })
  role: TeamRole;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

@Schema({ timestamps: true })
export class Team {
  @Prop({ type:String,required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({type:String, trim: true, maxlength: 1000, default: '' })
  description: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  owner: Types.ObjectId;

  @Prop({ type: [TeamMemberSchema], default: [] })
  members: TeamMember[];
}

export type TeamDocument = HydratedDocument<Team>;

export const TeamSchema = SchemaFactory.createForClass(Team);

TeamSchema.index({ owner: 1, createdAt: -1 });
TeamSchema.index({ 'members.user': 1 });
