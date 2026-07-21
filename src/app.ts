import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from 'fastify';

import {
  createInfrastructureContainer,
  type InfrastructureContainer,
} from './infrastructure/container/infrastructure-container.js';
import { infrastructurePlugin } from './infrastructure/container/infrastructure.plugin.js';
import { authenticationPlugin } from './interfaces/http/modules/authentication/authentication.plugin.js';
import { httpSecurityPlugin } from './interfaces/http/security/http-security.plugin.js';
import { auditingPlugin } from './interfaces/http/modules/auditing/auditing.plugin.js';
import { authorizationPlugin } from './interfaces/http/modules/authorization/authorization.plugin.js';
import { apiV1Routes } from './interfaces/http/routes/index.js';
import { env } from './shared/config/env.js';
import { errorHandler } from './shared/errors/error-handler.js';

export interface BuildApplicationOptions {
  logger?: FastifyServerOptions['logger'];
  registerInfrastructure?: boolean;
  infrastructure?: InfrastructureContainer;
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
          'req.body.password',
          'req.body.refreshToken',
          'request.body.password',
          'request.body.refreshToken',
          'req.body.currentPassword',
          'request.body.currentPassword',
          'req.body.newPassword',
          'request.body.newPassword',
          'req.body.token',
          'request.body.token',
          'password',
          'currentPassword',
          'newPassword',
          'passwordHash',
          'token',
          'tokenHash',
          'verificationToken',
          'resetToken',
          'accessToken',
          'refreshToken',
          'clientSecret',
          'clientSecretHash',
          'apiKey',
          'keyHash',
          'refreshToken',
        ],
        censor: '[REDACTED]',
      },
    },

    bodyLimit: env.HTTP_BODY_LIMIT_BYTES,

    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },

    requestIdHeader: 'x-request-id',

    logController: new LogController({
      requestIdLogLabel: 'requestId',
      disableRequestLogging: false,
    }),
  });

  await application.register(errorHandler);

  await application.register(httpSecurityPlugin);

  if (options.registerInfrastructure !== false) {
    const infrastructure = options.infrastructure ?? createInfrastructureContainer();

    await application.register(infrastructurePlugin, {
      container: infrastructure,
    });

    await application.register(authenticationPlugin);

    await application.register(auditingPlugin);

    await application.register(authorizationPlugin);
  }

  await application.register(apiV1Routes, {
    prefix: '/api/v1',
  });

  return application;
}
