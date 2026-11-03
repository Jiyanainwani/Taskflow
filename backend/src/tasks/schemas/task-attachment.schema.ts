import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskAttachmentDocument = HydratedDocument<TaskAttachment>;

@Schema({ timestamps: true })
export class TaskAttachment {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 180 })
  filename: string;

  @Prop({ type: String, required: true })
  contentType: string;

  @Prop({ type: Number, required: true, min: 1 })
  size: number;

  @Prop({ type: String, required: true, unique: true })
  objectKey: string;

  @Prop({ type: String, enum: ['pending', 'ready'], default: 'pending' })
  status: 'pending' | 'ready';

  createdAt: Date;
  updatedAt: Date;
}

export const TaskAttachmentSchema =
  SchemaFactory.createForClass(TaskAttachment);

TaskAttachmentSchema.index({ taskId: 1, status: 1, createdAt: 1, _id: 1 });
