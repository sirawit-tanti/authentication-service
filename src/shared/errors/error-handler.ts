import type { FastifyError, FastifyPluginCallback } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { createErrorResponse, type ApiErrorDetail } from '../http/api-response.js';

interface FastifyValidationIssue {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  message?: string;
  params?: Record<string, unknown>;
}

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
  code?: string;
  validation?: FastifyValidationIssue[];
}

function hasValidationIssues(error: ErrorWithStatusCode): error is ErrorWithStatusCode & {
  validation: FastifyValidationIssue[];
} {
  return Array.isArray(error.validation) && error.validation.length > 0;
}

function mapValidationDetails(validation: FastifyValidationIssue[]): ApiErrorDetail[] {
  return validation.map((issue) => {
    const field = issue.instancePath?.replace(/^/, '').replaceAll('/', '.');

    const code = (issue.keyword ?? 'INVALID_VALUE').toUpperCase();

    const message = issue.message ?? 'Request value is invalid';

    if (field === undefined || field.length === 0) {
      return {
        code,
        message,
      };
    }

    return {
      code,
      field,
      message,
    };
  });
}

const errorHandlerImplementation: FastifyPluginCallback = (fastify, _options, done): void => {
  fastify.setNotFoundHandler(async (request, reply): Promise<void> => {
    const message = `Route ${request.method} ${request.url} was not found`;

    await reply.status(404).send(createErrorResponse('ROUTE_NOT_FOUND', message));
  });

  fastify.setErrorHandler(async (error: FastifyError, request, reply): Promise<void> => {
    const applicationError = error as ErrorWithStatusCode;

    if (hasValidationIssues(applicationError)) {
      await reply
        .status(400)
        .send(
          createErrorResponse(
            'INVALID_REQUEST',
            'Request validation failed',
            mapValidationDetails(applicationError.validation),
          ),
        );

      return;
    }

    const statusCode = applicationError.statusCode;

    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      await reply
        .status(statusCode)
        .send(
          createErrorResponse(applicationError.code ?? 'REQUEST_ERROR', applicationError.message),
        );

      return;
    }

    request.log.error(
      {
        error,
      },
      'Unhandled application error',
    );

    await reply
      .status(500)
      .send(createErrorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred'));
  });

  done();
};

export const errorHandler = fastifyPlugin(errorHandlerImplementation, {
  name: 'error-handler',
});
