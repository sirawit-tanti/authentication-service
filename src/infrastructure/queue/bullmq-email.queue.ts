import { SpanKind } from '@opentelemetry/api';
import { Queue, type JobsOptions } from 'bullmq';

import {
  EMAIL_JOB_NAMES,
  type EmailJobDataMap,
  type EmailJobName,
} from '@/application/jobs/email-job.js';
import type {
  EmailQueue,
  EnqueueEmailVerificationInput,
  EnqueuePasswordResetInput,
} from '@/application/ports/queues/email-queue.js';
import {
  captureTraceContext,
  runTracedOperation,
} from '@/infrastructure/observability/trace-operation.js';
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

  public enqueueEmailVerification(input: EnqueueEmailVerificationInput): Promise<void> {
    const { jobId, ...jobData } = input;

    return this.enqueue(EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION, jobId, jobData);
  }

  public enqueuePasswordReset(input: EnqueuePasswordResetInput): Promise<void> {
    const { jobId, ...jobData } = input;

    return this.enqueue(EMAIL_JOB_NAMES.SEND_PASSWORD_RESET, jobId, jobData);
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }

  private runPublishOperation<T>(jobName: EmailJobName, operation: () => Promise<T>): Promise<T> {
    return runTracedOperation(
      {
        name: `messaging.publish ${jobName}`,

        kind: SpanKind.PRODUCER,

        attributes: {
          'messaging.system': 'bullmq',

          'messaging.destination.name': env.EMAIL_QUEUE_NAME,

          'messaging.operation.name': 'publish',

          'messaging.operation.type': 'send',

          'messaging.message.type': jobName,
        },
      },
      operation,
    );
  }

  private enqueue<TJobName extends EmailJobName>(
    jobName: TJobName,
    jobId: string,
    jobData: Omit<EmailJobDataMap[TJobName], 'traceContext'>,
  ): Promise<void> {
    return this.runPublishOperation(jobName, async (): Promise<void> => {
      const traceContext = captureTraceContext();

      const data = {
        ...jobData,

        ...(traceContext === undefined
          ? {}
          : {
              traceContext,
            }),
      } as EmailJobDataMap[TJobName];

      await this.queue.add(jobName, data, this.createJobOptions(jobId));
    });
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
