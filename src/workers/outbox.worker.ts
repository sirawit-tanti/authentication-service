import { hostname } from 'node:os';

import pino from 'pino';

import { OutboxDispatcher } from '@/application/services/outbox-dispatcher.js';
import { createPrismaClient } from '@/infrastructure/database/prisma-client.js';
import { PrismaOutboxRepository } from '@/infrastructure/database/repositories/prisma-outbox.repository.js';
import { BullMqEmailQueue } from '@/infrastructure/queue/bullmq-email.queue.js';
import { SystemClock } from '@/infrastructure/system/system-clock.js';
import { env } from '@/shared/config/env.js';

const logger = pino({
  level: env.LOG_LEVEL,
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

      claimedMessages = await dispatcher.dispatchOnce();
    } while (claimedMessages === env.OUTBOX_BATCH_SIZE);
  } catch (error: unknown) {
    logger.error(
      {
        error,
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
    },
    'Outbox worker started',
  );

  await runDispatchCycle();

  pollTimer = setInterval(() => {
    void runDispatchCycle();
  }, env.OUTBOX_POLL_INTERVAL_MS);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (pollTimer !== null) {
    clearInterval(pollTimer);
  }

  logger.info(
    {
      signal,
    },
    'Outbox worker shutdown started',
  );

  while (isDispatching) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  const results = await Promise.allSettled([emailQueue.close(), prisma.$disconnect()]);

  const shutdownFailed = results.some((result) => result.status === 'rejected');

  process.exitCode = shutdownFailed ? 1 : 0;
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void start().catch((error: unknown) => {
  logger.fatal(
    {
      error,
    },
    'Outbox worker failed to start',
  );

  process.exitCode = 1;
});
