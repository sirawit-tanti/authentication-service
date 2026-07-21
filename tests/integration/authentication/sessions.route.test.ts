import Fastify, { type FastifyInstance } from 'fastify';

import type { ChangePasswordCommand } from '../../../src/application/use-cases/authentication/change-password.use-case.js';
import type {
  ListUserSessionsCommand,
  ListUserSessionsResult,
} from '../../../src/application/use-cases/authentication/list-user-sessions.use-case.js';
import type { RevokeOtherUserSessionsCommand } from '../../../src/application/use-cases/authentication/revoke-other-user-sessions.use-case.js';
import type { RevokeUserSessionCommand } from '../../../src/application/use-cases/authentication/revoke-user-session.use-case.js';
import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type { ChangePasswordExecutor } from '../../../src/interfaces/http/modules/authentication/change-password.controller.js';
import { protectedAuthenticationRoutes } from '../../../src/interfaces/http/modules/authentication/protected-authentication.routes.js';
import type {
  ListUserSessionsExecutor,
  RevokeOtherUserSessionsExecutor,
  RevokeUserSessionExecutor,
} from '../../../src/interfaces/http/modules/authentication/sessions.controller.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const CURRENT_SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const OTHER_SESSION_ID = '401a82b5-dbf1-4e76-b084-dce1da232008';

const REQUEST_ID = 'sessions-route-request-id';

const USER_AGENT = 'Vitest Session Client';

class FakeListUserSessionsUseCase implements ListUserSessionsExecutor {
  public command: ListUserSessionsCommand | null = null;

  public execute(command: ListUserSessionsCommand): Promise<ListUserSessionsResult> {
    this.command = command;

    return Promise.resolve({
      sessions: [
        {
          sessionId: CURRENT_SESSION_ID,

          applicationId: APPLICATION_ID,

          deviceId: null,

          status: 'ACTIVE',

          ipAddress: '127.0.0.1',

          userAgent: 'Vitest',

          lastActivityAt: new Date('2026-07-16T00:00:00.000Z'),

          expiresAt: new Date('2026-08-15T00:00:00.000Z'),

          revokedAt: null,
          revokeReason: null,

          createdAt: new Date('2026-07-16T00:00:00.000Z'),

          current: true,
        },
      ],
    });
  }
}

class FakeRevokeUserSessionUseCase implements RevokeUserSessionExecutor {
  public command: RevokeUserSessionCommand | null = null;

  public execute(command: RevokeUserSessionCommand): Promise<void> {
    this.command = command;

    return Promise.resolve();
  }
}

class FakeRevokeOtherUserSessionsUseCase implements RevokeOtherUserSessionsExecutor {
  public command: RevokeOtherUserSessionsCommand | null = null;

  public execute(command: RevokeOtherUserSessionsCommand): Promise<{
    revokedCount: number;
  }> {
    this.command = command;

    return Promise.resolve({
      revokedCount: 2,
    });
  }
}

class FakeChangePasswordUseCase implements ChangePasswordExecutor {
  public command: ChangePasswordCommand | null = null;

  public execute(command: ChangePasswordCommand): Promise<void> {
    this.command = command;

    return Promise.resolve();
  }
}

function createGuard(): AuthenticationGuard {
  return function authenticationGuard(request, reply): Promise<void> {
    void reply;

    request.authenticatedPrincipal = {
      userId: USER_ID,

      email: 'sirawit@example.com',

      applicationId: APPLICATION_ID,

      sessionId: CURRENT_SESSION_ID,
    };

    return Promise.resolve();
  };
}

