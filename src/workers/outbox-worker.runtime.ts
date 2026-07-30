import { hostname } from 'node:os';

import { SpanKind } from '@opentelemetry/api';
import pino from 'pino';

import { OutboxDispatcher } from '@/application/services/outbox-dispatcher.js';
import { createPrismaClient } from '@/infrastructure/database/prisma-client.js';
import { PrismaOutboxRepository } from '@/infrastructure/database/repositories/prisma-outbox.repository.js';
import { runTracedOperation } from '@/infrastructure/observability/trace-operation.js';
import { BullMqEmailQueue } from '@/infrastructure/queue/bullmq-email.queue.js';
import { SystemClock } from '@/infrastructure/system/system-clock.js';
import { env } from '@/shared/config/env.js';
import { createLoggerRedactionConfiguration } from '@/shared/logging/logger-redaction.js';
import { createTraceLogBindings } from '@/shared/logging/trace-log-correlation.js';

export interface StartOutboxWorkerRuntimeOptions {
  tracingEnabled: boolean;
}

export interface OutboxWorkerRuntime {
  close(): Promise<void>;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(
    typeof error === 'string' ? error : 'Unknown outbox worker resource shutdown error',
  );
}

export async function startOutboxWorkerRuntime(
  options: StartOutboxWorkerRuntimeOptions,
): Promise<OutboxWorkerRuntime> {
  const logger = pino({
    level: env.LOG_LEVEL,

    redact: createLoggerRedactionConfiguration(),

    mixin: createTraceLogBindings,
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

  function shutdownRequested(): boolean {
    return isShuttingDown;
  }

  async function dispatchOutboxMessages(): Promise<number> {
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
      let claimedMessages: number;

      do {
        claimedMessages = await dispatchOutboxMessages();
      } while (!shutdownRequested() && claimedMessages === env.OUTBOX_BATCH_SIZE);
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

  try {
    await prisma.$connect();

    logger.info(
      {
        workerId,

        tracingEnabled: options.tracingEnabled,
      },
      'Outbox worker started',
    );

    await runDispatchCycle();

    pollTimer = setInterval(() => {
      void runDispatchCycle();
    }, env.OUTBOX_POLL_INTERVAL_MS);
  } catch (error: unknown) {
    await Promise.allSettled([emailQueue.close(), prisma.$disconnect()]);

    throw error;
  }

  let closePromise: Promise<void> | undefined;

  return {
    close(): Promise<void> {
      closePromise ??= closeRuntime();

      return closePromise;
    },
  };

  async function closeRuntime(): Promise<void> {
    isShuttingDown = true;

    if (pollTimer !== null) {
      clearInterval(pollTimer);

      pollTimer = null;
    }

    while (isDispatching) {
      await new Promise<void>((resolve): void => {
        setTimeout(resolve, 50);
      });
    }

    const results = await Promise.allSettled([emailQueue.close(), prisma.$disconnect()]);

    let closeError: Error | undefined;

    for (const result of results) {
      if (result.status === 'rejected') {
        const error = normalizeError(result.reason);

        logger.error(
          {
            err: error,
          },
          'Outbox worker resource shutdown failed',
        );

        closeError ??= error;
      }
    }

    logger.info('Outbox worker stopped');

    if (closeError !== undefined) {
      throw closeError;
    }
  }
}
