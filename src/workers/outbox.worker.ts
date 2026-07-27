import { hostname } from 'node:os';

import { SpanKind } from '@opentelemetry/api';
import pino from 'pino';

import { OutboxDispatcher } from '@/application/services/outbox-dispatcher.js';
import { createPrismaClient } from '@/infrastructure/database/prisma-client.js';
import { PrismaOutboxRepository } from '@/infrastructure/database/repositories/prisma-outbox.repository.js';
import { runTracedOperation } from '@/infrastructure/observability/trace-operation.js';
import { startTracing } from '@/infrastructure/observability/tracing.js';
import { BullMqEmailQueue } from '@/infrastructure/queue/bullmq-email.queue.js';
import { SystemClock } from '@/infrastructure/system/system-clock.js';
import { env } from '@/shared/config/env.js';
import { createLoggerRedactionConfiguration } from '@/shared/logging/logger-redaction.js';

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

const prisma = createPrismaClient();

const emailQueue = new BullMqEmailQueue();

const clock = new SystemClock();

const workerId = [hostname(), process.pid].join('-');

const dispatcher = new OutboxDispatcher({
  outboxRepository: new PrismaOutboxRepository(prisma),

  emailQueue,

  clock,

  logger,

  workerId,

  batchSize: env.OUTBOX_BATCH_SIZE,

  lockTimeoutMilliseconds: env.OUTBOX_LOCK_TIMEOUT_MS,

  maximumAttempts: env.OUTBOX_MAX_ATTEMPTS,
});

let isShuttingDown = false;

let isDispatching = false;

let pollTimer: NodeJS.Timeout | null = null;

let shutdownPromise: Promise<void> | undefined;

function shutdownRequested(): boolean {
  return isShuttingDown;
}

function dispatchOutboxMessages(): Promise<number> {
  return runTracedOperation(
    {
      name: 'outbox.dispatch',

      kind: SpanKind.INTERNAL,

      attributes: {
        'messaging.system': 'postgresql-outbox',

        'messaging.destination.name': env.EMAIL_QUEUE_NAME,

        'outbox.worker.id': workerId,

        'outbox.batch.size': env.OUTBOX_BATCH_SIZE,
      },
    },
    async (): Promise<number> => dispatcher.dispatchOnce(),
  );
}

async function runDispatchCycle(): Promise<void> {
  if (isDispatching || shutdownRequested()) {
    return;
  }

  isDispatching = true;

  try {
    let claimedMessages = 0;

    do {
      if (shutdownRequested()) {
        break;
      }

      claimedMessages = await dispatchOutboxMessages();
    } while (claimedMessages === env.OUTBOX_BATCH_SIZE);
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
      },
      'Outbox dispatch cycle failed',
    );
  } finally {
    isDispatching = false;
  }
}

async function start(): Promise<void> {
  await prisma.$connect();

  logger.info(
    {
      workerId,

      tracingEnabled: tracing.enabled,
    },
    'Outbox worker started',
  );

  await runDispatchCycle();

  pollTimer = setInterval(() => {
    void runDispatchCycle();
  }, env.OUTBOX_POLL_INTERVAL_MS);
}

function shutdown(signal: NodeJS.Signals): Promise<void> {
  shutdownPromise ??= performShutdown(signal);

  return shutdownPromise;
}

async function performShutdown(signal: NodeJS.Signals): Promise<void> {
  isShuttingDown = true;

  if (pollTimer !== null) {
    clearInterval(pollTimer);

    pollTimer = null;
  }

  logger.info(
    {
      signal,
    },
    'Outbox worker shutdown started',
  );

  while (isDispatching) {
    await new Promise<void>((resolve): void => {
      setTimeout(resolve, 50);
    });
  }

  const results = await Promise.allSettled([
    emailQueue.close(),

    prisma.$disconnect(),

    tracing.shutdown(),
  ]);

  const shutdownFailed = results.some((result): boolean => result.status === 'rejected');

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error(
        {
          err: result.reason,
        },
        'Outbox worker resource shutdown failed',
      );
    }
  }

  logger.info('Outbox worker stopped');

  process.exitCode = shutdownFailed ? 1 : 0;
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void start().catch(async (error: unknown): Promise<void> => {
  logger.fatal(
    {
      err: error,
    },
    'Outbox worker failed to start',
  );

  process.exitCode = 1;

  await Promise.allSettled([emailQueue.close(), prisma.$disconnect(), tracing.shutdown()]);
});