describe('Authentication session routes', () => {
  let application: FastifyInstance;

  let listUseCase: FakeListUserSessionsUseCase;

  let revokeUseCase: FakeRevokeUserSessionUseCase;

  let revokeOtherUseCase: FakeRevokeOtherUserSessionsUseCase;

  let changePasswordUseCase: FakeChangePasswordUseCase;

  beforeEach(async () => {
    application = Fastify({
      logger: false,

      requestIdHeader: 'x-request-id',

      ajv: {
        customOptions: {
          removeAdditional: false,
        },
      },
    });

    listUseCase = new FakeListUserSessionsUseCase();

    revokeUseCase = new FakeRevokeUserSessionUseCase();

    revokeOtherUseCase = new FakeRevokeOtherUserSessionsUseCase();

    changePasswordUseCase = new FakeChangePasswordUseCase();

    await application.register(errorHandler);

    await application.register(protectedAuthenticationRoutes, {
      prefix: '/api/v1/auth',

      authenticationGuard: createGuard(),

      listUserSessionsUseCase: listUseCase,

      revokeUserSessionUseCase: revokeUseCase,

      revokeOtherUserSessionsUseCase: revokeOtherUseCase,

      changePasswordUseCase,
    });

    await application.ready();
  });

  afterEach(async () => {
    await application.close();
  });

  it('lists the current user sessions', async () => {
    const response = await application.inject({
      method: 'GET',

      url: '/api/v1/auth/sessions',

      headers: {
        authorization: 'Bearer test-access-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        sessions: [
          {
            sessionId: CURRENT_SESSION_ID,

            applicationId: APPLICATION_ID,

            deviceId: null,

            status: 'ACTIVE',

            ipAddress: '127.0.0.1',

            userAgent: 'Vitest',

            lastActivityAt: '2026-07-16T00:00:00.000Z',

            expiresAt: '2026-08-15T00:00:00.000Z',

            revokedAt: null,
            revokeReason: null,

            createdAt: '2026-07-16T00:00:00.000Z',

            current: true,
          },
        ],
      },
    });

    expect(listUseCase.command).toEqual({
      userId: USER_ID,

      currentSessionId: CURRENT_SESSION_ID,
    });
  });

  it('revokes a session owned by the current user with audit request context', async () => {
    const response = await application.inject({
      method: 'DELETE',

      url: `/api/v1/auth/sessions/${OTHER_SESSION_ID}`,

      headers: {
        authorization: 'Bearer test-access-token',

        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.body).toBe('');

    expect(revokeUseCase.command).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      sessionId: OTHER_SESSION_ID,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('truncates a long user agent when revoking a session', async () => {
    const longUserAgent = 'a'.repeat(600);

    const response = await application.inject({
      method: 'DELETE',

      url: `/api/v1/auth/sessions/${OTHER_SESSION_ID}`,

      headers: {
        authorization: 'Bearer test-access-token',

        'user-agent': longUserAgent,
      },
    });

    expect(response.statusCode).toBe(204);

    expect(revokeUseCase.command?.userAgent).toBe('a'.repeat(512));
  });

  it('rejects an invalid session ID', async () => {
    const response = await application.inject({
      method: 'DELETE',

      url: '/api/v1/auth/sessions/not-a-uuid',

      headers: {
        authorization: 'Bearer test-access-token',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(revokeUseCase.command).toBeNull();
  });

  it('revokes all sessions except the current session with audit request context', async () => {
    const response = await application.inject({
      method: 'DELETE',

      url: '/api/v1/auth/sessions',

      headers: {
        authorization: 'Bearer test-access-token',

        'x-request-id': REQUEST_ID,

        'user-agent': USER_AGENT,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        revokedCount: 2,
      },
    });

    expect(revokeOtherUseCase.command).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      currentSessionId: CURRENT_SESSION_ID,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: USER_AGENT,
    });
  });

  it('omits an empty user agent when revoking other sessions', async () => {
    const response = await application.inject({
      method: 'DELETE',

      url: '/api/v1/auth/sessions',

      headers: {
        authorization: 'Bearer test-access-token',

        'x-request-id': REQUEST_ID,

        'user-agent': '',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(revokeOtherUseCase.command).toMatchObject({
      userId: USER_ID,

      currentSessionId: CURRENT_SESSION_ID,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',
    });

    expect(revokeOtherUseCase.command).not.toHaveProperty('userAgent');
  });

  it('changes password in the authenticated application scope', async () => {
    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/change-password',

      headers: {
        authorization: 'Bearer test-access-token',
      },

      payload: {
        currentPassword: 'OldPassword#2026',

        newPassword: 'NewPassword#2026',
      },
    });

    expect(response.statusCode).toBe(204);

    expect(response.body).toBe('');

    expect(changePasswordUseCase.command).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      currentSessionId: CURRENT_SESSION_ID,

      currentPassword: 'OldPassword#2026',

      newPassword: 'NewPassword#2026',

      requestId: 'req-1',

      ipAddress: '127.0.0.1',

      userAgent: 'lightMyRequest',
    });
  });
});
