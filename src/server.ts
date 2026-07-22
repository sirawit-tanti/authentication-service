import type { FastifyInstance } from 'fastify';

import { buildApplication } from './app.js';
import { env } from './shared/config/env.js';
import {
  createGracefulShutdownHandler,
  type GracefulShutdownHandler,
} from './shared/runtime/graceful-shutdown.js';

const SHUTDOWN_TIMEOUT_MILLISECONDS = 15_000;

let application: FastifyInstance | undefined;

let shutdown: GracefulShutdownHandler | undefined;

async function startServer(): Promise<void> {
  try {
    application = await buildApplication();

    shutdown = createGracefulShutdownHandler({
      application,

      timeoutMilliseconds: SHUTDOWN_TIMEOUT_MILLISECONDS,
    });

    await application.listen({
      host: env.APP_HOST,
      port: env.APP_PORT,
    });

    application.log.info(
      {
        environment: env.NODE_ENV,

        host: env.APP_HOST,

        port: env.APP_PORT,

        processId: process.pid,
      },
      'Authentication service started',
    );
  } catch (error: unknown) {
    const logger = application?.log ?? console;

    logger.error(
      {
        err: error,
      },
      'Failed to start authentication service',
    );

    process.exitCode = 1;

    if (application !== undefined) {
      try {
        await application.close();
      } catch (closeError: unknown) {
        application.log.error(
          {
            err: closeError,
          },
          'Failed to close application after startup failure',
        );
      }
    }
  }
}

async function handleSignal(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (shutdown === undefined) {
    process.exitCode = 0;

    return;
  }

  await shutdown(signal);
}

process.once('SIGINT', () => {
  void handleSignal('SIGINT');
});

process.once('SIGTERM', () => {
  void handleSignal('SIGTERM');
});

void startServer();
