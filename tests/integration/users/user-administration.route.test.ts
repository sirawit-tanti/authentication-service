import Fastify, { type FastifyInstance } from 'fastify';

import type { AdministrativeUserRecord } from '../../../src/application/ports/repositories/user-administration-query.repository.js';
import type {
  ChangeUserStatusCommand,
  ChangeUserStatusResult,
} from '../../../src/application/use-cases/users/change-user-status.use-case.js';
import type {
  GetAdministrativeUserCommand,
  GetAdministrativeUserResult,
} from '../../../src/application/use-cases/users/get-administrative-user.use-case.js';
import type {
  ListAdministrativeUsersCommand,
  ListAdministrativeUsersResult,
} from '../../../src/application/use-cases/users/list-administrative-users.use-case.js';
import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type { PermissionGuard } from '../../../src/interfaces/http/authorization/permission-guard.js';
import type {
  ChangeUserStatusExecutor,
  GetAdministrativeUserExecutor,
  ListAdministrativeUsersExecutor,
} from '../../../src/interfaces/http/modules/users/user-administration.controller.js';
import { userAdministrationRoutes } from '../../../src/interfaces/http/modules/users/user-administration.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { createErrorResponse } from '../../../src/shared/http/api-response.js';

const ACTOR_USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const TARGET_USER_ID = 'a863a7a7-ef58-4101-a65f-b454cf82f302';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const NOW = new Date('2026-07-21T08:00:00.000Z');

const REQUEST_ID = 'status-request-id';

const USER_AGENT = 'Vitest Admin Client';

const USER: AdministrativeUserRecord = {
  id: TARGET_USER_ID,

  email: 'target@example.com',

  status: 'ACTIVE',

  emailVerified: true,

  failedLoginAttempts: 0,

  lockedUntil: null,

  passwordChangedAt: NOW,

  lastLoginAt: NOW,

  version: 2,

  createdAt: NOW,

  updatedAt: NOW,

  roles: [],
};

class FakeListUsersUseCase implements ListAdministrativeUsersExecutor {
  public command: ListAdministrativeUsersCommand | null = null;

  public execute(command: ListAdministrativeUsersCommand): Promise<ListAdministrativeUsersResult> {
    this.command = command;

    return Promise.resolve({
      users: [USER],

      pagination: {
        page: 1,

        limit: 20,

        total: 1,

        totalPages: 1,
      },
    });
  }
}

class FakeGetUserUseCase implements GetAdministrativeUserExecutor {
  public command: GetAdministrativeUserCommand | null = null;

  public execute(command: GetAdministrativeUserCommand): Promise<GetAdministrativeUserResult> {
    this.command = command;

    return Promise.resolve({
      user: USER,
    });
  }
}

class FakeChangeUserStatusUseCase implements ChangeUserStatusExecutor {
  public command: ChangeUserStatusCommand | null = null;

  public execute(command: ChangeUserStatusCommand): Promise<ChangeUserStatusResult> {
    this.command = command;

    return Promise.resolve({
      user: {
        id: TARGET_USER_ID,

        email: 'target@example.com',

        previousStatus: 'ACTIVE',

        status: 'SUSPENDED',

        version: 3,

        revokedSessionCount: 2,

        updatedAt: NOW,
      },
    });
  }
}

function createAuthenticationGuard(): AuthenticationGuard {
  return function authenticationGuard(request, reply): Promise<void> {
    void reply;

    request.authenticatedPrincipal = {
      userId: ACTOR_USER_ID,

      email: 'admin@example.com',

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,
    };

    return Promise.resolve();
  };
}

function createAllowedPermissionGuard(): PermissionGuard {
  return function permissionGuard(request, reply): Promise<void> {
    void request;
    void reply;

    return Promise.resolve();
  };
}

function createRejectedPermissionGuard(): PermissionGuard {
  return async function permissionGuard(request, reply): Promise<void> {
    void request;

    await reply
      .status(403)
      .send(createErrorResponse('FORBIDDEN', 'You do not have permission to perform this action'));
  };
}

interface CreateApplicationOptions {
  usersReadPermissionGuard?: PermissionGuard;

  usersDisablePermissionGuard?: PermissionGuard;
}

interface ApplicationTestContext {
  application: FastifyInstance;

  listUsersUseCase: FakeListUsersUseCase;

  getUserUseCase: FakeGetUserUseCase;

  changeUserStatusUseCase: FakeChangeUserStatusUseCase;
}

