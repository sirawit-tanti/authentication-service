import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { databasePlugin } from './infrastructure/database/database.plugin.js';
import { apiV1Routes } from './interfaces/http/routes/index.js';
import { env } from './shared/config/env.js';
import { errorHandler } from './shared/errors/error-handler.js';

export interface BuildApplicationOptions {
  logger?: FastifyServerOptions['logger'];
  registerDatabase?: boolean;
}

export async function buildApplication(
  options: BuildApplicationOptions = {},
): Promise<FastifyInstance> {
  const application = Fastify({
    logger: options.logger ?? {
      level: env.LOG_LEVEL,

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'request.headers.authorization',
          'request.headers.cookie',
          'password',
          'passwordHash',
          'token',
          'tokenHash',
          'accessToken',
          'refreshToken',
          'clientSecret',
          'clientSecretHash',
          'apiKey',
          'keyHash',
        ],
        censor: '[REDACTED]',
      },
    },

    requestIdHeader: 'x-request-id',

    logController: new LogController({
      requestIdLogLabel: 'requestId',
      disableRequestLogging: false,
    }),
  });

  await application.register(errorHandler);

  if (options.registerDatabase !== false) {
    await application.register(databasePlugin);
  }

  await application.register(apiV1Routes, {
    prefix: '/api/v1',
  });

  return application;
}
