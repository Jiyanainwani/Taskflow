import { ConfigService } from '@nestjs/config';

import { TaskReminderEmailService } from './task-reminder-email.service.js';

describe('TaskReminderEmailService', () => {
  it('rejects sending when SMTP settings are missing so the queue can retry', async () => {
    const config = {
      get: vi.fn((key: string) => (key === 'SMTP_HOST' ? '' : '')),
    } as unknown as ConfigService;
    const service = new TaskReminderEmailService(config);

    await expect(
      service.sendReminder({
        email: 'owner@example.com',
        name: 'Task owner',
        title: 'Review release',
        dueAt: new Date('2027-01-10T16:30:00.000Z'),
      }),
    ).rejects.toThrow('SMTP_HOST and SMTP_FROM must be configured');
  });
});
