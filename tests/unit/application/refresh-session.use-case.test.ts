import { InvalidRefreshTokenError } from '@/application/errors/invalid-refresh-token.error.js';
import type {
  AccessTokenService,
  CreateAccessTokenInput,
  VerifyAccessTokenInput,
  VerifyAccessTokenResult,
} from '@/application/ports/authentication/access-token-service.js';
import type {
  GeneratedRefreshToken,
  RefreshTokenService,
} from '@/application/ports/authentication/refresh-token-service.js';
import type {
  RefreshSessionRepository,
  RotateSessionRefreshTokenInput,
  RotateSessionRefreshTokenResult,
} from '@/application/ports/repositories/refresh-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import type { IdGenerator } from '@/application/ports/system/id-generator.js';
import { RefreshSessionUseCase } from '@/application/use-cases/authentication/refresh-session.use-case.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const NEW_REFRESH_TOKEN_ID = '401a82b5-dbf1-4e76-b084-dce1da232008';

const NEW_REFRESH_TOKEN_JTI = '91399467-9823-47d1-b483-786630fcf0fa';

const FIXED_NOW = new Date('2026-07-16T00:00:00.000Z');

const REFRESH_TOKEN_EXPIRES_AT = new Date('2026-08-15T00:00:00.000Z');

const REQUEST_ID = 'refresh-request-id';

const IP_ADDRESS = '127.0.0.1';

const USER_AGENT = 'Vitest Refresh Client';

class FakeRefreshSessionRepository implements RefreshSessionRepository {
  public input: RotateSessionRefreshTokenInput | null = null;

  public result: RotateSessionRefreshTokenResult = {
    status: 'ROTATED',

    userId: USER_ID,

    userEmail: 'sirawit@example.com',

    applicationId: APPLICATION_ID,

    sessionId: SESSION_ID,

    refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,
  };

  public rotate(input: RotateSessionRefreshTokenInput): Promise<RotateSessionRefreshTokenResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FakeAccessTokenService implements AccessTokenService {
  public createInput: CreateAccessTokenInput | null = null;

  public create(input: CreateAccessTokenInput): Promise<string> {
    this.createInput = input;

    return Promise.resolve('new-access-token');
  }

  public verify(input: VerifyAccessTokenInput): Promise<VerifyAccessTokenResult> {
    void input;

    return Promise.reject(new Error('Not implemented in this test'));
  }
}

class FakeRefreshTokenService implements RefreshTokenService {
  public generate(): GeneratedRefreshToken {
    return {
      rawToken: 'new-refresh-token',

      tokenHash: 'new-refresh-token-hash',

      jti: NEW_REFRESH_TOKEN_JTI,
    };
  }

  public hash(rawToken: string): string {
    return `hashed:${rawToken}`;
  }
}

class FixedIdGenerator implements IdGenerator {
  public generate(): string {
    return NEW_REFRESH_TOKEN_ID;
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

interface TestContext {
  repository: FakeRefreshSessionRepository;

  accessTokenService: FakeAccessTokenService;

  useCase: RefreshSessionUseCase;
}

function createTestContext(): TestContext {
  const repository = new FakeRefreshSessionRepository();

  const accessTokenService = new FakeAccessTokenService();

  const useCase = new RefreshSessionUseCase({
    repository,

    accessTokenService,

    refreshTokenService: new FakeRefreshTokenService(),

    idGenerator: new FixedIdGenerator(),

    clock: new FixedClock(),

    accessTokenTtlMinutes: 15,

    refreshTokenTtlDays: 30,
  });

  return {
    repository,

    accessTokenService,

    useCase,
  };
}

describe('RefreshSessionUseCase', () => {
  it('rotates a refresh token and forwards audit context', async () => {
    const context = createTestContext();

    const result = await context.useCase.execute({
      refreshToken: 'current-refresh-token',

      requestId: REQUEST_ID,

      ipAddress: IP_ADDRESS,

      userAgent: USER_AGENT,
    });

    expect(context.repository.input).toEqual({
      currentTokenHash: 'hashed:current-refresh-token',

      newTokenId: NEW_REFRESH_TOKEN_ID,

      newTokenJti: NEW_REFRESH_TOKEN_JTI,

      newTokenHash: 'new-refresh-token-hash',

      rotatedAt: FIXED_NOW,

      requestedTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,

      requestId: REQUEST_ID,

      ipAddress: IP_ADDRESS,

      userAgent: USER_AGENT,
    });

    expect(context.accessTokenService.createInput).toEqual({
      claims: {
        userId: USER_ID,

        sessionId: SESSION_ID,

        applicationId: APPLICATION_ID,

        email: 'sirawit@example.com',
      },

      issuedAt: FIXED_NOW,
    });

    expect(result).toEqual({
      sessionId: SESSION_ID,

      tokens: {
        accessToken: 'new-access-token',

        refreshToken: 'new-refresh-token',

        tokenType: 'Bearer',

        accessTokenExpiresInSeconds: 900,

        refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,
      },
    });
  });

  it('omits unavailable audit context fields', async () => {
    const context = createTestContext();

    await context.useCase.execute({
      refreshToken: 'current-refresh-token',
    });

    expect(context.repository.input).toEqual({
      currentTokenHash: 'hashed:current-refresh-token',

      newTokenId: NEW_REFRESH_TOKEN_ID,

      newTokenJti: NEW_REFRESH_TOKEN_JTI,

      newTokenHash: 'new-refresh-token-hash',

      rotatedAt: FIXED_NOW,

      requestedTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,
    });
  });

  it('rejects an unknown refresh token', async () => {
    const context = createTestContext();

    context.repository.result = {
      status: 'INVALID',
    };

    await expect(
      context.useCase.execute({
        refreshToken: 'unknown-refresh-token',

        requestId: REQUEST_ID,
      }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(context.accessTokenService.createInput).toBeNull();
  });

  it('rejects a reused refresh token', async () => {
    const context = createTestContext();

    context.repository.result = {
      status: 'REUSE_DETECTED',
    };

    await expect(
      context.useCase.execute({
        refreshToken: 'reused-refresh-token',

        requestId: REQUEST_ID,

        ipAddress: IP_ADDRESS,

        userAgent: USER_AGENT,
      }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(context.repository.input).toMatchObject({
      requestId: REQUEST_ID,

      ipAddress: IP_ADDRESS,

      userAgent: USER_AGENT,
    });

    expect(context.accessTokenService.createInput).toBeNull();
  });

  it('rejects an empty refresh token', async () => {
    const context = createTestContext();

    await expect(
      context.useCase.execute({
        refreshToken: '   ',

        requestId: REQUEST_ID,
      }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(context.repository.input).toBeNull();
  });
});
