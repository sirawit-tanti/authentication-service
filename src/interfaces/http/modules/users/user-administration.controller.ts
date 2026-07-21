import type { FastifyReply, FastifyRequest } from 'fastify';

import { AdministrativeUserNotFoundError } from '@/application/errors/administrative-user-not-found.error.js';
import type {
  GetAdministrativeUserCommand,
  GetAdministrativeUserResult,
} from '@/application/use-cases/users/get-administrative-user.use-case.js';
import type {
  ListAdministrativeUsersCommand,
  ListAdministrativeUsersResult,
} from '@/application/use-cases/users/list-administrative-users.use-case.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';
import {
  listUsersQuerySchema,
  userParamsSchema,
  type ListUsersQuery,
  type UserParams,
} from './user-administration.schema.js';

export interface ListAdministrativeUsersExecutor {
  execute(command: ListAdministrativeUsersCommand): Promise<ListAdministrativeUsersResult>;
}

export interface GetAdministrativeUserExecutor {
  execute(command: GetAdministrativeUserCommand): Promise<GetAdministrativeUserResult>;
}

export interface UserAdministrationControllerDependencies {
  listUsersUseCase: ListAdministrativeUsersExecutor;
  getUserUseCase: GetAdministrativeUserExecutor;
}

interface ListUsersRequest {
  Querystring: ListUsersQuery;
}

interface GetUserRequest {
  Params: UserParams;
}

export function createListUsersController(
  dependencies: UserAdministrationControllerDependencies,
): (request: FastifyRequest<ListUsersRequest>, reply: FastifyReply) => Promise<void> {
  return async function listUsersController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const validationResult = listUsersQuerySchema.safeParse(request.query);

    if (!validationResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    const query = validationResult.data;

    const result = await dependencies.listUsersUseCase.execute({
      applicationId: principal.applicationId,

      page: query.page,

      limit: query.limit,

      ...(query.search === undefined
        ? {}
        : {
            search: query.search,
          }),

      ...(query.status === undefined
        ? {}
        : {
            status: query.status,
          }),
    });

    await reply.status(200).send(
      createSuccessResponse({
        users: result.users,

        pagination: result.pagination,
      }),
    );
  };
}

export function createGetUserController(
  dependencies: UserAdministrationControllerDependencies,
): (request: FastifyRequest<GetUserRequest>, reply: FastifyReply) => Promise<void> {
  return async function getUserController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const validationResult = userParamsSchema.safeParse(request.params);

    if (!validationResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    try {
      const result = await dependencies.getUserUseCase.execute({
        applicationId: principal.applicationId,

        userId: validationResult.data.userId,
      });

      await reply.status(200).send(
        createSuccessResponse({
          user: result.user,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof AdministrativeUserNotFoundError) {
        await reply.status(404).send(createErrorResponse('USER_NOT_FOUND', error.message));

        return;
      }

      throw error;
    }
  };
}
