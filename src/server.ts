import type { FastifyInstance } from 'fastify';

import { startTracing } from './infrastructure/observability/tracing.js';
import { env } from './shared/config/env.js';
import {
  createGracefulShutdownHandler,
  type GracefulShutdownHandler,
} from './shared/runtime/graceful-shutdown.js';

const APPLICATION_VERSION = '1.0.0';

const SHUTDOWN_TIMEOUT_MILLISECONDS = 15_000;

const tracing = startTracing({
  enabled: env.OTEL_ENABLED,

  serviceName: env.OTEL_SERVICE_NAME,

  serviceVersion: APPLICATION_VERSION,

  environment: env.NODE_ENV,

  exporterEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,

  samplingRatio: env.OTEL_TRACES_SAMPLER_RATIO,
});

let application: FastifyInstance | undefined;

let shutdown: GracefulShutdownHandler | undefined;

async function startServer(): Promise<void> {
  try {
    const { buildApplication } = await import('./app.js');

    application = await buildApplication();

    application.addHook('onClose', async (): Promise<void> => {
      await tracing.shutdown();
    });

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

        tracingEnabled: tracing.enabled,
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

      return;
    }

    try {
      await tracing.shutdown();
    } catch (tracingError: unknown) {
      console.error('Failed to shutdown tracing after startup failure', tracingError);
    }
  }
}

async function handleSignal(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (shutdown === undefined) {
    try {
      await tracing.shutdown();
    } finally {
      process.exitCode = 0;
    }

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
