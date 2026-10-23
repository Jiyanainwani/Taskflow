import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Team, TeamDocument, TeamRole } from '../../teams/schemas/team.schema.js';
import { Task, TaskDocument } from '../schemas/task.schema.js';

@Injectable()
export class TeamTaskWriteGuard implements CanActivate {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;
    if (!userId) throw new ForbiddenException('User not authenticated');

    let teamId = request.body?.teamId as string | undefined;
    if (!teamId && request.params?.id) {
      if (!Types.ObjectId.isValid(request.params.id)) return true;
      const task = await this.taskModel
        .findOne({ _id: new Types.ObjectId(request.params.id) })
        .select('teamId')
        .exec();
      teamId = task?.teamId?.toString();
    }

    if (!teamId) return true;
    if (!Types.ObjectId.isValid(teamId)) {
      throw new BadRequestException('Invalid team ID');
    }

    const userObjectId = new Types.ObjectId(userId);
    const team = await this.teamModel
      .findOne({
        _id: new Types.ObjectId(teamId),
        $or: [
          { owner: userObjectId },
          { 'members.user': userObjectId },
        ],
      })
      .exec();

    if (!team) throw new NotFoundException('Team not found');

    const role =
      team.owner.toString() === userId
        ? TeamRole.OWNER
        : team.members.find((member) => member.user.toString() === userId)?.role;

    if (!role) throw new NotFoundException('Team membership not found');
    if (role === TeamRole.VIEWER) {
      throw new ForbiddenException('Viewers can only read team tasks');
    }

    request.team = team;
    request.teamRole = role;
    return true;
  }
}
