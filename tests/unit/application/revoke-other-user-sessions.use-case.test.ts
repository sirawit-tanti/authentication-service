import type {
  RevokeOtherUserSessionsInput,
  RevokeOtherUserSessionsResult,
  RevokeUserSessionInput,
  RevokeUserSessionResult,
  UserSessionRecord,
  UserSessionRepository,
} from '../../../src/application/ports/repositories/user-session.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { RevokeOtherUserSessionsUseCase } from '../../../src/application/use-cases/authentication/revoke-other-user-sessions.use-case.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const CURRENT_SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const FIXED_NOW = new Date('2026-07-17T00:00:00.000Z');

const REQUEST_ID = 'revoke-other-sessions-request-id';

class FakeUserSessionRepository implements UserSessionRepository {
  public input: RevokeOtherUserSessionsInput | null = null;

  public result: RevokeOtherUserSessionsResult = {
    revokedCount: 2,
  };

  public findByUserId(userId: string): Promise<UserSessionRecord[]> {
    void userId;

    return Promise.resolve([]);
  }

  public revoke(input: RevokeUserSessionInput): Promise<RevokeUserSessionResult> {
    void input;

    return Promise.resolve('NOT_FOUND');
  }

  public revokeOthers(input: RevokeOtherUserSessionsInput): Promise<RevokeOtherUserSessionsResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

describe('RevokeOtherUserSessionsUseCase', () => {
  it('revokes all sessions except the current session with audit request context', async () => {
    const repository = new FakeUserSessionRepository();

    const useCase = new RevokeOtherUserSessionsUseCase({
      repository,

      clock: new FixedClock(),
    });

    const result = await useCase.execute({
      userId: USER_ID,

      currentSessionId: CURRENT_SESSION_ID,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest',
    });

    expect(repository.input).toEqual({
      userId: USER_ID,

      currentSessionId: CURRENT_SESSION_ID,

      revokedAt: FIXED_NOW,

      reason: 'Revoked by user from another session',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest',
    });

    expect(result).toEqual({
      revokedCount: 2,
    });
  });

  it('omits optional audit context when it is not supplied', async () => {
    const repository = new FakeUserSessionRepository();

    const useCase = new RevokeOtherUserSessionsUseCase({
      repository,

      clock: new FixedClock(),
    });

    await useCase.execute({
      userId: USER_ID,

      currentSessionId: CURRENT_SESSION_ID,
    });

    expect(repository.input).toEqual({
      userId: USER_ID,

      currentSessionId: CURRENT_SESSION_ID,

      revokedAt: FIXED_NOW,

      reason: 'Revoked by user from another session',
    });

    expect(repository.input).not.toHaveProperty('requestId');

    expect(repository.input).not.toHaveProperty('ipAddress');

    expect(repository.input).not.toHaveProperty('userAgent');
  });
});
