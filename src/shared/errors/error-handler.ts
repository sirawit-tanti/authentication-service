import type { FastifyError, FastifyPluginCallback } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { createErrorResponse, type ApiErrorDetail } from '../http/api-response.js';

const RATE_LIMIT_ERROR_CODE = 'RATE_LIMIT_EXCEEDED';

const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later';

interface FastifyValidationIssue {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  message?: string;
  params?: Record<string, unknown>;
}

interface ErrorWithStatusCode {
  statusCode?: number;
  code?: string;
  message?: string;
  validation?: FastifyValidationIssue[];

  error?: {
    code?: string;
    message?: string;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toApplicationError(error: unknown): ErrorWithStatusCode {
  if (!isObject(error)) {
    return {};
  }

  const applicationError: ErrorWithStatusCode = {};

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    applicationError.statusCode = error.statusCode;
  }

  if ('code' in error && typeof error.code === 'string') {
    applicationError.code = error.code;
  }

  if ('message' in error && typeof error.message === 'string') {
    applicationError.message = error.message;
  }

  if ('validation' in error && Array.isArray(error.validation)) {
    applicationError.validation = error.validation as FastifyValidationIssue[];
  }

  if ('error' in error && isObject(error.error)) {
    const nestedError: {
      code?: string;
      message?: string;
    } = {};

    if ('code' in error.error && typeof error.error.code === 'string') {
      nestedError.code = error.error.code;
    }

    if ('message' in error.error && typeof error.error.message === 'string') {
      nestedError.message = error.error.message;
    }

    applicationError.error = nestedError;
  }

  return applicationError;
}

function hasValidationIssues(error: ErrorWithStatusCode): error is ErrorWithStatusCode & {
  validation: FastifyValidationIssue[];
} {
  return Array.isArray(error.validation) && error.validation.length > 0;
}

function mapValidationDetails(validation: FastifyValidationIssue[]): ApiErrorDetail[] {
  return validation.map((issue): ApiErrorDetail => {
    const field = issue.instancePath?.replace(/^\//, '').replaceAll('/', '.');

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

function isRateLimitError(error: ErrorWithStatusCode): boolean {
  return (
    error.statusCode === 429 ||
    error.code === RATE_LIMIT_ERROR_CODE ||
    error.code === 'FST_ERR_RATE_LIMIT' ||
    error.error?.code === RATE_LIMIT_ERROR_CODE
  );
}

function getClientErrorCode(error: ErrorWithStatusCode): string {
  return error.code ?? error.error?.code ?? 'REQUEST_ERROR';
}

function getClientErrorMessage(error: ErrorWithStatusCode): string {
  return error.message ?? error.error?.message ?? 'The request could not be completed';
}

const errorHandlerImplementation: FastifyPluginCallback = (fastify, _options, done): void => {
  fastify.setNotFoundHandler(async (request, reply): Promise<void> => {
    const message = `Route ${request.method} ${request.url} was not found`;

    await reply.status(404).send(createErrorResponse('ROUTE_NOT_FOUND', message));
  });

  fastify.setErrorHandler(async (error: FastifyError, request, reply): Promise<void> => {
    const applicationError = toApplicationError(error);

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

    if (isRateLimitError(applicationError)) {
      await reply.status(429).send(createErrorResponse(RATE_LIMIT_ERROR_CODE, RATE_LIMIT_MESSAGE));

      return;
    }

    const statusCode = applicationError.statusCode;

    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      await reply
        .status(statusCode)
        .send(
          createErrorResponse(
            getClientErrorCode(applicationError),
            getClientErrorMessage(applicationError),
          ),
        );

      return;
    }

    request.log.error(
      {
        err: error,
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
