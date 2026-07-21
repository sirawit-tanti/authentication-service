import Fastify, { type FastifyInstance } from 'fastify';

import type { ManagedRoleRecord } from '../../../src/application/ports/repositories/role-management.repository.js';
import type {
  CreateRoleCommand,
  CreateRoleResult,
} from '../../../src/application/use-cases/authorization/create-role.use-case.js';
import type {
  ReplaceRolePermissionsCommand,
  ReplaceRolePermissionsResult,
} from '../../../src/application/use-cases/authorization/replace-role-permissions.use-case.js';
import type {
  UpdateRoleCommand,
  UpdateRoleResult,
} from '../../../src/application/use-cases/authorization/update-role.use-case.js';
import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type { PermissionGuard } from '../../../src/interfaces/http/authorization/permission-guard.js';
import type {
  CreateRoleExecutor,
  ReplaceRolePermissionsExecutor,
  UpdateRoleExecutor,
} from '../../../src/interfaces/http/modules/authorization/role-management.controller.js';
import { roleManagementRoutes } from '../../../src/interfaces/http/modules/authorization/role-management.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { createErrorResponse } from '../../../src/shared/http/api-response.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const ROLE_ID = '22baecdc-c7f4-459b-b8e3-b72db02b87bb';

const PERMISSION_ID = '64d8d356-fe13-45e9-906f-2cc4c00c4599';

const REQUEST_ID = 'role-management-request-id';

const USER_AGENT = 'Vitest Role Management Client';

const ROLE: ManagedRoleRecord = {
  id: ROLE_ID,

  code: 'SUPPORT_AGENT',

  name: 'Support Agent',

  description: null,

  isSystem: false,

  isActive: true,

  permissions: [],
};

class FakeCreateRoleUseCase implements CreateRoleExecutor {
  public command: CreateRoleCommand | null = null;

  public execute(command: CreateRoleCommand): Promise<CreateRoleResult> {
    this.command = command;

    return Promise.resolve({
      role: ROLE,
    });
  }
}

class FakeUpdateRoleUseCase implements UpdateRoleExecutor {
  public command: UpdateRoleCommand | null = null;

  public execute(command: UpdateRoleCommand): Promise<UpdateRoleResult> {
    this.command = command;

    return Promise.resolve({
      role: {
        ...ROLE,

        name: 'Senior Support Agent',
      },
    });
  }
}

class FakeReplaceRolePermissionsUseCase implements ReplaceRolePermissionsExecutor {
  public command: ReplaceRolePermissionsCommand | null = null;

  public execute(command: ReplaceRolePermissionsCommand): Promise<ReplaceRolePermissionsResult> {
    this.command = command;

    return Promise.resolve({
      role: {
        ...ROLE,

        permissions: [
          {
            id: PERMISSION_ID,

            code: 'users.read',

            name: 'Read users',

            description: null,

            resource: 'users',

            action: 'read',

            isActive: true,
          },
        ],
      },
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

interface TestContext {
  application: FastifyInstance;

  createRoleUseCase: FakeCreateRoleUseCase;

  updateRoleUseCase: FakeUpdateRoleUseCase;

  replaceRolePermissionsUseCase: FakeReplaceRolePermissionsUseCase;
}

async function createApplication(
  permissionGuard: PermissionGuard = createAllowedPermissionGuard(),
): Promise<TestContext> {
  const application = Fastify({
    logger: false,

    requestIdHeader: 'x-request-id',

    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  const createRoleUseCase = new FakeCreateRoleUseCase();

  const updateRoleUseCase = new FakeUpdateRoleUseCase();

  const replaceRolePermissionsUseCase = new FakeReplaceRolePermissionsUseCase();

  await application.register(errorHandler);

  await application.register(roleManagementRoutes, {
    prefix: '/api/v1/authorization',

    authenticationGuard: createAuthenticationGuard(),

    rolesManagePermissionGuard: permissionGuard,

    createRoleUseCase,

    updateRoleUseCase,

    replaceRolePermissionsUseCase,
  });

  await application.ready();

  return {
    application,
    createRoleUseCase,
    updateRoleUseCase,
    replaceRolePermissionsUseCase,
  };
}

describe('Role management routes', () => {
  let application: FastifyInstance | null = null;

  afterEach(async () => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('creates a custom role in the authenticated application', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/authorization/roles',

      headers: {
        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },

      payload: {
        code: 'support_agent',

        name: 'Support Agent',

        description: null,
      },
    });

    expect(response.statusCode).toBe(201);

    expect(context.createRoleUseCase.command).toEqual({
      applicationId: APPLICATION_ID,

      actorUserId: USER_ID,

      code: 'SUPPORT_AGENT',

      name: 'Support Agent',

      description: null,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('updates a custom role', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PATCH',

      url: `/api/v1/authorization/roles/${ROLE_ID}`,

      payload: {
        name: 'Senior Support Agent',

        isActive: true,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.updateRoleUseCase.command).toMatchObject({
      applicationId: APPLICATION_ID,

      actorUserId: USER_ID,

      roleId: ROLE_ID,

      name: 'Senior Support Agent',

      isActive: true,
    });
  });

  it('replaces permissions of a custom role', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PUT',

      url: `/api/v1/authorization/roles/${ROLE_ID}/permissions`,

      payload: {
        permissionIds: [PERMISSION_ID],
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.replaceRolePermissionsUseCase.command).toMatchObject({
      applicationId: APPLICATION_ID,

      actorUserId: USER_ID,

      roleId: ROLE_ID,

      permissionIds: [PERMISSION_ID],
    });
  });

  it('rejects role management when roles.manage is missing', async () => {
    const context = await createApplication(createRejectedPermissionGuard());

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/authorization/roles',

      payload: {
        code: 'SUPPORT_AGENT',

        name: 'Support Agent',

        description: null,
      },
    });

    expect(response.statusCode).toBe(403);

    expect(context.createRoleUseCase.command).toBeNull();
  });

  it('rejects an invalid role ID', async () => {
    const context = await createApplication();

    application = context.application;

    const response = await application.inject({
      method: 'PATCH',

      url: '/api/v1/authorization/roles/not-a-uuid',

      payload: {
        name: 'Support Agent',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(context.updateRoleUseCase.command).toBeNull();
  });
});
