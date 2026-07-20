import type {
  RevokeOtherUserSessionsInput,
  RevokeOtherUserSessionsResult,
  RevokeUserSessionInput,
  RevokeUserSessionResult,
  UserSessionRecord,
  UserSessionRepository,
} from '../../../src/application/ports/repositories/user-session.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { RevokeUserSessionUseCase } from '../../../src/application/use-cases/authentication/revoke-user-session.use-case.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = '401a82b5-dbf1-4e76-b084-dce1da232008';

const FIXED_NOW = new Date('2026-07-17T00:00:00.000Z');

const REQUEST_ID = 'revoke-session-request-id';

class FakeUserSessionRepository implements UserSessionRepository {
  public input: RevokeUserSessionInput | null = null;

  public result: RevokeUserSessionResult = 'REVOKED';

  public findByUserId(userId: string): Promise<UserSessionRecord[]> {
    void userId;

    return Promise.resolve([]);
  }

  public revoke(input: RevokeUserSessionInput): Promise<RevokeUserSessionResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }

  public revokeOthers(input: RevokeOtherUserSessionsInput): Promise<RevokeOtherUserSessionsResult> {
    void input;

    return Promise.resolve({
      revokedCount: 0,
    });
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

describe('RevokeUserSessionUseCase', () => {
  it('revokes a user session with audit request context', async () => {
    const repository = new FakeUserSessionRepository();

    const useCase = new RevokeUserSessionUseCase({
      repository,

      clock: new FixedClock(),
    });

    await useCase.execute({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest',
    });

    expect(repository.input).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,

      revokedAt: FIXED_NOW,

      reason: 'Revoked by user',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest',
    });
  });

  it('omits optional audit context when it is not supplied', async () => {
    const repository = new FakeUserSessionRepository();

    const useCase = new RevokeUserSessionUseCase({
      repository,

      clock: new FixedClock(),
    });

    await useCase.execute({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,
    });

    expect(repository.input).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      sessionId: SESSION_ID,

      revokedAt: FIXED_NOW,

      reason: 'Revoked by user',
    });

    expect(repository.input).not.toHaveProperty('requestId');

    expect(repository.input).not.toHaveProperty('ipAddress');

    expect(repository.input).not.toHaveProperty('userAgent');
  });
});
