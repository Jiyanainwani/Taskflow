import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskCommentDocument = HydratedDocument<TaskComment>;

@Schema({ timestamps: true })
export class TaskComment {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  body: string;

  createdAt: Date;
  updatedAt: Date;
}

export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);

TaskCommentSchema.index({ taskId: 1, createdAt: 1, _id: 1 });
