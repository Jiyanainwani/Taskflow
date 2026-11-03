import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class TaskReminderEmailService {
  private transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {}

  async sendReminder(input: {
    email: string;
    name: string;
    title: string;
    dueAt: Date;
  }) {
    const transporter = this.getTransporter();
    const dueAt = input.dueAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });

    await transporter.sendMail({
      from: this.configService.getOrThrow<string>('SMTP_FROM'),
      to: input.email,
      subject: `Task due: ${input.title}`,
      text: `Hi ${input.name},\n\nYour TaskFlow task "${input.title}" is due at ${dueAt} UTC.\n\nOpen TaskFlow to review it.`,
    });
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('SMTP_HOST');
    const from = this.configService.get<string>('SMTP_FROM');
    if (!host || !from) {
      throw new Error(
        'SMTP_HOST and SMTP_FROM must be configured to send reminders',
      );
    }

    const user = this.configService.get<string>('SMTP_USER');
    const password = this.configService.get<string>('SMTP_PASSWORD');
    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
    return this.transporter;
  }
}
