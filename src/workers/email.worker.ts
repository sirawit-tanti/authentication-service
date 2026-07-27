import { SpanKind, trace } from '@opentelemetry/api';
import { Worker, type Job } from 'bullmq';
import pino from 'pino';

import { type EmailJobDataMap, type EmailJobName } from '@/application/jobs/email-job.js';
import { EmailJobProcessor } from '@/application/jobs/processors/email-job.processor.js';
import { DevelopmentEmailProvider } from '@/infrastructure/email/development-email.provider.js';
import {
  extractTraceContext,
  runTracedOperation,
} from '@/infrastructure/observability/trace-operation.js';
import { startTracing } from '@/infrastructure/observability/tracing.js';
import { createBullMqWorkerConnectionOptions } from '@/infrastructure/queue/bullmq-connection.js';
import { createLoggerRedactionConfiguration } from '@/shared/logging/logger-redaction.js';
import { env } from '@/shared/config/env.js';
import { TracingEmailProvider } from '@/infrastructure/email/tracing-email.provider.js';

const APPLICATION_VERSION = '1.0.0';

const tracing = startTracing({
  enabled: env.OTEL_ENABLED,

  serviceName: env.OTEL_SERVICE_NAME,

  serviceVersion: APPLICATION_VERSION,

  environment: env.NODE_ENV,

  exporterEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,

  samplingRatio: env.OTEL_TRACES_SAMPLER_RATIO,
});

const logger = pino({
  level: env.LOG_LEVEL,

  redact: createLoggerRedactionConfiguration(),
});

const developmentEmailProvider = new DevelopmentEmailProvider(logger);

const emailProvider = new TracingEmailProvider({
  provider: developmentEmailProvider,

  providerName: env.EMAIL_PROVIDER,
});

const processor = new EmailJobProcessor({
  emailProvider,

  fromAddress: env.EMAIL_FROM_ADDRESS,

  fromName: env.EMAIL_FROM_NAME,

  emailVerificationBaseUrl: env.EMAIL_VERIFICATION_BASE_URL,
});

function processJob(job: Job<EmailJobDataMap[EmailJobName], void, EmailJobName>): Promise<void> {
  const parentContext = extractTraceContext(job.data.traceContext);

  return runTracedOperation(
    {
      name: `messaging.process ${job.name}`,

      kind: SpanKind.CONSUMER,

      parentContext,

      attributes: {
        'messaging.system': 'bullmq',

        'messaging.destination.name': env.EMAIL_QUEUE_NAME,

        'messaging.operation.name': 'process',

        'messaging.operation.type': 'process',

        'messaging.message.type': job.name,

        ...(job.id === undefined
          ? {}
          : {
              'messaging.message.id': job.id,
            }),

        'messaging.batch.message_count': 1,

        'messaging.consumer.id': `${env.EMAIL_QUEUE_NAME}-worker`,

        'messaging.message.receive_count': job.attemptsMade + 1,
      },
    },
    async (): Promise<void> => {
      const spanContext = trace.getActiveSpan()?.spanContext();

      logger.debug(
        {
          jobId: job.id,
          jobName: job.name,

          traceId: spanContext?.traceId,

          spanId: spanContext?.spanId,
        },
        'Email job trace started',
      );

      await processor.process(job);
    },
  );
}

const worker = new Worker<EmailJobDataMap[EmailJobName], void, EmailJobName>(
  env.EMAIL_QUEUE_NAME,
  processJob,
  {
    connection: createBullMqWorkerConnectionOptions(),

    prefix: env.BULLMQ_PREFIX,

    concurrency: env.EMAIL_WORKER_CONCURRENCY,
  },
);

worker.on('ready', () => {
  logger.info(
    {
      tracingEnabled: tracing.enabled,
    },
    'Email worker is ready',
  );
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
      err: error,
    },
    'Email job failed',
  );
});

worker.on('error', (error) => {
  logger.error(
    {
      err: error,
    },
    'Email worker error',
  );
});

let shutdownPromise: Promise<void> | undefined;

function shutdown(signal: NodeJS.Signals): Promise<void> {
  shutdownPromise ??= performShutdown(signal);

  return shutdownPromise;
}

async function performShutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info(
    {
      signal,
    },
    'Email worker shutdown started',
  );

  const results = await Promise.allSettled([worker.close(), tracing.shutdown()]);

  const shutdownFailed = results.some((result): boolean => result.status === 'rejected');

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error(
        {
          err: result.reason,
        },
        'Email worker resource shutdown failed',
      );
    }
  }

  logger.info('Email worker stopped');

  process.exitCode = shutdownFailed ? 1 : 0;
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
