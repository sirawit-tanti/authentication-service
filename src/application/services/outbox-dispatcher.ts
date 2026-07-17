import {
  EMAIL_JOB_NAMES,
  type SendEmailVerificationJobData,
  type SendPasswordResetJobData,
} from '../jobs/email-job.js';
import { OUTBOX_TOPICS } from '../outbox/outbox-message.js';
import type { EmailQueue } from '../ports/queues/email-queue.js';
import type { OutboxRepository } from '../ports/repositories/outbox.repository.js';
import type { Clock } from '../ports/system/clock.js';

export interface OutboxDispatcherLogger {
  info(metadata: Record<string, unknown>, message: string): void;

  error(metadata: Record<string, unknown>, message: string): void;
}

export interface OutboxDispatcherOptions {
  outboxRepository: OutboxRepository;
  emailQueue: EmailQueue;
  clock: Clock;
  logger: OutboxDispatcherLogger;
  workerId: string;
  batchSize: number;
  lockTimeoutMilliseconds: number;
  maximumAttempts: number;
}

interface PublishableOutboxMessage {
  id: string;
  topic: string;
  eventType: string;
  payload: unknown;
}

export class OutboxDispatcher {
  private readonly options: OutboxDispatcherOptions;

  public constructor(options: OutboxDispatcherOptions) {
    this.options = options;
  }

  public async dispatchOnce(): Promise<number> {
    const messages = await this.options.outboxRepository.claimPendingMessages({
      workerId: this.options.workerId,
      batchSize: this.options.batchSize,
      lockTimeoutMilliseconds: this.options.lockTimeoutMilliseconds,
    });

    for (const message of messages) {
      try {
        await this.publishMessage(message);

        await this.options.outboxRepository.markPublished(message.id, this.options.clock.now());

        this.options.logger.info(
          {
            outboxMessageId: message.id,
            eventType: message.eventType,
          },
          'Outbox message published',
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown outbox publishing error';

        const retryDelayMilliseconds = this.calculateRetryDelay(message.attempts + 1);

        await this.options.outboxRepository.markFailed({
          messageId: message.id,
          errorMessage,
          maximumAttempts: this.options.maximumAttempts,
          retryDelayMilliseconds,
        });

        this.options.logger.error(
          {
            outboxMessageId: message.id,
            eventType: message.eventType,
            err: error,
          },
          'Outbox message publishing failed',
        );
      }
    }

    return messages.length;
  }

  private async publishMessage(message: PublishableOutboxMessage): Promise<void> {
    if (message.topic !== OUTBOX_TOPICS.EMAIL) {
      throw new Error(`Unsupported outbox topic: ${message.topic}`);
    }

    switch (message.eventType) {
      case EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION: {
        const payload = this.parseEmailVerificationPayload(message.payload);

        await this.options.emailQueue.enqueueEmailVerification({
          ...payload,
          jobId: message.id,
        });

        return;
      }

      case EMAIL_JOB_NAMES.SEND_PASSWORD_RESET: {
        const payload = this.parsePasswordResetPayload(message.payload);

        await this.options.emailQueue.enqueuePasswordReset({
          ...payload,
          jobId: message.id,
        });

        return;
      }

      default:
        throw new Error(`Unsupported email event type: ${message.eventType}`);
    }
  }

  private parseEmailVerificationPayload(payload: unknown): SendEmailVerificationJobData {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Email verification payload must be an object');
    }

    const record = payload as Record<string, unknown>;

    if (
      record.version !== 1 ||
      typeof record.userId !== 'string' ||
      typeof record.email !== 'string' ||
      typeof record.verificationToken !== 'string' ||
      typeof record.expiresAt !== 'string'
    ) {
      throw new Error('Email verification payload is invalid');
    }

    return {
      version: 1,
      userId: record.userId,
      email: record.email,
      verificationToken: record.verificationToken,
      expiresAt: record.expiresAt,
    };
  }

  private parsePasswordResetPayload(payload: unknown): SendPasswordResetJobData {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Password reset payload must be an object');
    }

    const record = payload as Record<string, unknown>;

    if (
      record.version !== 1 ||
      typeof record.userId !== 'string' ||
      typeof record.email !== 'string' ||
      typeof record.resetToken !== 'string' ||
      typeof record.expiresAt !== 'string'
    ) {
      throw new Error('Password reset payload is invalid');
    }

    return {
      version: 1,
      userId: record.userId,
      email: record.email,
      resetToken: record.resetToken,
      expiresAt: record.expiresAt,
    };
  }

  private calculateRetryDelay(attempts: number): number {
    const baseDelayMilliseconds = 1_000;

    const maximumDelayMilliseconds = 5 * 60 * 1_000;

    return Math.min(
      baseDelayMilliseconds * 2 ** Math.max(0, attempts - 1),

      maximumDelayMilliseconds,
    );
  }
}
