export type TaskReminderJob = {
  taskId: string;
  dueAt: string;
};

export type DeadLetterJob = TaskReminderJob & {
  failedAt: string;
  attemptsMade: number;
  reason: string;
};

export const TASK_REMINDER_QUEUE = 'taskflow-task-reminders';
export const TASK_REMINDER_DEAD_LETTER_QUEUE =
  'taskflow-task-reminders-dead-letter';
export const TASK_REMINDER_ATTEMPTS = 3;
export const TASK_REMINDER_BACKOFF_MS = 1000;
