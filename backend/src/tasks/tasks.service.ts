import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import {
  BadRequestException,
  

} from '@nestjs/common';
import { QueryTasksDto } from './dto/query-tasks.dto.js';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
  ) {}

  async create(
    userId: string,
    createTaskDto: CreateTaskDto,
  ): Promise<TaskDocument> {
    const task = new this.taskModel({
      title: createTaskDto.title,
      description: createTaskDto.description ?? '',
      status: createTaskDto.status,
      priority: createTaskDto.priority,
      dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null,
      owner: new Types.ObjectId(userId),
    });

    return task.save();
  }

 
async findAll(userId: string, query: QueryTasksDto) {
  const limit = query.limit ?? 20;

  const filter: Record<string, unknown> = {
    owner: new Types.ObjectId(userId),
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.cursor) {
    const cursor = this.decodeCursor(query.cursor);

    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        _id: { $lt: cursor.id },
      },
    ];
  }

  const results = await this.taskModel
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .exec();

  const hasNextPage = results.length > limit;
  const tasks = hasNextPage ? results.slice(0, limit) : results;
  const lastTask = tasks[tasks.length - 1];

  return {
    data: tasks,
    hasNextPage,
    nextCursor:
      hasNextPage && lastTask
        ? this.encodeCursor(lastTask)
        : null,
  };
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

    return {
      createdAt,
      id: new Types.ObjectId(decoded.id),
    };
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}


  async findOne(userId: string, taskId: string): Promise<TaskDocument> {
    if (!Types.ObjectId.isValid(taskId)) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.taskModel
      .findOne({
        _id: new Types.ObjectId(taskId),
        owner: new Types.ObjectId(userId),
      })
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(
    userId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskDocument> {
    await this.findOne(userId, taskId);

    const updateData = {
  ...(updateTaskDto.title !== undefined && {
    title: updateTaskDto.title,
  }),
  ...(updateTaskDto.description !== undefined && {
    description: updateTaskDto.description,
  }),
  ...(updateTaskDto.status !== undefined && {
    status: updateTaskDto.status,
  }),
  ...(updateTaskDto.priority !== undefined && {
    priority: updateTaskDto.priority,
  }),
  ...(updateTaskDto.dueDate !== undefined && {
    dueDate: updateTaskDto.dueDate
      ? new Date(updateTaskDto.dueDate)
      : null,
  }),
};

    const updatedTask = await this.taskModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(taskId),
          owner: new Types.ObjectId(userId),
        },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Task not found');
    }

    return updatedTask;
  }

  async remove(userId: string, taskId: string): Promise<{ message: string }> {
    await this.findOne(userId, taskId);

    await this.taskModel
      .deleteOne({
        _id: new Types.ObjectId(taskId),
        owner: new Types.ObjectId(userId),
      })
      .exec();

    return { message: 'Task deleted successfully' };
  }
}
