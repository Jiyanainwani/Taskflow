import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskActivityDocument = HydratedDocument<TaskActivity>;

export enum TaskActivityAction {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  COMMENT_ADDED = 'comment_added',
}

@Schema({ timestamps: true })
export class TaskActivity {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actor: Types.ObjectId;

  @Prop({
    type: String,
    enum: TaskActivityAction,
    required: true,
  })
  action: TaskActivityAction;

  @Prop({ type: String, required: true, trim: true, maxlength: 300 })
  summary: string;

  createdAt: Date;
  updatedAt: Date;
}

export const TaskActivitySchema = SchemaFactory.createForClass(TaskActivity);

TaskActivitySchema.index({ taskId: 1, createdAt: -1, _id: -1 });
