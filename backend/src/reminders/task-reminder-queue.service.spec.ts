import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

import { TaskStatus } from '../tasks/schemas/task.schema.js';
import { TaskReminderProcessor } from './task-reminder.processor.js';
import { TaskReminderQueueService } from './task-reminder-queue.service.js';

describe('TaskReminderQueueService', () => {
  const taskId = new Types.ObjectId('507f1f77bcf86cd799439011');
  let service: TaskReminderQueueService;
  let queue: {
    add: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
  };
  let deadLetterQueue: {
    add: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
    getJob: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queue = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobs: vi.fn().mockResolvedValue([]),
    };
    deadLetterQueue = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobs: vi.fn().mockResolvedValue([]),
      getJob: vi.fn(),
    };
    service = new TaskReminderQueueService(
      { getOrThrow: vi.fn() } as unknown as ConfigService,
      {} as TaskReminderProcessor,
      {} as never,
    );
    Object.assign(service, { queue, deadLetterQueue });
  });

  it('schedules delayed reminders with retries and exponential backoff', async () => {
    const dueDate = new Date(Date.now() + 60_000);
    await service.syncTask({
      _id: taskId,
      status: TaskStatus.TODO,
      dueDate,
    } as never);

    expect(queue.add).toHaveBeenCalledWith(
      'due-date-reminder',
      { taskId: taskId.toString(), dueAt: dueDate.toISOString() },
      expect.objectContaining({
        jobId: `task-${taskId}-${dueDate.getTime()}`,
        delay: expect.any(Number),
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnFail: false,
      }),
    );
  });

  it('cancels pending reminders for completed tasks without scheduling another', async () => {
    await service.syncTask({
      _id: taskId,
      status: TaskStatus.DONE,
      dueDate: new Date(Date.now() + 60_000),
    } as never);

    expect(queue.getJobs).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('lists failed reminders and queues an admin retry before removing the dead-letter entry', async () => {
    const failedJob = {
      id: 'dead-letter-task-1',
      data: {
        taskId: taskId.toString(),
        dueAt: '2027-01-10T16:30:00.000Z',
        failedAt: '2027-01-10T16:31:00.000Z',
        attemptsMade: 3,
        reason: 'SMTP unavailable',
      },
      remove: vi.fn().mockResolvedValue(undefined),
    };
    deadLetterQueue.getJobs.mockResolvedValue([failedJob]);
    deadLetterQueue.getJob.mockResolvedValue(failedJob);

    await expect(service.listDeadLetters()).resolves.toEqual([
      { id: failedJob.id, ...failedJob.data },
    ]);
    await expect(service.retryDeadLetter(failedJob.id)).resolves.toEqual({
      message: 'Reminder queued for retry',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'due-date-reminder',
      { taskId: taskId.toString(), dueAt: failedJob.data.dueAt },
      expect.objectContaining({ attempts: 3, delay: 0 }),
    );
    expect(failedJob.remove).toHaveBeenCalledOnce();
  });

  it('copies a final failed attempt into the separate dead-letter queue', async () => {
    const job = {
      id: `task-${taskId}-date`,
      data: { taskId: taskId.toString(), dueAt: '2027-01-10T16:30:00.000Z' },
      attemptsMade: 3,
    };
    const serviceWithPrivateMethod = service as unknown as {
      moveToDeadLetter: (failedJob: typeof job, error: Error) => Promise<void>;
    };

    await serviceWithPrivateMethod.moveToDeadLetter.call(
      service,
      job,
      new Error('SMTP unavailable'),
    );

    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'failed-reminder',
      expect.objectContaining({
        taskId: taskId.toString(),
        dueAt: job.data.dueAt,
        attemptsMade: 3,
        reason: 'SMTP unavailable',
      }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^dead-letter-/),
        removeOnComplete: false,
      }),
    );
  });
});
