import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TasksService } from './tasks.service.js';
import { TaskActivityAction } from './schemas/task-activity.schema.js';
import {
  TaskComment,
  TaskCommentDocument,
} from './schemas/task-comment.schema.js';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto.js';
import { TaskActivityService } from './task-activity.service.js';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service.js';

@Injectable()
export class TaskCollaborationService {
  constructor(
    @InjectModel(TaskComment.name)
    private readonly commentModel: Model<TaskCommentDocument>,
    private readonly tasksService: TasksService,
    private readonly taskActivityService: TaskActivityService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  async listComments(userId: string, taskId: string) {
    const task = await this.tasksService.findOne(userId, taskId);

    const comments = await this.commentModel
      .find({ taskId: task._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .populate('author', 'name email')
      .exec();

    return comments.reverse();
  }

  async createComment(
    userId: string,
    taskId: string,
    dto: CreateTaskCommentDto,
  ) {
    const task = await this.tasksService.findOne(userId, taskId);
    await this.tasksService.assertCanWriteTask(userId, task);

    const comment = new this.commentModel({
      taskId: task._id,
      author: new Types.ObjectId(userId),
      body: dto.body,
    });
    const savedComment = await comment.save();

    await this.taskActivityService.record(
      task._id,
      userId,
      TaskActivityAction.COMMENT_ADDED,
      'Added a comment',
    );

    await this.realtimePublisher.publishTaskEvent(
      {
        type: 'task.comment.added',
        taskId: task._id.toString(),
        occurredAt: new Date().toISOString(),
      },
      task,
    );

    return savedComment.populate('author', 'name email');
  }

  async listActivity(userId: string, taskId: string) {
    const task = await this.tasksService.findOne(userId, taskId);
    return this.taskActivityService.listForTask(task._id);
  }
}
