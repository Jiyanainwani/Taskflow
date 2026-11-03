import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Queue, Worker } from 'bullmq';
import { Model, Types } from 'mongoose';

import {
  Task,
  TaskDocument,
  TaskStatus,
} from '../tasks/schemas/task.schema.js';
import {
  TASK_REMINDER_ATTEMPTS,
  TASK_REMINDER_BACKOFF_MS,
  TASK_REMINDER_DEAD_LETTER_QUEUE,
  TASK_REMINDER_QUEUE,
  type DeadLetterJob,
  type TaskReminderJob,
} from './reminder.types.js';
import { TaskReminderProcessor } from './task-reminder.processor.js';

@Injectable()
export class TaskReminderQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskReminderQueueService.name);
  private queue?: Queue<TaskReminderJob>;
  private deadLetterQueue?: Queue<DeadLetterJob>;
  private worker?: Worker<TaskReminderJob>;
  private reconcileTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly processor: TaskReminderProcessor,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
  ) {}

  onModuleInit() {
    const url = this.configService.getOrThrow<string>('REDIS_URL');
    this.queue = new Queue<TaskReminderJob>(TASK_REMINDER_QUEUE, {
      connection: { url, maxRetriesPerRequest: 1 },
    });
    this.deadLetterQueue = new Queue<DeadLetterJob>(
      TASK_REMINDER_DEAD_LETTER_QUEUE,
      { connection: { url, maxRetriesPerRequest: 1 } },
    );
    this.worker = new Worker<TaskReminderJob>(
      TASK_REMINDER_QUEUE,
      (job) => this.processor.process(job),
      { connection: { url, maxRetriesPerRequest: null }, concurrency: 5 },
    );

    const logQueueError = (error: Error) => {
      this.logger.warn(`Reminder queue error: ${error.message}`);
    };
    this.queue.on('error', logQueueError);
    this.deadLetterQueue.on('error', logQueueError);
    this.worker.on('error', logQueueError);

    this.worker.on('failed', (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      void this.moveToDeadLetter(job, error).catch((failure: unknown) => {
        const message =
          failure instanceof Error ? failure.message : 'unknown error';
        this.logger.error(
          `Could not save failed reminder to dead-letter queue: ${message}`,
        );
      });
    });

    void this.restorePendingReminders();
    this.reconcileTimer = setInterval(
      () => void this.restorePendingReminders(),
      5 * 60 * 1000,
    );
    this.reconcileTimer.unref();
  }

  async onModuleDestroy() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    await Promise.allSettled([
      this.worker?.close(),
      this.queue?.close(),
      this.deadLetterQueue?.close(),
    ]);
  }

  async syncTask(
    task: Pick<TaskDocument, '_id' | 'status' | 'dueDate'>,
    previousDueDate?: Date | null,
  ) {
    const taskId = task._id.toString();
    const dueDateChanged =
      previousDueDate !== undefined &&
      (previousDueDate?.getTime() ?? null) !==
        (task.dueDate?.getTime() ?? null);
    await this.cancelTask(taskId, dueDateChanged);
    if (task.status === TaskStatus.DONE || !task.dueDate) return;

    try {
      await this.enqueueReminder(taskId, task.dueDate);
    } catch (error) {
      this.logger.warn(
        `Could not schedule reminder for task ${taskId}: ${this.errorMessage(error)}`,
      );
    }
  }

  async cancelTask(taskId: string, includeCompleted = false) {
    if (!this.queue) return;
    try {
      const states: Array<
        'waiting' | 'delayed' | 'prioritized' | 'completed' | 'failed'
      > = ['waiting', 'delayed', 'prioritized'];
      if (includeCompleted) states.push('completed', 'failed');
      const jobs = await this.queue.getJobs(states);
      await Promise.all(
        jobs
          .filter((job) => job.data.taskId === taskId)
          .map((job) => job.remove()),
      );
    } catch (error) {
      this.logger.warn(
        `Could not cancel reminder for task ${taskId}: ${this.errorMessage(error)}`,
      );
    }
  }

  async listDeadLetters(limit = 50) {
    if (!this.deadLetterQueue) return [];
    const jobs = await this.deadLetterQueue.getJobs(
      ['waiting'],
      0,
      Math.max(0, Math.min(limit, 100) - 1),
      false,
    );
    return jobs.map((job) => ({
      id: job.id ?? '',
      taskId: job.data.taskId,
      dueAt: job.data.dueAt,
      failedAt: job.data.failedAt,
      attemptsMade: job.data.attemptsMade,
      reason: job.data.reason,
    }));
  }

  async retryDeadLetter(deadLetterId: string) {
    if (!this.deadLetterQueue || !this.queue) {
      throw new NotFoundException('Dead-letter queue is unavailable');
    }

    const failedJob = await this.deadLetterQueue.getJob(deadLetterId);
    if (!failedJob) throw new NotFoundException('Failed reminder not found');

    const taskId = failedJob.data.taskId;
    await this.queue.add(
      'due-date-reminder',
      { taskId, dueAt: failedJob.data.dueAt },
      this.reminderOptions(`retry-${taskId}-${Date.now()}`, 0),
    );
    await failedJob.remove();
    return { message: 'Reminder queued for retry' };
  }

  private async enqueueReminder(taskId: string, dueDate: Date) {
    if (!this.queue) return;
    const dueAt = dueDate.toISOString();
    const delay = Math.max(0, dueDate.getTime() - Date.now());
    await this.queue.add(
      'due-date-reminder',
      { taskId, dueAt },
      this.reminderOptions(`task-${taskId}-${dueDate.getTime()}`, delay),
    );
  }

  private reminderOptions(jobId: string, delay: number) {
    return {
      jobId,
      delay,
      attempts: TASK_REMINDER_ATTEMPTS,
      backoff: {
        type: 'exponential' as const,
        delay: TASK_REMINDER_BACKOFF_MS,
      },
      removeOnComplete: false,
      removeOnFail: false,
    };
  }

  private async restorePendingReminders() {
    try {
      const tasks = await this.taskModel
        .find({ dueDate: { $ne: null }, status: { $ne: TaskStatus.DONE } })
        .select('_id dueDate')
        .exec();
      for (const task of tasks) {
        if (task.dueDate) {
          await this.enqueueReminder(task._id.toString(), task.dueDate);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not restore pending reminders: ${this.errorMessage(error)}`,
      );
    }
  }

  private async moveToDeadLetter(job: Job<TaskReminderJob>, error: Error) {
    if (!this.deadLetterQueue) return;
    const payload: DeadLetterJob = {
      ...job.data,
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
      reason: error.message,
    };
    const key = Types.ObjectId.isValid(job.data.taskId)
      ? job.data.taskId
      : 'unknown-task';
    await this.deadLetterQueue.add('failed-reminder', payload, {
      jobId: `dead-letter-${key}-${Date.now()}`,
      removeOnComplete: false,
      removeOnFail: false,
    });
    this.logger.error(
      `Reminder for task ${job.data.taskId} moved to dead-letter queue`,
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
