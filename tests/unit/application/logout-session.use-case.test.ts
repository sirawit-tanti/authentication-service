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

const FIXED_NOW = new Date('2026-07-16T00:00:00.000Z');

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

  const useCase = new LogoutSessionUseCase({
    repository,

    refreshTokenService: new FakeRefreshTokenService(),

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
});
