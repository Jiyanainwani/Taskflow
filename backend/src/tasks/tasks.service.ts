import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Team, TeamDocument, TeamRole } from '../teams/schemas/team.schema.js';
import { Task, TaskDocument } from './schemas/task.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { RedisTaskListCache } from '../cache/redis-task-list.cache.js';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
    private readonly taskListCache: RedisTaskListCache,
  ) {}

  async create(
    userId: string,
    createTaskDto: CreateTaskDto,
  ): Promise<TaskDocument> {
    const teamId = createTaskDto.teamId
      ? new Types.ObjectId(createTaskDto.teamId)
      : null;

    if (teamId) {
      const role = await this.getTeamRole(userId, teamId.toString());
      this.assertCanWriteTeamTask(role);
    }

    const task = new this.taskModel({
      title: createTaskDto.title,
      description: createTaskDto.description ?? '',
      status: createTaskDto.status,
      priority: createTaskDto.priority,
      dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null,
      owner: new Types.ObjectId(userId),
      teamId,
    });

    const savedTask = await task.save();
    await this.taskListCache.invalidate();
    return savedTask;
  }

  async findAll(userId: string, query: QueryTasksDto) {
    const cachedPage = await this.taskListCache.get<{
      data: TaskDocument[];
      hasNextPage: boolean;
      nextCursor: string | null;
    }>(userId, query);
    if (cachedPage) return cachedPage;

    const limit = query.limit ?? 20;
    const userObjectId = new Types.ObjectId(userId);
    const teamIds = await this.getAccessibleTeamIds(userObjectId);
    const accessFilter = {
      $or: [
        { owner: userObjectId, teamId: null },
        { teamId: { $in: teamIds } },
      ],
    };
    const conditions: Record<string, unknown>[] = [accessFilter];

    if (query.status) conditions.push({ status: query.status });
    if (query.priority) conditions.push({ priority: query.priority });

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      conditions.push({
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      });
    }

    const results = await this.taskModel
      .find({ $and: conditions })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const hasNextPage = results.length > limit;
    const tasks = hasNextPage ? results.slice(0, limit) : results;
    const lastTask = tasks[tasks.length - 1];

    const page = {
      data: tasks,
      hasNextPage,
      nextCursor:
        hasNextPage && lastTask ? this.encodeCursor(lastTask) : null,
    };

    await this.taskListCache.set(userId, query, page);
    return page;
  }

  private async getAccessibleTeamIds(userId: Types.ObjectId) {
    const teams = await this.teamModel
      .find({
        $or: [
          { owner: userId },
          { 'members.user': userId },
        ],
      })
      .select('_id')
      .exec();

    return teams.map((team) => team._id);
  }

  private async getTeamRole(userId: string, teamId: string): Promise<TeamRole> {
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

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.owner.toString() === userId) return TeamRole.OWNER;

    const membership = team.members.find(
      (member) => member.user.toString() === userId,
    );
    if (!membership) throw new NotFoundException('Team membership not found');
    return membership.role;
  }

  private assertCanWriteTeamTask(role: TeamRole) {
    if (role === TeamRole.VIEWER) {
      throw new ForbiddenException('Viewers can only read team tasks');
    }
  }

  private async assertCanWriteTask(userId: string, task: TaskDocument) {
    if (task.teamId) {
      const role = await this.getTeamRole(userId, task.teamId.toString());
      this.assertCanWriteTeamTask(role);
      return;
    }

    if (task.owner.toString() !== userId) {
      throw new NotFoundException('Task not found');
    }
  }

  private encodeCursor(task: TaskDocument): string {
    const cursor = {
      createdAt: task.createdAt.toISOString(),
      id: task._id.toString(),
    };

    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeCursor(cursor: string): {
    createdAt: Date;
    id: Types.ObjectId;
  } {
    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      );

      if (
        typeof decoded !== 'object' ||
        decoded === null ||
        !('createdAt' in decoded) ||
        !('id' in decoded) ||
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string' ||
        !Types.ObjectId.isValid(decoded.id)
      ) {
        throw new Error('Invalid cursor structure');
      }

      const createdAt = new Date(decoded.createdAt);
      if (
        Number.isNaN(createdAt.getTime()) ||
        createdAt.toISOString() !== decoded.createdAt
      ) {
        throw new Error('Invalid cursor date');
      }

      return { createdAt, id: new Types.ObjectId(decoded.id) };
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }

  async findOne(userId: string, taskId: string): Promise<TaskDocument> {
    if (!Types.ObjectId.isValid(taskId)) {
      throw new NotFoundException('Task not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const teamIds = await this.getAccessibleTeamIds(userObjectId);
    const task = await this.taskModel
      .findOne({
        _id: new Types.ObjectId(taskId),
        $or: [
          { owner: userObjectId, teamId: null },
          { teamId: { $in: teamIds } },
        ],
      })
      .exec();

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(
    userId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskDocument> {
    const task = await this.findOne(userId, taskId);
    await this.assertCanWriteTask(userId, task);

    const updateData = {
      ...(updateTaskDto.title !== undefined && { title: updateTaskDto.title }),
      ...(updateTaskDto.description !== undefined && {
        description: updateTaskDto.description,
      }),
      ...(updateTaskDto.status !== undefined && { status: updateTaskDto.status }),
      ...(updateTaskDto.priority !== undefined && {
        priority: updateTaskDto.priority,
      }),
      ...(updateTaskDto.dueDate !== undefined && {
        dueDate: updateTaskDto.dueDate ? new Date(updateTaskDto.dueDate) : null,
      }),
    };

    const access = task.teamId
      ? { teamId: task.teamId }
      : { owner: new Types.ObjectId(userId) };
    const updatedTask = await this.taskModel
      .findOneAndUpdate(
        { _id: task._id, ...access },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedTask) throw new NotFoundException('Task not found');
    await this.taskListCache.invalidate();
    return updatedTask;
  }

  async remove(userId: string, taskId: string): Promise<{ message: string }> {
    const task = await this.findOne(userId, taskId);
    await this.assertCanWriteTask(userId, task);

    const access = task.teamId
      ? { teamId: task.teamId }
      : { owner: new Types.ObjectId(userId) };
    await this.taskModel
      .deleteOne({ _id: task._id, ...access })
      .exec();
    await this.taskListCache.invalidate();

    return { message: 'Task deleted successfully' };
  }
}
