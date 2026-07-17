import Fastify, { type FastifyInstance } from 'fastify';

import type {
  ListUserSessionsCommand,
  ListUserSessionsResult,
} from '../../../src/application/use-cases/authentication/list-user-sessions.use-case.js';
import type { RevokeUserSessionCommand } from '../../../src/application/use-cases/authentication/revoke-user-session.use-case.js';
import type { AuthenticationGuard } from '../../../src/interfaces/http/authentication/authentication-guard.js';
import type {
  ListUserSessionsExecutor,
  RevokeUserSessionExecutor,
} from '../../../src/interfaces/http/modules/authentication/sessions.controller.js';
import { protectedAuthenticationRoutes } from '../../../src/interfaces/http/modules/authentication/protected-authentication.routes.js';
import { errorHandler } from '../../../src/shared/errors/error-handler.js';
import { createErrorResponse } from '../../../src/shared/http/api-response.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

class FakeListUserSessionsUseCase implements ListUserSessionsExecutor {
  public execute(command: ListUserSessionsCommand): Promise<ListUserSessionsResult> {
    void command;

    return Promise.resolve({
      sessions: [],
    });
  }
}

class FakeRevokeUserSessionUseCase implements RevokeUserSessionExecutor {
  public execute(command: RevokeUserSessionCommand): Promise<void> {
    void command;

    return Promise.resolve();
  }
}

function createSuccessfulGuard(): AuthenticationGuard {
  return function successfulGuard(request, reply): Promise<void> {
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

function createRejectedGuard(): AuthenticationGuard {
  return async function rejectedGuard(request, reply): Promise<void> {
    request.authenticatedPrincipal = null;

    await reply.status(401).send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));
  };
}

describe('GET /api/v1/auth/me', () => {
  let application: FastifyInstance;

  afterEach(async () => {
    await application.close();
  });

  it('returns the authenticated principal', async () => {
    application = Fastify({
      logger: false,
    });

    await application.register(errorHandler);

    await application.register(protectedAuthenticationRoutes, {
      prefix: '/api/v1/auth',

      authenticationGuard: createSuccessfulGuard(),

      listUserSessionsUseCase: new FakeListUserSessionsUseCase(),

      revokeUserSessionUseCase: new FakeRevokeUserSessionUseCase(),
    });

    await application.ready();

    const response = await application.inject({
      method: 'GET',
      url: '/api/v1/auth/me',

      headers: {
        authorization: 'Bearer test-access-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      success: true,

      data: {
        userId: USER_ID,
        email: 'sirawit@example.com',
        applicationId: APPLICATION_ID,
        sessionId: SESSION_ID,
      },
    });
  });

  it('returns HTTP 401 when authentication fails', async () => {
    application = Fastify({
      logger: false,
    });

    await application.register(errorHandler);

    await application.register(protectedAuthenticationRoutes, {
      prefix: '/api/v1/auth',

      authenticationGuard: createRejectedGuard(),

      listUserSessionsUseCase: new FakeListUserSessionsUseCase(),

      revokeUserSessionUseCase: new FakeRevokeUserSessionUseCase(),
    });

    await application.ready();

    const response = await application.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required',
      },
    });
  });
});
