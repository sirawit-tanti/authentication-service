import Fastify, { type FastifyInstance } from 'fastify';

import type {
  ListPermissionsCommand,
  ListPermissionsResult,
} from '../../../src/application/use-cases/authorization/list-permissions.use-case.js';
import type {
  ListRolesCommand,
  ListRolesResult,
} from '../../../src/application/use-cases/authorization/list-roles.use-case.js';
import type {
  GetUserRolesCommand,
  GetUserRolesResult,
} from '../../../src/application/use-cases/authorization/get-user-roles.use-case.js';
import type {
  ReplaceUserRolesCommand,
  ReplaceUserRolesResult,
} from '../../../src/application/use-cases/authorization/replace-user-roles.use-case.js';
import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type { PermissionGuard } from '../../../src/interfaces/http/authorization/permission-guard.js';
import type {
  ListPermissionsExecutor,
  ListRolesExecutor,
} from '../../../src/interfaces/http/modules/authorization/authorization-catalog.controller.js';
import { authorizationCatalogRoutes } from '../../../src/interfaces/http/modules/authorization/authorization-catalog.routes.js';
import type {
  GetUserRolesExecutor,
  ReplaceUserRolesExecutor,
} from '../../../src/interfaces/http/modules/authorization/user-role-assignment.controller.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { createErrorResponse } from '../../../src/shared/http/api-response.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const TARGET_USER_ID = 'a863a7a7-ef58-4101-a65f-b454cf82f302';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const ROLE_ID = '22baecdc-c7f4-459b-b8e3-b72db02b87bb';

const PERMISSION_ID = '64d8d356-fe13-45e9-906f-2cc4c00c4599';

const ASSIGNED_AT = new Date('2026-07-21T05:00:00.000Z');

const REQUEST_ID = 'role-request-id';

const USER_AGENT = 'Vitest Role Client';

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

class FakeGetUserRolesUseCase implements GetUserRolesExecutor {
  public command: GetUserRolesCommand | null = null;

  public execute(command: GetUserRolesCommand): Promise<GetUserRolesResult> {
    this.command = command;

    return Promise.resolve({
      roles: [
        {
          id: ROLE_ID,

          code: 'VIEWER',

          name: 'Viewer',

          description: 'Read-only access',

          isSystem: true,

          isActive: true,

          assignedAt: ASSIGNED_AT,

          expiresAt: null,
        },
      ],
    });
  }
}

class FakeReplaceUserRolesUseCase implements ReplaceUserRolesExecutor {
  public command: ReplaceUserRolesCommand | null = null;

