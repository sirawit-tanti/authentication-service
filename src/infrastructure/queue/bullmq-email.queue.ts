import {
  EMAIL_JOB_NAMES,
  type EmailJobDataMap,
  type EmailJobName,
} from '@/application/jobs/email-job.js';
import { Queue, type JobsOptions } from 'bullmq';
import type {
  EmailQueue,
  EnqueueEmailVerificationInput,
  EnqueuePasswordResetInput,
} from '@/application/ports/queues/email-queue.js';
import { env } from '@/shared/config/env.js';
import { createBullMqProducerConnectionOptions } from './bullmq-connection.js';

export class BullMqEmailQueue implements EmailQueue {
  private readonly queue: Queue<EmailJobDataMap[EmailJobName], void, EmailJobName>;

  public constructor() {
    this.queue = new Queue<EmailJobDataMap[EmailJobName], void, EmailJobName>(
      env.EMAIL_QUEUE_NAME,
      {
        connection: createBullMqProducerConnectionOptions(),
        prefix: env.BULLMQ_PREFIX,

        defaultJobOptions: {
          attempts: env.EMAIL_JOB_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: env.EMAIL_JOB_BACKOFF_MS,
          },
          removeOnComplete: {
            age: 24 * 60 * 60,
            count: 1_000,
          },
          removeOnFail: {
            age: 7 * 24 * 60 * 60,
            count: 5_000,
          },
        },
      },
    );
  }

  public async enqueeuEmailVerification(input: EnqueueEmailVerificationInput): Promise<void> {
    const { jobId, ...jobData } = input;

    await this.queue.add(
      EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION,
      jobData,
      this.createJobOptions(jobId),
    );
  }

  public async enqueuePasswordReset(input: EnqueuePasswordResetInput): Promise<void> {
    const { jobId, ...jobData } = input;

    await this.queue.add(
      EMAIL_JOB_NAMES.SEND_PASSWORD_RESET,
      jobData,
      this.createJobOptions(jobId),
    );
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }

  private createJobOptions(jobId: string): JobsOptions {
    if (jobId.includes(':')) {
      throw new Error('BullMQ custom job ID must not contain a colon');
    }

    return {
      jobId,
    };
  }
}
