import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  AdministrativeUserNotFoundError,
  CannotChangeOwnStatusError,
  DisabledUserStatusError,
  UnverifiedUserActivationError,
  UserStatusConflictError,
} from '@/application/errors/user-status-management.error.js';
import type {
  ChangeUserStatusCommand,
  ChangeUserStatusResult,
} from '@/application/use-cases/users/change-user-status.use-case.js';
import type {
  GetAdministrativeUserCommand,
  GetAdministrativeUserResult,
} from '@/application/use-cases/users/get-administrative-user.use-case.js';
import type {
  ListAdministrativeUsersCommand,
  ListAdministrativeUsersResult,
} from '@/application/use-cases/users/list-administrative-users.use-case.js';
import { createErrorResponse, createSuccessResponse } from '@/shared/http/api-response.js';
import { getAuditRequestContext } from '../../auditing/get-audit-request-context.js';
import {
  changeUserStatusBodySchema,
  listUsersQuerySchema,
  userParamsSchema,
  type ChangeUserStatusBody,
  type ListUsersQuery,
  type UserParams,
} from './user-administration.schema.js';

export interface ListAdministrativeUsersExecutor {
  execute(command: ListAdministrativeUsersCommand): Promise<ListAdministrativeUsersResult>;
}

export interface GetAdministrativeUserExecutor {
  execute(command: GetAdministrativeUserCommand): Promise<GetAdministrativeUserResult>;
}

export interface ChangeUserStatusExecutor {
  execute(command: ChangeUserStatusCommand): Promise<ChangeUserStatusResult>;
}

export interface UserAdministrationControllerDependencies {
  listUsersUseCase: ListAdministrativeUsersExecutor;

  getUserUseCase: GetAdministrativeUserExecutor;

  changeUserStatusUseCase: ChangeUserStatusExecutor;
}

interface ListUsersRequest {
  Querystring: ListUsersQuery;
}

interface GetUserRequest {
  Params: UserParams;
}

interface ChangeUserStatusRequest {
  Params: UserParams;

  Body: ChangeUserStatusBody;
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

export function createChangeUserStatusController(
  dependencies: UserAdministrationControllerDependencies,
): (request: FastifyRequest<ChangeUserStatusRequest>, reply: FastifyReply) => Promise<void> {
  return async function changeUserStatusController(request, reply): Promise<void> {
    const principal = request.authenticatedPrincipal;

    if (principal === null) {
      await reply
        .status(401)
        .send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));

      return;
    }

    const paramsResult = userParamsSchema.safeParse(request.params);

    const bodyResult = changeUserStatusBodySchema.safeParse(request.body);

    if (!paramsResult.success || !bodyResult.success) {
      await reply
        .status(400)
        .send(createErrorResponse('INVALID_REQUEST', 'Request validation failed'));

      return;
    }

    try {
      const result = await dependencies.changeUserStatusUseCase.execute({
        applicationId: principal.applicationId,

        actorUserId: principal.userId,

        targetUserId: paramsResult.data.userId,

        status: bodyResult.data.status,

        expectedVersion: bodyResult.data.expectedVersion,

        ...getAuditRequestContext(request),
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

      if (error instanceof CannotChangeOwnStatusError) {
        await reply
          .status(403)
          .send(createErrorResponse('CANNOT_CHANGE_OWN_STATUS', error.message));

        return;
      }

      if (error instanceof DisabledUserStatusError) {
        await reply.status(409).send(createErrorResponse('USER_ALREADY_DISABLED', error.message));

        return;
      }

      if (error instanceof UnverifiedUserActivationError) {
        await reply.status(409).send(createErrorResponse('EMAIL_NOT_VERIFIED', error.message));

        return;
      }

      if (error instanceof UserStatusConflictError) {
        await reply.status(409).send(createErrorResponse('USER_VERSION_CONFLICT', error.message));

        return;
      }

      throw error;
    }
  };
}
