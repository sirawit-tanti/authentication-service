import type { FastifyInstance } from 'fastify';

import { buildApplication } from '@/app.js';
import type {
  RefreshSessionCommand,
  RefreshSessionResult,
} from '@/application/use-cases/authentication/refresh-session.use-case.js';
import type { RefreshSessionExecutor } from '@/interfaces/http/modules/authentication/refresh.controller.js';
import { refreshRoutes } from '@/interfaces/http/modules/authentication/refresh.routes.js';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const REFRESH_TOKEN_EXPIRES_AT = new Date('2026-08-15T00:00:00.000Z');

class FakeRefreshSessionUseCase implements RefreshSessionExecutor {
  public command: RefreshSessionCommand | null = null;

  public execute(command: RefreshSessionCommand): Promise<RefreshSessionResult> {
    this.command = command;

    return Promise.resolve({
      sessionId: SESSION_ID,

      tokens: {
        accessToken: 'new-access-token',

        refreshToken: 'new-refresh-token',

        tokenType: 'Bearer',

        accessTokenExpiresInSeconds: 900,

        refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,
      },
    });
  }
}

interface TestContext {
  application: FastifyInstance;

  useCase: FakeRefreshSessionUseCase;
}

async function createTestContext(): Promise<TestContext> {
  const application = await buildApplication({
    logger: false,

    registerInfrastructure: false,

    bodyLimit: 256,
  });

  const useCase = new FakeRefreshSessionUseCase();

  await application.register(refreshRoutes, {
    prefix: '/api/v1/auth',

    refreshSessionUseCase: useCase,
  });

  await application.ready();

  return {
    application,
    useCase,
  };
}

describe('HTTP request boundaries', () => {
  let application: FastifyInstance | null = null;

  afterEach(async (): Promise<void> => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('accepts a valid JSON request within the body limit', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: 'current-refresh-token',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(context.useCase.command).toMatchObject({
      refreshToken: 'current-refresh-token',
    });
  });

  it('rejects a request body exceeding the configured limit', async () => {
    const context = await createTestContext();

    application = context.application;

    const sensitiveOversizedToken = `sensitive-${'a'.repeat(512)}`;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      headers: {
        'content-type': 'application/json',
      },

      payload: JSON.stringify({
        refreshToken: sensitiveOversizedToken,
      }),
    });

    expect(response.statusCode).toBe(413);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'PAYLOAD_TOO_LARGE',

        message: 'Request body exceeds the allowed size',
      },
    });

    expect(context.useCase.command).toBeNull();

    expect(response.body).not.toContain(sensitiveOversizedToken);
  });

  it('rejects malformed JSON with a generic response', async () => {
    const context = await createTestContext();

    application = context.application;

    const sensitiveFragment = 'sensitive-malformed-refresh-token';

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      headers: {
        'content-type': 'application/json',
      },

      payload: `{"refreshToken":"${sensitiveFragment}"`,
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'INVALID_JSON',

        message: 'Request body contains invalid JSON',
      },
    });

    expect(context.useCase.command).toBeNull();

    expect(response.body).not.toContain(sensitiveFragment);
  });

  it('rejects an unsupported content type', async () => {
    const context = await createTestContext();

    application = context.application;

    const sensitivePayload = '<refreshToken>sensitive-xml-token</refreshToken>';

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      headers: {
        'content-type': 'application/xml',
      },

      payload: sensitivePayload,
    });

    expect(response.statusCode).toBe(415);

    expect(response.json()).toEqual({
      success: false,

      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',

        message: 'Request content type is not supported',
      },
    });

    expect(context.useCase.command).toBeNull();

    expect(response.body).not.toContain(sensitivePayload);
  });

  it('rejects a missing refresh token', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {},
    });

    expect(response.statusCode).toBe(400);

    expect(context.useCase.command).toBeNull();

    expect(response.json()).toMatchObject({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',
      },
    });
  });

  it('rejects additional properties without reflecting their values', async () => {
    const context = await createTestContext();

    application = context.application;

    const unexpectedSecret = 'unexpected-sensitive-access-token';

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: 'current-refresh-token',

        accessToken: unexpectedSecret,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(context.useCase.command).toBeNull();

    expect(response.json()).toMatchObject({
      success: false,

      error: {
        code: 'INVALID_REQUEST',

        message: 'Request validation failed',
      },
    });

    expect(response.body).not.toContain(unexpectedSecret);
  });

  it('rejects a refresh token exceeding the field limit', async () => {
    const context = await createTestContext();

    application = context.application;

    const applicationWithLargerBodyLimit = await buildApplication({
      logger: false,

      registerInfrastructure: false,

      bodyLimit: 2_048,
    });

    await application.close();

    application = applicationWithLargerBodyLimit;

    const useCase = new FakeRefreshSessionUseCase();

    await application.register(refreshRoutes, {
      prefix: '/api/v1/auth',

      refreshSessionUseCase: useCase,
    });

    await application.ready();

    const oversizedField = 'a'.repeat(513);

    const response = await application.inject({
      method: 'POST',

      url: '/api/v1/auth/refresh',

      payload: {
        refreshToken: oversizedField,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(useCase.command).toBeNull();

    expect(response.body).not.toContain(oversizedField);
  });
});
