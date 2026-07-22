import type {
  GeneratedRefreshToken,
  RefreshTokenService,
} from '../../../src/application/ports/authentication/refresh-token-service.js';
import type {
  LogoutSessionRepository,
  RevokeSessionByRefreshTokenInput,
  RevokeSessionByRefreshTokenResult,
} from '../../../src/application/ports/repositories/logout-session.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { LogoutSessionUseCase } from '../../../src/application/use-cases/authentication/logout-session.use-case.js';
import type {
  AccessTokenService,
  CreateAccessTokenInput,
  VerifyAccessTokenInput,
  VerifyAccessTokenResult,
} from '../../../src/application/ports/authentication/access-token-service.js';

const FIXED_NOW = new Date('2026-07-16T00:00:00.000Z');

const ACCESS_TOKEN_JTI = '91399467-9823-47d1-b483-786630fcf0fa';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const ACCESS_TOKEN_EXPIRES_AT = new Date('2026-07-16T00:15:00.000Z');

const REQUEST_ID = 'logout-request-id';

class FakeLogoutSessionRepository implements LogoutSessionRepository {
  public input: RevokeSessionByRefreshTokenInput | null = null;

  public result: RevokeSessionByRefreshTokenResult = 'REVOKED';

  public revokeByRefreshToken(
    input: RevokeSessionByRefreshTokenInput,
  ): Promise<RevokeSessionByRefreshTokenResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FakeRefreshTokenService implements RefreshTokenService {
  public generate(): GeneratedRefreshToken {
    return {
      rawToken: 'generated-refresh-token',

      tokenHash: 'generated-refresh-token-hash',

      jti: '91399467-9823-47d1-b483-786630fcf0fa',
    };
  }

  public hash(rawToken: string): string {
    return `hashed:${rawToken}`;
  }
}

class FakeAccessTokenService implements AccessTokenService {
  public verifyInput: VerifyAccessTokenInput | null = null;

  public create(input: CreateAccessTokenInput): Promise<string> {
    void input;

    return Promise.reject(new Error('Not implemented in this test'));
  }

  public verify(input: VerifyAccessTokenInput): Promise<VerifyAccessTokenResult> {
    this.verifyInput = input;

    return Promise.resolve({
      jti: ACCESS_TOKEN_JTI,
      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      sessionId: SESSION_ID,
      applicationId: 'd797d3eb-41ce-40cf-9d79-30b15fe49042',
      email: 'sirawit@example.com',
      issuedAt: FIXED_NOW,
      expiresAt: ACCESS_TOKEN_EXPIRES_AT,
    });
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

interface TestContext {
  repository: FakeLogoutSessionRepository;

  useCase: LogoutSessionUseCase;
}

function createTestContext(): TestContext {
  const repository = new FakeLogoutSessionRepository();

  const accessTokenService = new FakeAccessTokenService();

  const useCase = new LogoutSessionUseCase({
    repository,

    refreshTokenService: new FakeRefreshTokenService(),

    accessTokenService,

    clock: new FixedClock(),
  });

  return {
    repository,
    useCase,
  };
}

describe('LogoutSessionUseCase', () => {
  it('revokes the session and passes the audit request context', async () => {
    const context = createTestContext();

    await context.useCase.execute({
      refreshToken: ' current-refresh-token ',

      requestId: REQUEST_ID,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(context.repository.input).toEqual({
      refreshTokenHash: 'hashed:current-refresh-token',

      revokedAt: FIXED_NOW,

      reason: 'User requested logout',

      requestId: REQUEST_ID,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });
  });

  it('omits optional audit fields when they are not supplied', async () => {
    const context = createTestContext();

    await context.useCase.execute({
      refreshToken: 'current-refresh-token',
    });

    expect(context.repository.input).toEqual({
      refreshTokenHash: 'hashed:current-refresh-token',

      revokedAt: FIXED_NOW,

      reason: 'User requested logout',
    });

    expect(context.repository.input).not.toHaveProperty('requestId');

    expect(context.repository.input).not.toHaveProperty('ipAddress');

    expect(context.repository.input).not.toHaveProperty('userAgent');
  });

  it.each(['REVOKED', 'ALREADY_REVOKED', 'NOT_FOUND'] as const)(
    'completes successfully when repository returns %s',
    async (repositoryResult) => {
      const context = createTestContext();

      context.repository.result = repositoryResult;

      await expect(
        context.useCase.execute({
          refreshToken: 'current-refresh-token',
        }),
      ).resolves.toBeUndefined();
    },
  );

  it('does not call the repository for an empty token', async () => {
    const context = createTestContext();

    await expect(
      context.useCase.execute({
        refreshToken: '   ',

        requestId: REQUEST_ID,
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest',
      }),
    ).resolves.toBeUndefined();

    expect(context.repository.input).toBeNull();
  });

  it('blacklists the supplied valid access token during logout', async () => {
    const context = createTestContext();

    await context.useCase.execute({
      refreshToken: 'current-refresh-token',
      accessToken: 'current-access-token',
    });

    expect(context.repository.input).toEqual({
      refreshTokenHash: 'hashed:current-refresh-token',
      revokedAt: FIXED_NOW,
      reason: 'User requested logout',

      accessToken: {
        jti: ACCESS_TOKEN_JTI,
        sessionId: SESSION_ID,
        expiresAt: ACCESS_TOKEN_EXPIRES_AT,
      },
    });
  });
});