async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<ApplicationTestContext> {
  const application = Fastify({
    logger: false,

    requestIdHeader: 'x-request-id',

    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  const listUsersUseCase = new FakeListUsersUseCase();

  const getUserUseCase = new FakeGetUserUseCase();

  const changeUserStatusUseCase = new FakeChangeUserStatusUseCase();

  await application.register(errorHandler);

  await application.register(userAdministrationRoutes, {
    prefix: '/api/v1/users',

    authenticationGuard: createAuthenticationGuard(),

    usersReadPermissionGuard: options.usersReadPermissionGuard ?? createAllowedPermissionGuard(),

    usersDisablePermissionGuard:
      options.usersDisablePermissionGuard ?? createAllowedPermissionGuard(),

    listUsersUseCase,

    getUserUseCase,

    changeUserStatusUseCase,
  });

  await application.ready();

  return {
    application,
    listUsersUseCase,
    getUserUseCase,
    changeUserStatusUseCase,
  };
}

describe('User administration routes', () => {
  let application: FastifyInstance | null = null;

  afterEach(async () => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('lists users in the authenticated application', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/users?page=1&limit=20&search=target&status=ACTIVE',
    });

    expect(response.statusCode).toBe(200);

    expect(context.listUsersUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      page: 1,

      limit: 20,

      search: 'target',

      status: 'ACTIVE',
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
        users: [
          {
            id: TARGET_USER_ID,

            email: 'target@example.com',

            status: 'ACTIVE',

            emailVerified: true,

            failedLoginAttempts: 0,

            lockedUntil: null,

            passwordChangedAt: NOW.toISOString(),

            lastLoginAt: NOW.toISOString(),

            version: 2,

            createdAt: NOW.toISOString(),

            updatedAt: NOW.toISOString(),

            roles: [],
          },
        ],

        pagination: {
          page: 1,

          limit: 20,

          total: 1,

          totalPages: 1,
        },
      },
    });
  });

  it('gets a user in the authenticated application', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: `/api/v1/users/${TARGET_USER_ID}`,
    });

    expect(response.statusCode).toBe(200);

    expect(context.getUserUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      userId: TARGET_USER_ID,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
        user: {
          id: TARGET_USER_ID,

          email: 'target@example.com',

          status: 'ACTIVE',

          emailVerified: true,

          failedLoginAttempts: 0,

          lockedUntil: null,

          passwordChangedAt: NOW.toISOString(),

          lastLoginAt: NOW.toISOString(),

          version: 2,

          createdAt: NOW.toISOString(),

          updatedAt: NOW.toISOString(),

          roles: [],
        },
      },
    });
  });

  it('suspends a user with audit request context', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PATCH',

      url: `/api/v1/users/${TARGET_USER_ID}/status`,

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        status: 'SUSPENDED',

        expectedVersion: 2,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.changeUserStatusUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      actorUserId: ACTOR_USER_ID,

      targetUserId: TARGET_USER_ID,

      status: 'SUSPENDED',

      expectedVersion: 2,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
        user: {
          id: TARGET_USER_ID,

          email: 'target@example.com',

          previousStatus: 'ACTIVE',

          status: 'SUSPENDED',

          version: 3,

          revokedSessionCount: 2,

          updatedAt: NOW.toISOString(),
        },
      },
    });
  });

  it('rejects an invalid user ID', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/users/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);

    expect(context.getUserUseCase.command).toBeNull();
  });

  it('rejects an invalid status request body', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PATCH',

      url: `/api/v1/users/${TARGET_USER_ID}/status`,

      payload: {
        status: 'UNKNOWN',

        expectedVersion: 0,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(context.changeUserStatusUseCase.command).toBeNull();
  });

  it('returns 403 when users.read is missing', async () => {
    const context = await createApplication({
      usersReadPermissionGuard: createRejectedPermissionGuard(),
    });

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/users',
    });

    expect(response.statusCode).toBe(403);

    expect(context.listUsersUseCase.command).toBeNull();
  });

  it('returns 403 when users.disable is missing', async () => {
    const context = await createApplication({
      usersDisablePermissionGuard: createRejectedPermissionGuard(),
    });

    application = context.application;

    const response = await application.inject({
      method: 'PATCH',

      url: `/api/v1/users/${TARGET_USER_ID}/status`,

      payload: {
        status: 'SUSPENDED',

        expectedVersion: 2,
      },
    });

    expect(response.statusCode).toBe(403);

    expect(context.changeUserStatusUseCase.command).toBeNull();
  });
});
