import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  TaskActivity,
  TaskActivityAction,
  TaskActivityDocument,
} from './schemas/task-activity.schema.js';
import { TaskComment } from './schemas/task-comment.schema.js';

@Injectable()
export class TaskActivityService {
  private readonly logger = new Logger(TaskActivityService.name);

  constructor(
    @InjectModel(TaskActivity.name)
    private readonly activityModel: Model<TaskActivityDocument>,
    @InjectModel(TaskComment.name)
    private readonly commentModel: Model<TaskComment>,
  ) {}

  async record(
    taskId: Types.ObjectId,
    actorId: string,
    action: TaskActivityAction,
    summary: string,
  ): Promise<void> {
    try {
      await this.activityModel.create({
        taskId,
        actor: new Types.ObjectId(actorId),
        action,
        summary,
      });
    } catch (error) {
      this.logger.warn(`Could not record task activity: ${this.errorMessage(error)}`);
    }
  }

  async listForTask(taskId: Types.ObjectId) {
    return this.activityModel
      .find({ taskId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .populate('actor', 'name email')
      .exec();
  }

  async deleteForTask(taskId: Types.ObjectId): Promise<void> {
    try {
      await Promise.all([
        this.activityModel.deleteMany({ taskId }).exec(),
        this.commentModel.deleteMany({ taskId }).exec(),
      ]);
    } catch (error) {
      this.logger.warn(`Could not remove task collaboration records: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown database error';
  }
}
