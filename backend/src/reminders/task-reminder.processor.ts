import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';

import { User } from '../users/schemas/user.schema.js';
import {
  Task,
  TaskDocument,
  TaskStatus,
} from '../tasks/schemas/task.schema.js';
import { TaskReminderEmailService } from './task-reminder-email.service.js';
import type { TaskReminderJob } from './reminder.types.js';

@Injectable()
export class TaskReminderProcessor {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly emailService: TaskReminderEmailService,
  ) {}

  async process(job: Job<TaskReminderJob>) {
    const task = await this.taskModel.findById(job.data.taskId).exec();
    if (
      !task ||
      task.status === TaskStatus.DONE ||
      !task.dueDate ||
      task.dueDate.toISOString() !== job.data.dueAt
    ) {
      return { skipped: true };
    }

    const owner = await this.userModel
      .findById(task.owner)
      .select('name email')
      .exec();
    if (!owner) throw new Error('Task owner was not found');

    await this.emailService.sendReminder({
      email: owner.email,
      name: owner.name,
      title: task.title,
      dueAt: task.dueDate,
    });

    return { sent: true };
  }
}
