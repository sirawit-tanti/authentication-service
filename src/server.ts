import type { FastifyInstance } from 'fastify';

import { buildApplication } from './app.js';
import { env } from './shared/config/env.js';

let application: FastifyInstance | undefined;
let isShuttingDown = false;

async function startServer(): Promise<void> {
  application = await buildApplication();

  try {
    await application.listen({
      host: env.APP_HOST,
      port: env.APP_PORT,
    });

    application.log.info(
      {
        environment: env.NODE_ENV,
        host: env.APP_HOST,
        port: env.APP_PORT,
      },
      'Authentication service started',
    );
  } catch (error: unknown) {
    application.log.fatal({ error }, 'Failed to start authentication service');
    process.exitCode = 1;
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (application === undefined) {
    process.exitCode = 0;
    return;
  }

  application.log.info({ signal }, 'Shutdown signal received');

  try {
    await application.close();

    application.log.info('Authentication service stopped gracefully');
    process.exitCode = 0;
  } catch (error: unknown) {
    application.log.error({ error }, 'Failed to stop authentication service gracefully');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void startServer();
