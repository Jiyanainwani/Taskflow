export type RealtimeEventType =
  'task.created' | 'task.updated' | 'task.deleted' | 'task.comment.added';

export type RealtimeEvent = {
  type: RealtimeEventType;
  taskId: string;
  occurredAt: string;
};

export type RealtimeEnvelope = {
  origin: string;
  recipientIds: string[];
  event: RealtimeEvent;
};
