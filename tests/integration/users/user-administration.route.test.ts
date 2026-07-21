import Fastify, { type FastifyInstance } from 'fastify';

import type { AdministrativeUserRecord } from '../../../src/application/ports/repositories/user-administration-query.repository.js';
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
  GetAdministrativeUserExecutor,
  ListAdministrativeUsersExecutor,
} from '../../../src/interfaces/http/modules/users/user-administration.controller.js';
import { userAdministrationRoutes } from '../../../src/interfaces/http/modules/users/user-administration.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const NOW = new Date('2026-07-21T07:00:00.000Z');

const USER: AdministrativeUserRecord = {
  id: USER_ID,

  email: 'sirawit@example.com',

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

function createAuthenticationGuard(): AuthenticationGuard {
  return function authenticationGuard(request, reply): Promise<void> {
    void reply;

    request.authenticatedPrincipal = {
      userId: USER_ID,

      email: 'sirawit@example.com',

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,
    };

    return Promise.resolve();
  };
}

function createPermissionGuard(): PermissionGuard {
  return function permissionGuard(request, reply): Promise<void> {
    void request;
    void reply;

    return Promise.resolve();
  };
}

describe('User administration routes', () => {
  let application: FastifyInstance;

  let listUsersUseCase: FakeListUsersUseCase;

  let getUserUseCase: FakeGetUserUseCase;

  beforeEach(async () => {
    application = Fastify({
      logger: false,

      ajv: {
        customOptions: {
          removeAdditional: false,
        },
      },
    });

    listUsersUseCase = new FakeListUsersUseCase();

    getUserUseCase = new FakeGetUserUseCase();

    await application.register(errorHandler);

    await application.register(userAdministrationRoutes, {
      prefix: '/api/v1/users',

      authenticationGuard: createAuthenticationGuard(),

      usersReadPermissionGuard: createPermissionGuard(),

      listUsersUseCase,

      getUserUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('lists users in the authenticated application', async () => {
    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/users?page=1&limit=20&search=sirawit&status=ACTIVE',
    });

    expect(response.statusCode).toBe(200);

    expect(listUsersUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      page: 1,

      limit: 20,

      search: 'sirawit',

      status: 'ACTIVE',
    });
  });

  it('gets a user in the authenticated application', async () => {
    const response = await application.inject({
      method: 'GET',

      url: `/api/v1/users/${USER_ID}`,
    });

    expect(response.statusCode).toBe(200);

    expect(getUserUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      userId: USER_ID,
    });
  });

  it('rejects an invalid user ID', async () => {
    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/users/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);

    expect(getUserUseCase.command).toBeNull();
  });
});
