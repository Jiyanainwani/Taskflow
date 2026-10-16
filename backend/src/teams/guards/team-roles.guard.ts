import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument, TeamRole } from '../schemas/team.schema.js';

@Injectable()
export class TeamRolesGuard implements CanActivate {
  constructor(
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const teamId = request.params.id;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!Types.ObjectId.isValid(teamId)) {
      throw new BadRequestException('Invalid team ID');
    }

    const team = await this.teamModel
      .findOne({
        _id: new Types.ObjectId(teamId),
        $or: [
          { owner: new Types.ObjectId(userId) },
          { 'members.user': new Types.ObjectId(userId) },
        ],
      })
      .exec();

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const member = team.members.find(
      (item) => item.user.toString() === userId,
    );

    const role =
  team.owner.toString() === userId
    ? TeamRole.OWNER
    : team.members.find(
        (item) => item.user.toString() === userId,
      )?.role;

if (role !== TeamRole.OWNER) {
  throw new ForbiddenException('Only the team owner can manage members');
}

    const allowedRoles: TeamRole[] = [TeamRole.OWNER];

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException(
        'Insufficient team permissions',
      );
    }

    request.team = team;
    request.teamRole = role;

    return true;
  }
}