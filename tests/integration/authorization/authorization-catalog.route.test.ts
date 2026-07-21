import Fastify, { type FastifyInstance } from 'fastify';

import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type { PermissionGuard } from '../../../src/interfaces/http/authorization/permission-guard.js';
import type {
  ListPermissionsExecutor,
  ListRolesExecutor,
} from '../../../src/interfaces/http/modules/authorization/authorization-catalog.controller.js';
import { authorizationCatalogRoutes } from '../../../src/interfaces/http/modules/authorization/authorization-catalog.routes.js';
import type {
  ListPermissionsCommand,
  ListPermissionsResult,
} from '../../../src/application/use-cases/authorization/list-permissions.use-case.js';
import type {
  ListRolesCommand,
  ListRolesResult,
} from '../../../src/application/use-cases/authorization/list-roles.use-case.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { createErrorResponse } from '../../../src/shared/http/api-response.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const ROLE_ID = '22baecdc-c7f4-459b-b8e3-b72db02b87bb';

const PERMISSION_ID = '64d8d356-fe13-45e9-906f-2cc4c00c4599';

class FakeListRolesUseCase implements ListRolesExecutor {
  public command: ListRolesCommand | null = null;

  public execute(command: ListRolesCommand): Promise<ListRolesResult> {
    this.command = command;

    return Promise.resolve({
      roles: [
        {
          id: ROLE_ID,

          code: 'ADMINISTRATOR',

          name: 'Administrator',

          description: 'Full administrative access',

          isSystem: true,

          isActive: true,

          permissions: [
            {
              id: PERMISSION_ID,

              code: 'roles.read',

              name: 'Read roles',

              description: null,

              resource: 'roles',

              action: 'read',

              isActive: true,
            },
          ],
        },
      ],
    });
  }
}

class FakeListPermissionsUseCase implements ListPermissionsExecutor {
  public command: ListPermissionsCommand | null = null;

  public execute(command: ListPermissionsCommand): Promise<ListPermissionsResult> {
    this.command = command;

    return Promise.resolve({
      permissions: [
        {
          id: PERMISSION_ID,

          code: 'roles.read',

          name: 'Read roles',

          description: null,

          resource: 'roles',

          action: 'read',

          isActive: true,
        },
      ],
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

async function createApplication(permissionGuard: PermissionGuard): Promise<{
  application: FastifyInstance;
  listRolesUseCase: FakeListRolesUseCase;
  listPermissionsUseCase: FakeListPermissionsUseCase;
}> {
  const application = Fastify({
    logger: false,
  });

  const listRolesUseCase = new FakeListRolesUseCase();

  const listPermissionsUseCase = new FakeListPermissionsUseCase();

  await application.register(errorHandler);

  await application.register(authorizationCatalogRoutes, {
    prefix: '/api/v1/authorization',

    authenticationGuard: createAuthenticationGuard(),

    rolesReadPermissionGuard: permissionGuard,

    listRolesUseCase,

    listPermissionsUseCase,
  });

  await application.ready();

  return {
    application,
    listRolesUseCase,
    listPermissionsUseCase,
  };
}

describe('Authorization catalog routes', () => {
  let application: FastifyInstance | null = null;

  afterEach(async () => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('lists roles for the authenticated application', async () => {
    const testContext = await createApplication(createAllowedPermissionGuard());

    application = testContext.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/roles',
    });

    expect(response.statusCode).toBe(200);

    expect(testContext.listRolesUseCase.command).toEqual({
      applicationId: APPLICATION_ID,
    });

    expect(response.json()).toMatchObject({
      success: true,

      data: {
        roles: [
          {
            code: 'ADMINISTRATOR',

            permissions: [
              {
                code: 'roles.read',
              },
            ],
          },
        ],
      },
    });
  });

  it('lists permissions for the authenticated application', async () => {
    const testContext = await createApplication(createAllowedPermissionGuard());

    application = testContext.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/permissions',
    });

    expect(response.statusCode).toBe(200);

    expect(testContext.listPermissionsUseCase.command).toEqual({
      applicationId: APPLICATION_ID,
    });
  });

  it('returns 403 when roles.read is missing', async () => {
    const testContext = await createApplication(createRejectedPermissionGuard());

    application = testContext.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/roles',
    });

    expect(response.statusCode).toBe(403);

    expect(testContext.listRolesUseCase.command).toBeNull();
  });
});
