import type {
  FindUserAuthorizationInput,
  UserAuthorizationQueryRepository,
  UserAuthorizationRecord,
} from '../../../src/application/ports/repositories/user-authorization-query.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { GetUserAuthorizationUseCase } from '../../../src/application/use-cases/authorization/get-user-authorization.use-case.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const CHECKED_AT = new Date('2026-07-21T04:30:00.000Z');

class FakeAuthorizationRepository implements UserAuthorizationQueryRepository {
  public input: FindUserAuthorizationInput | null = null;

  public result: UserAuthorizationRecord = {
    roles: ['VIEWER', 'ADMINISTRATOR'],

    permissions: ['users.read', 'audit_logs.read', 'roles.read'],
  };

  public findForUser(input: FindUserAuthorizationInput): Promise<UserAuthorizationRecord> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return CHECKED_AT;
  }
}

describe('GetUserAuthorizationUseCase', () => {
  it('returns sorted roles and permissions for the current application', async () => {
    const repository = new FakeAuthorizationRepository();

    const useCase = new GetUserAuthorizationUseCase({
      repository,

      clock: new FixedClock(),
    });

    const result = await useCase.execute({
      userId: USER_ID,

      applicationId: APPLICATION_ID,
    });

    expect(repository.input).toEqual({
      userId: USER_ID,

      applicationId: APPLICATION_ID,

      checkedAt: CHECKED_AT,
    });

    expect(result).toEqual({
      roles: ['ADMINISTRATOR', 'VIEWER'],

      permissions: ['audit_logs.read', 'roles.read', 'users.read'],
    });
  });

  it('returns empty arrays when the user has no active role assignment', async () => {
    const repository = new FakeAuthorizationRepository();

    repository.result = {
      roles: [],
      permissions: [],
    };

    const useCase = new GetUserAuthorizationUseCase({
      repository,

      clock: new FixedClock(),
    });

    await expect(
      useCase.execute({
        userId: USER_ID,

        applicationId: APPLICATION_ID,
      }),
    ).resolves.toEqual({
      roles: [],
      permissions: [],
    });
  });
});
