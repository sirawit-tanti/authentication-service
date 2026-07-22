import { Writable } from 'node:stream';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { buildApplication } from '@/app.js';
import { createLoggerRedactionConfiguration } from '@/shared/logging/logger-redaction.js';

const SECRET_AUTHORIZATION = 'Bearer sensitive-access-token';

const SECRET_COOKIE = 'session=sensitive-session-cookie';

const SECRET_PASSWORD = 'SensitivePassword123!';

const SECRET_CURRENT_PASSWORD = 'OldSensitivePassword123!';

const SECRET_NEW_PASSWORD = 'NewSensitivePassword123!';

const SECRET_REFRESH_TOKEN = 'sensitive-refresh-token';

const SECRET_ACCESS_TOKEN = 'sensitive-response-access-token';

const SECRET_CLIENT_SECRET = 'sensitive-client-secret';

const SECRET_API_KEY = 'sensitive-api-key';

class MemoryLogStream extends Writable {
  private output = '';

  public override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.output += chunk.toString();

    callback();
  }

  public getOutput(): string {
    return this.output;
  }
}

interface SensitiveRequestBody {
  password: string;

  currentPassword: string;

  newPassword: string;

  refreshToken: string;

  clientSecret: string;

  apiKey: string;
}

interface SensitiveRouteRequest {
  Body: SensitiveRequestBody;
}

interface TestContext {
  application: FastifyInstance;

  stream: MemoryLogStream;
}

async function waitForLogFlush(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

async function createTestContext(): Promise<TestContext> {
  const stream = new MemoryLogStream();

  const application = await buildApplication({
    logger: {
      level: 'info',

      stream,

      redact: createLoggerRedactionConfiguration(),
    },

    registerInfrastructure: false,
  });

  application.post<SensitiveRouteRequest>(
    '/log-redaction-test',
    (
      request: FastifyRequest<SensitiveRouteRequest>,
    ): {
      success: true;
    } => {
      request.log.info(
        {
          req: request,

          password: request.body.password,

          currentPassword: request.body.currentPassword,

          newPassword: request.body.newPassword,

          refreshToken: request.body.refreshToken,

          accessToken: SECRET_ACCESS_TOKEN,

          clientSecret: request.body.clientSecret,

          apiKey: request.body.apiKey,
        },
        'Sensitive data redaction test',
      );

      return {
        success: true,
      };
    },
  );

  await application.ready();

  return {
    application,
    stream,
  };
}

describe('Sensitive log redaction', () => {
  let application: FastifyInstance | null = null;

  afterEach(async (): Promise<void> => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('redacts authorization, cookies, passwords and tokens', async () => {
    const context = await createTestContext();

    application = context.application;

    const response = await application.inject({
      method: 'POST',

      url: '/log-redaction-test',

      headers: {
        authorization: SECRET_AUTHORIZATION,

        cookie: SECRET_COOKIE,
      },

      payload: {
        password: SECRET_PASSWORD,

        currentPassword: SECRET_CURRENT_PASSWORD,

        newPassword: SECRET_NEW_PASSWORD,

        refreshToken: SECRET_REFRESH_TOKEN,

        clientSecret: SECRET_CLIENT_SECRET,

        apiKey: SECRET_API_KEY,
      },
    });

    expect(response.statusCode).toBe(200);

    await waitForLogFlush();

    const logOutput = context.stream.getOutput();

    expect(logOutput).toContain('[REDACTED]');

    expect(logOutput).not.toContain(SECRET_AUTHORIZATION);

    expect(logOutput).not.toContain(SECRET_COOKIE);

    expect(logOutput).not.toContain(SECRET_PASSWORD);

    expect(logOutput).not.toContain(SECRET_CURRENT_PASSWORD);

    expect(logOutput).not.toContain(SECRET_NEW_PASSWORD);

    expect(logOutput).not.toContain(SECRET_REFRESH_TOKEN);

    expect(logOutput).not.toContain(SECRET_ACCESS_TOKEN);

    expect(logOutput).not.toContain(SECRET_CLIENT_SECRET);

    expect(logOutput).not.toContain(SECRET_API_KEY);
  });

  it('keeps non-sensitive operational fields in logs', async () => {
    const context = await createTestContext();

    application = context.application;

    const requestId = 'log-redaction-operational-request';

    const response = await application.inject({
      method: 'POST',

      url: '/log-redaction-test',

      headers: {
        'x-request-id': requestId,

        authorization: SECRET_AUTHORIZATION,
      },

      payload: {
        password: SECRET_PASSWORD,

        currentPassword: SECRET_CURRENT_PASSWORD,

        newPassword: SECRET_NEW_PASSWORD,

        refreshToken: SECRET_REFRESH_TOKEN,

        clientSecret: SECRET_CLIENT_SECRET,

        apiKey: SECRET_API_KEY,
      },
    });

    expect(response.statusCode).toBe(200);

    await waitForLogFlush();

    const logOutput = context.stream.getOutput();

    expect(logOutput).toContain(requestId);

    expect(logOutput).toContain('Sensitive data redaction test');

    expect(logOutput).toContain('/log-redaction-test');

    expect(logOutput).not.toContain(SECRET_PASSWORD);
  });

  it('returns fresh redaction path arrays for each logger instance', () => {
    const firstConfiguration = createLoggerRedactionConfiguration();

    const secondConfiguration = createLoggerRedactionConfiguration();

    expect(firstConfiguration).not.toBe(secondConfiguration);

    expect(firstConfiguration.paths).not.toBe(secondConfiguration.paths);

    expect(firstConfiguration).toEqual(secondConfiguration);
  });
});
