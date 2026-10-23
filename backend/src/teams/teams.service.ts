
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Team, TeamDocument, TeamRole } from './schemas/team.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { RedisTaskListCache } from '../cache/redis-task-list.cache.js';

function idOf(value: Types.ObjectId | { _id: Types.ObjectId }): string {
  return ('_id' in value ? value._id : value).toString();
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly taskListCache: RedisTaskListCache,
  ) {}

  async create(userId: string, dto: CreateTeamDto) {
    const ownerId = new Types.ObjectId(userId);

    const team = new this.teamModel({
      ...dto,
      owner: ownerId,
      members: [
        {
          user: ownerId,
          role: TeamRole.OWNER,
        },
      ],
    });

    const savedTeam = await team.save();
    await this.taskListCache.invalidate();
    return savedTeam;
  }

  async findAll(userId: string) {
    const id = new Types.ObjectId(userId);

    return this.teamModel
      .find({
        $or: [{ owner: id }, { 'members.user': id }],
      })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  async findOne(userId: string, teamId: string) {
    if (!Types.ObjectId.isValid(teamId)) {
      throw new BadRequestException('Invalid team ID');
    }

    const id = new Types.ObjectId(userId);

    const team = await this.teamModel
      .findOne({
        _id: new Types.ObjectId(teamId),
        $or: [{ owner: id }, { 'members.user': id }],
      })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .exec();

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async inviteMember(
    userId: string,
    teamId: string,
    dto: InviteMemberDto,
  ) {
    const team = await this.findOne(userId, teamId);

    if (
      idOf(team.owner as Types.ObjectId | { _id: Types.ObjectId }) !== userId
    ) {
      throw new ForbiddenException(
        'Only the team owner can invite members',
      );
    }

    const user = await this.userModel
      .findOne({ email: dto.email.trim().toLowerCase() })
      .select('_id')
      .exec();

    if (!user) {
      throw new NotFoundException('No account found with that email');
    }

    const memberId = user._id as Types.ObjectId;

    const alreadyMember = team.members.some(
      (member) =>
        idOf(member.user as Types.ObjectId | { _id: Types.ObjectId }) ===
        memberId.toString(),
    );

    if (alreadyMember) {
      throw new BadRequestException(
        'User is already a team member',
      );
    }

    team.members.push({
      user: memberId,
      role: dto.role ?? TeamRole.MEMBER,
      joinedAt: new Date(),
    } as Team['members'][number]);

    const savedTeam = await team.save();
    await this.taskListCache.invalidate();
    return savedTeam;
  }

  async updateMemberRole(
    userId: string,
    teamId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const team = await this.findOne(userId, teamId);

    if (
      idOf(team.owner as Types.ObjectId | { _id: Types.ObjectId }) !== userId
    ) {
      throw new ForbiddenException(
        'Only the team owner can change roles',
      );
    }

    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const member = team.members.find(
      (item) =>
        idOf(item.user as Types.ObjectId | { _id: Types.ObjectId }) === memberId,
    );

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role === TeamRole.OWNER) {
      throw new BadRequestException(
        'Cannot change the owner role',
      );
    }

    member.role = dto.role;

    const savedTeam = await team.save();
    await this.taskListCache.invalidate();
    return savedTeam;
  }

  async removeMember(
    userId: string,
    teamId: string,
    memberId: string,
  ) {
    const team = await this.findOne(userId, teamId);

    if (
      idOf(team.owner as Types.ObjectId | { _id: Types.ObjectId }) !== userId
    ) {
      throw new ForbiddenException(
        'Only the team owner can remove members',
      );
    }

    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    const member = team.members.find(
      (item) =>
        idOf(item.user as Types.ObjectId | { _id: Types.ObjectId }) === memberId,
    );

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role === TeamRole.OWNER) {
      throw new BadRequestException(
        'Cannot remove the team owner',
      );
    }

    team.members = team.members.filter(
      (item) =>
        idOf(item.user as Types.ObjectId | { _id: Types.ObjectId }) !== memberId,
    );

    const savedTeam = await team.save();
    await this.taskListCache.invalidate();
    return savedTeam;
  }

  async remove(userId: string, teamId: string) {
    const team = await this.findOne(userId, teamId);

    if (
      idOf(team.owner as Types.ObjectId | { _id: Types.ObjectId }) !== userId
    ) {
      throw new ForbiddenException(
        'Only the team owner can delete the team',
      );
    }

    await this.teamModel
      .deleteOne({
        _id: team._id,
        owner: new Types.ObjectId(userId),
      })
      .exec();
    await this.taskListCache.invalidate();

    return { message: 'Team deleted successfully' };
  }
}
