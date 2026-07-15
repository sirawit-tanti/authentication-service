import { EmailJobProcessor } from '@/application/jobs/processors/email-job.processor.js';
import { DevelopmentEmailProvider } from '@/infrastructure/email/development-email.provider.js';
import { createBullMqWorkerConnectionOptions } from '@/infrastructure/queue/bullmq-connection.js';
import { env } from '@/shared/config/env.js';
import { Worker } from 'bullmq';
import pino from 'pino';

import { type EmailJobDataMap, type EmailJobName } from '@/application/jobs/email-job.js';

const logger = pino({
  level: env.LOG_LEVEL,

  redact: {
    paths: ['verificationToken', 'resetToken', 'job.data.verificationToken', 'job.data.resetToken'],
    censor: '[REDACTED]',
  },
});

const emailProvider = new DevelopmentEmailProvider(logger);

const processor = new EmailJobProcessor({
  emailProvider,
  fromAddress: env.EMAIL_FROM_ADDRESS,
  fromName: env.EMAIL_FROM_NAME,
  emailVerificationBaseUrl: env.EMAIL_VERIFICATION_BASE_URL,
});

const worker = new Worker<EmailJobDataMap[EmailJobName], void, EmailJobName>(
  env.EMAIL_QUEUE_NAME,

  async (job): Promise<void> => {
    await processor.process(job);
  },

  {
    connection: createBullMqWorkerConnectionOptions(),
    prefix: env.BULLMQ_PREFIX,
    concurrency: env.EMAIL_WORKER_CONCURRENCY,
  },
);

worker.on('ready', () => {
  logger.info('Email worker is ready');
});

worker.on('active', (job) => {
  logger.debug(
    {
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade + 1,
    },
    'Email job started',
  );
});

worker.on('completed', (job) => {
  logger.info(
    {
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
    },
    'Email job completed',
  );
});

worker.on('failed', (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      error,
    },
    'Email job failed',
  );
});

worker.on('error', (error) => {
  logger.error(
    {
      error,
    },
    'Email worker error',
  );
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info(
    {
      signal,
    },
    'Email worker shutdown started',
  );

  try {
    await worker.close();

    logger.info('Email worker stopped gracefully');
    process.exitCode = 0;
  } catch (error: unknown) {
    logger.error(
      {
        error,
      },
      'Email worker shutdown failed',
    );

    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
