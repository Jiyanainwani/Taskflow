import { Types } from 'mongoose';

import { TaskStatus } from '../tasks/schemas/task.schema.js';
import type { TaskReminderEmailService } from './task-reminder-email.service.js';
import { TaskReminderProcessor } from './task-reminder.processor.js';

describe('TaskReminderProcessor', () => {
  const taskId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const ownerId = new Types.ObjectId('507f1f77bcf86cd799439012');
  const dueDate = new Date('2027-01-10T16:30:00.000Z');
  let taskModel: { findById: ReturnType<typeof vi.fn> };
  let userModel: { findById: ReturnType<typeof vi.fn> };
  let emailService: { sendReminder: ReturnType<typeof vi.fn> };
  let processor: TaskReminderProcessor;

  beforeEach(() => {
    taskModel = {
      findById: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: taskId,
          owner: ownerId,
          title: 'Ship the release',
          status: TaskStatus.TODO,
          dueDate,
        }),
      }),
    };
    userModel = {
      findById: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi
            .fn()
            .mockResolvedValue({ name: 'Jiya', email: 'jiya@example.com' }),
        }),
      }),
    };
    emailService = { sendReminder: vi.fn().mockResolvedValue(undefined) };
    processor = new TaskReminderProcessor(
      taskModel as never,
      userModel as never,
      emailService as unknown as TaskReminderEmailService,
    );
  });

  it('emails the task owner when the due task still matches the queued date', async () => {
    const job = {
      data: { taskId: taskId.toString(), dueAt: dueDate.toISOString() },
    };

    await expect(processor.process(job as never)).resolves.toEqual({
      sent: true,
    });
    expect(taskModel.findById).toHaveBeenCalledWith(taskId.toString());
    expect(userModel.findById).toHaveBeenCalledWith(ownerId);
    expect(emailService.sendReminder).toHaveBeenCalledWith({
      email: 'jiya@example.com',
      name: 'Jiya',
      title: 'Ship the release',
      dueAt: dueDate,
    });
  });

  it('skips tasks that are completed or have a changed due date', async () => {
    const completedTask = {
      _id: taskId,
      owner: ownerId,
      title: 'Completed',
      status: TaskStatus.DONE,
      dueDate,
    };
    taskModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(completedTask),
    });

    await expect(
      processor.process({
        data: { taskId: taskId.toString(), dueAt: dueDate.toISOString() },
      } as never),
    ).resolves.toEqual({ skipped: true });
    expect(emailService.sendReminder).not.toHaveBeenCalled();

    completedTask.status = TaskStatus.TODO;
    await expect(
      processor.process({
        data: { taskId: taskId.toString(), dueAt: '2027-01-11T16:30:00.000Z' },
      } as never),
    ).resolves.toEqual({ skipped: true });
    expect(userModel.findById).not.toHaveBeenCalled();
  });

  it('lets SMTP errors reject so BullMQ can retry the job', async () => {
    emailService.sendReminder.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(
      processor.process({
        data: { taskId: taskId.toString(), dueAt: dueDate.toISOString() },
      } as never),
    ).rejects.toThrow('SMTP unavailable');
  });
});
