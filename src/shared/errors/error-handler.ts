import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { AppError } from './app-error.js';
import { createErrorResponse } from '../http/api-response.js';

function handleAppError(error: AppError, reply: FastifyReply): void {
  void reply.status(error.statusCode).send(
    createErrorResponse(
      error.message,
      error.errors.length > 0
        ? error.errors
        : [
            {
              code: error.code,
              message: error.message,
            },
          ],
    ),
  );
}

function handleFastifyError(error: FastifyError, reply: FastifyReply): void {
  const statusCode = error.statusCode ?? 500;

  void reply.status(statusCode).send(
    createErrorResponse(error.message, [
      {
        code: error.code,
        message: error.message,
      },
    ]),
  );
}

function errorHandlerPlugin(fastify: FastifyInstance): void {
  fastify.setNotFoundHandler((request, reply) => {
    const message = `Route ${request.method} ${request.url} was not found`;

    void reply.status(404).send(
      createErrorResponse(message, [
        {
          code: 'ROUTE_NOT_FOUND',
          message,
        },
      ]),
    );
  });

  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      request.log.warn(
        {
          errorCode: error.code,
          statusCode: error.statusCode,
          error,
        },
        error.message,
      );

      handleAppError(error, reply);
      return;
    }

    if (error.statusCode !== undefined && error.statusCode < 500) {
      request.log.warn(
        {
          errorCode: error.code,
          statusCode: error.statusCode,
          error,
        },
        error.message,
      );

      handleFastifyError(error, reply);
      return;
    }

    request.log.error(
      {
        error,
        requestId: request.id,
      },
      'Unhandled application error',
    );

    void reply.status(500).send(
      createErrorResponse('An unexpected error occurred', [
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The server could not process the request',
        },
      ]),
    );
  });
}

export const errorHandler = fastifyPlugin(errorHandlerPlugin, {
  name: 'error-handler',
});