  public execute(command: ReplaceUserRolesCommand): Promise<ReplaceUserRolesResult> {
    this.command = command;

    return Promise.resolve({
      roles: [
        {
          id: ROLE_ID,

          code: 'VIEWER',

          name: 'Viewer',

          description: 'Read-only access',

          isSystem: true,

          isActive: true,

          assignedAt: ASSIGNED_AT,

          expiresAt: null,
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

interface CreateApplicationOptions {
  rolesReadPermissionGuard?: PermissionGuard;

  rolesAssignPermissionGuard?: PermissionGuard;
}

interface ApplicationTestContext {
  application: FastifyInstance;

  listRolesUseCase: FakeListRolesUseCase;

  listPermissionsUseCase: FakeListPermissionsUseCase;

  getUserRolesUseCase: FakeGetUserRolesUseCase;

  replaceUserRolesUseCase: FakeReplaceUserRolesUseCase;
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

  const listRolesUseCase = new FakeListRolesUseCase();

  const listPermissionsUseCase = new FakeListPermissionsUseCase();

  const getUserRolesUseCase = new FakeGetUserRolesUseCase();

  const replaceUserRolesUseCase = new FakeReplaceUserRolesUseCase();

  await application.register(errorHandler);

  await application.register(authorizationCatalogRoutes, {
    prefix: '/api/v1/authorization',

    authenticationGuard: createAuthenticationGuard(),

    rolesReadPermissionGuard: options.rolesReadPermissionGuard ?? createAllowedPermissionGuard(),

    rolesAssignPermissionGuard:
      options.rolesAssignPermissionGuard ?? createAllowedPermissionGuard(),

    listRolesUseCase,

    listPermissionsUseCase,

    getUserRolesUseCase,

    replaceUserRolesUseCase,
  });

  await application.ready();

  return {
    application,
    listRolesUseCase,
    listPermissionsUseCase,
    getUserRolesUseCase,
    replaceUserRolesUseCase,
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
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/roles',
    });

    expect(response.statusCode).toBe(200);

    expect(context.listRolesUseCase.command).toEqual({
      applicationId: APPLICATION_ID,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
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
      },
    });
  });

  it('lists permissions for the authenticated application', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/permissions',
    });

    expect(response.statusCode).toBe(200);

    expect(context.listPermissionsUseCase.command).toEqual({
      applicationId: APPLICATION_ID,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
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
    });
  });

  it('gets assigned roles for a user in the authenticated application', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: `/api/v1/authorization/users/${TARGET_USER_ID}/roles`,
    });

    expect(response.statusCode).toBe(200);

    expect(context.getUserRolesUseCase.command).toEqual({
      userId: TARGET_USER_ID,

      applicationId: APPLICATION_ID,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
        roles: [
          {
            id: ROLE_ID,

            code: 'VIEWER',

            name: 'Viewer',

            description: 'Read-only access',

            isSystem: true,

            isActive: true,

            assignedAt: ASSIGNED_AT.toISOString(),

            expiresAt: null,
          },
        ],
      },
    });
  });

  it('replaces roles in the authenticated application scope with audit request context', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PUT',

      url: `/api/v1/authorization/users/${TARGET_USER_ID}/roles`,

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        roleIds: [ROLE_ID],
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.replaceUserRolesUseCase.command).toEqual({
      targetUserId: TARGET_USER_ID,

      applicationId: APPLICATION_ID,

      roleIds: [ROLE_ID],

      assignedByUserId: USER_ID,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });

    expect(response.json()).toEqual({
      success: true,

      data: {
        roles: [
          {
            id: ROLE_ID,

            code: 'VIEWER',

            name: 'Viewer',

            description: 'Read-only access',

            isSystem: true,

            isActive: true,

            assignedAt: ASSIGNED_AT.toISOString(),

            expiresAt: null,
          },
        ],
      },
    });
  });

  it('supports removing every role from a user', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PUT',

      url: `/api/v1/authorization/users/${TARGET_USER_ID}/roles`,

      payload: {
        roleIds: [],
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.replaceUserRolesUseCase.command).toMatchObject({
      targetUserId: TARGET_USER_ID,

      applicationId: APPLICATION_ID,

      roleIds: [],

      assignedByUserId: USER_ID,
    });
  });

  it('rejects an invalid target user ID', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/users/not-a-uuid/roles',
    });

    expect(response.statusCode).toBe(400);

    expect(context.getUserRolesUseCase.command).toBeNull();
  });

  it('returns 403 when roles.read is missing', async () => {
    const context = await createApplication({
      rolesReadPermissionGuard: createRejectedPermissionGuard(),
    });

    application = context.application;

    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/authorization/roles',
    });

    expect(response.statusCode).toBe(403);

    expect(context.listRolesUseCase.command).toBeNull();
  });

  it('returns 403 when roles.assign is missing', async () => {
    const context = await createApplication({
      rolesAssignPermissionGuard: createRejectedPermissionGuard(),
    });

    application = context.application;

    const response = await application.inject({
      method: 'PUT',

      url: `/api/v1/authorization/users/${TARGET_USER_ID}/roles`,

      payload: {
        roleIds: [ROLE_ID],
      },
    });

    expect(response.statusCode).toBe(403);

    expect(context.replaceUserRolesUseCase.command).toBeNull();
  });
});
